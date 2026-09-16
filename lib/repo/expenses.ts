import "server-only";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export type ExpenseRow = typeof expenses.$inferSelect;

/** Gastos mais recentes primeiro (pela data do gasto, depois pela criação)
 *  — inclui cancelados, para manter o histórico visível (mesma convenção de
 *  nunca esconder/apagar já usada no resto do app). */
export async function listExpenses(): Promise<ExpenseRow[]> {
  return db.select().from(expenses).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
}

export async function getExpense(id: number): Promise<ExpenseRow | null> {
  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return rows[0] ?? null;
}
