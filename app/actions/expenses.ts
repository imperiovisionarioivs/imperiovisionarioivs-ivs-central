"use server";

import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { expenseCreateSchema, expenseCancelSchema } from "@/lib/validation";

// Gastos são agência-nível, sem clientId — por isso não há registro em
// `activities` (tabela ligada a um cliente específico); o próprio
// created_by/created_at do lançamento já serve de trilha de auditoria.

export async function createExpenseAction(input: unknown) {
  const user = await requirePermission("finance.reconcile");
  const data = expenseCreateSchema.parse(input);

  await db.insert(expenses).values({
    category: data.category,
    description: data.description,
    valueCents: data.valueCents,
    expenseDate: data.expenseDate,
    recurring: data.recurring,
    notes: data.notes,
    createdById: user.id,
    createdByName: user.name,
  });

  revalidatePath("/financeiro");
  return { ok: true };
}

// Sem exclusão — mesma convenção do resto do app: um gasto lançado por
// engano vira "cancelado", nunca desaparece do histórico.
export async function cancelExpenseAction(input: unknown) {
  await requirePermission("finance.reconcile");
  const { expenseId } = expenseCancelSchema.parse(input);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (!current) throw new Error("Gasto não encontrado");
    if (current.status === "cancelado") throw new Error("Este gasto já está cancelado.");

    await tx.update(expenses).set({ status: "cancelado" }).where(eq(expenses.id, expenseId));
  });

  revalidatePath("/financeiro");
  return { ok: true };
}
