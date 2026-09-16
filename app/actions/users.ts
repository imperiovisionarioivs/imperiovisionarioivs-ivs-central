"use server";

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword, requirePermission, revokeAllSessionsForUser } from "@/lib/auth";
import { countActiveAdmins, emailInUse } from "@/lib/repo/users";
import {
  userActiveUpdateSchema,
  userCreateSchema,
  userPasswordResetSchema,
  userRoleUpdateSchema,
} from "@/lib/validation";

/** Senha temporária forte, gerada no servidor — nunca escolhida pelo admin
 *  nem enviada por e-mail/mensagem automaticamente (nenhum serviço de
 *  e-mail está configurado, e a instrução deste projeto é nunca disparar
 *  convites sem autorização explícita). Aparece uma única vez no retorno
 *  desta action para o admin repassar pelo canal que ele escolher, e a
 *  pessoa troca no primeiro acesso pela tela de Configurações. */
function generateTempPassword(): string {
  return randomBytes(18).toString("base64url"); // 24 caracteres, ~144 bits de entropia
}

export async function createUserAction(input: unknown) {
  await requirePermission("user.manage");
  const data = userCreateSchema.parse(input);

  if (await emailInUse(data.email)) {
    throw new Error("Já existe uma conta com este e-mail");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const [row] = await db
    .insert(users)
    .values({ name: data.name, email: data.email, passwordHash, role: data.role })
    .returning({ id: users.id });
  if (!row) throw new Error("Falha ao criar usuário");

  revalidatePath("/configuracoes");
  return { ok: true, id: row.id, tempPassword };
}

export async function updateUserRoleAction(input: unknown) {
  const admin = await requirePermission("user.manage");
  const { userId, role } = userRoleUpdateSchema.parse(input);

  if (userId === admin.id) {
    throw new Error("Use a tela de Configurações para alterar sua própria conta");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new Error("Usuário não encontrado");

    // Impede remover o papel admin do último admin ativo — sem isso, uma
    // troca de papel mal pensada tranca a conta inteira para fora do
    // sistema, sem ninguém com permissão para desfazer.
    if (target.role === "admin" && role !== "admin" && (await countActiveAdmins(userId)) === 0) {
      throw new Error("Não é possível remover o último administrador ativo do sistema");
    }

    await tx.update(users).set({ role }).where(eq(users.id, userId));
  });

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function updateUserActiveAction(input: unknown) {
  const admin = await requirePermission("user.manage");
  const { userId, active } = userActiveUpdateSchema.parse(input);

  if (userId === admin.id) {
    throw new Error("Use a tela de Configurações para encerrar sua própria sessão");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new Error("Usuário não encontrado");

    if (target.role === "admin" && target.active && !active && (await countActiveAdmins(userId)) === 0) {
      throw new Error("Não é possível desativar o último administrador ativo do sistema");
    }

    await tx.update(users).set({ active }).where(eq(users.id, userId));
  });

  // Desativar uma conta não derruba sessões já abertas por si só — revoga
  // explicitamente, senão alguém desativado continua com acesso até a
  // sessão expirar sozinha (até 30 dias).
  if (!active) {
    await revokeAllSessionsForUser(userId);
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function resetUserPasswordAction(input: unknown) {
  const admin = await requirePermission("user.manage");
  const { userId } = userPasswordResetSchema.parse(input);

  if (userId === admin.id) {
    throw new Error("Use a tela de Configurações para trocar sua própria senha");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const [row] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!row) throw new Error("Usuário não encontrado");

  // Uma redefinição de senha feita por outra pessoa (o admin, não o dono da
  // conta) precisa derrubar qualquer sessão já aberta com a senha antiga —
  // mesmo raciocínio de changePassword() em lib/auth.ts.
  await revokeAllSessionsForUser(userId);

  revalidatePath("/configuracoes");
  return { ok: true, tempPassword };
}
