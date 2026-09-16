import "server-only";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { db } from "./db";
import { loginAttempts, sessions, users } from "./db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { SESSION_COOKIE } from "./auth-constants";
import { can, ForbiddenError, UnauthenticatedError, type Permission } from "./permissions";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const id = nanoid(48);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  const id = await getCurrentSessionId();
  if (!id) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (!row.active) return null;

  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/** Throws UnauthenticatedError if there is no logged-in user. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * Throws UnauthenticatedError or ForbiddenError as appropriate. This is
 * the gate every server action and mutating route handler must call —
 * "is logged in" alone is not authorization, see lib/permissions.ts for
 * the full matrix.
 */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new ForbiddenError(permission);
  }
  return user;
}

// --- Password change & session revocation -----------------------------

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  keepSessionId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "Usuário não encontrado" };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Senha atual incorreta" };

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  // A password change must invalidate every OTHER active session for this
  // user — otherwise a stolen/leaked session cookie keeps working right
  // through the password reset that was supposed to shut it out.
  await revokeOtherSessions(userId, keepSessionId ?? null);

  return { ok: true };
}

/** Deletes every session for a user except (optionally) the current one. */
export async function revokeOtherSessions(userId: number, keepSessionId: string | null) {
  if (keepSessionId) {
    await db.delete(sessions).where(
      and(eq(sessions.userId, userId), sql`${sessions.id} <> ${keepSessionId}`)
    );
  } else {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

/** Admin-only: force-logout a user everywhere, including their current session. */
export async function revokeAllSessionsForUser(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// --- Persistent (Postgres-backed) login rate limiting -------------------
//
// An in-memory Map does not work correctly in a serverless deployment:
// each cold start, and each concurrently-running instance, has its own
// empty Map, so an attacker's requests spread across instances would
// never accumulate a shared count and the limiter would be effectively
// bypassed. Backing it with the database makes the limit real regardless
// of how many function instances are running.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), gte(loginAttempts.attemptedAt, windowStart)));

  if ((row?.count ?? 0) >= MAX_ATTEMPTS) return false;

  await db.insert(loginAttempts).values({ identifier });

  // Opportunistic cleanup so the table doesn't grow without bound — cheap
  // (indexed) and runs on a small fraction of requests rather than on
  // every single one.
  if (Math.random() < 0.02) {
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.attemptedAt, new Date(Date.now() - WINDOW_MS * 6)));
  }

  return true;
}
