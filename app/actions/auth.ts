"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  changePassword,
  createSession,
  destroySession,
  getCurrentSessionId,
  requireUser,
  revokeOtherSessions,
  verifyPassword,
  checkRateLimit,
} from "@/lib/auth";
import { changePasswordSchema, loginSchema } from "@/lib/validation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "unknown";
  // checkRateLimit is async (it queries the persistent login_attempts
  // table) — an earlier pass at this migration forgot the `await` here,
  // which made `!checkRateLimit(...)` always false (a Promise object is
  // truthy), silently disabling the rate limiter entirely. Caught by
  // actually exercising this path against the database, not by the build.
  const allowed = await checkRateLimit(`login:${ip}:${parsed.data.email}`);
  if (!allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const rows = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const user = rows[0];

  // Constant-shape response to avoid leaking which emails exist.
  if (!user || !user.active) {
    return { error: "E-mail ou senha incorretos." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "E-mail ou senha incorretos." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export type ChangePasswordState = { error?: string; success?: boolean };

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const sessionId = await getCurrentSessionId();
  const result = await changePassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    sessionId
  );
  if (!result.ok) {
    return { error: result.error };
  }

  return { success: true };
}

export type RevokeSessionsState = { error?: string; success?: boolean };

/** "Encerrar outras sessões" — keeps the session the user is currently in. */
export async function revokeOtherSessionsAction(): Promise<RevokeSessionsState> {
  const user = await requireUser();
  const sessionId = await getCurrentSessionId();
  await revokeOtherSessions(user.id, sessionId);
  revalidatePath("/configuracoes");
  return { success: true };
}
