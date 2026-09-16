import "server-only";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";

export type UserRow = Omit<typeof users.$inferSelect, "passwordHash">;

const SAFE_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
} as const;

/** Nunca seleciona passwordHash — a listagem de equipe não precisa dele, e
 *  isolar isso aqui evita que uma tela futura vaze o hash por engano. */
export async function listUsers(): Promise<UserRow[]> {
  return db.select(SAFE_COLUMNS).from(users).orderBy(users.name);
}

export async function getUserSafe(id: number): Promise<UserRow | null> {
  const rows = await db.select(SAFE_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function emailInUse(email: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows.length > 0;
}

/** Conta admins ativos — usado para impedir que a última conta admin ativa
 *  seja desativada ou rebaixada, o que trancaria todo mundo para fora. */
export async function countActiveAdmins(excludingUserId?: number): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      excludingUserId
        ? and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, excludingUserId))
        : and(eq(users.role, "admin"), eq(users.active, true))
    );
  return rows.length;
}
