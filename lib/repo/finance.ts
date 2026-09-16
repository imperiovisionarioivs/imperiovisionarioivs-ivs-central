import "server-only";
import { db } from "@/lib/db";
import { subscriptions, financialCharges, chargePayments, expenses } from "@/lib/db/schema";
import { computeAnnualValueCents } from "@/lib/db/schema";
import { and, desc, eq, inArray, like } from "drizzle-orm";

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type ChargeRow = typeof financialCharges.$inferSelect;
export type ChargePaymentRow = typeof chargePayments.$inferSelect;

export async function getSubscriptionsForClient(clientId: number): Promise<SubscriptionRow[]> {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getChargesForClient(clientId: number): Promise<ChargeRow[]> {
  return db
    .select()
    .from(financialCharges)
    .where(eq(financialCharges.clientId, clientId))
    .orderBy(desc(financialCharges.createdAt));
}

export async function getSubscription(id: number): Promise<SubscriptionRow | null> {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCharge(id: number): Promise<ChargeRow | null> {
  const rows = await db.select().from(financialCharges).where(eq(financialCharges.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Recebimentos de um conjunto de cobranças, mais recentes primeiro — usado
 *  para montar o mapa chargeId -> pagamentos exibido no painel do cliente. */
export async function getPaymentsForCharges(chargeIds: number[]): Promise<ChargePaymentRow[]> {
  if (chargeIds.length === 0) return [];
  return db
    .select()
    .from(chargePayments)
    .where(inArray(chargePayments.chargeId, chargeIds))
    .orderBy(desc(chargePayments.createdAt));
}

export async function getPaymentsForCharge(chargeId: number): Promise<ChargePaymentRow[]> {
  return getPaymentsForCharges([chargeId]);
}

export async function listActiveSubscriptions(): Promise<SubscriptionRow[]> {
  return db.select().from(subscriptions).where(eq(subscriptions.status, "ativa")).orderBy(desc(subscriptions.createdAt));
}

const CHARGE_STATUS_FILTERABLE = ["pendente", "pago", "atrasado", "cancelado"] as const;

export async function listCharges(opts?: { status?: (typeof CHARGE_STATUS_FILTERABLE)[number] }): Promise<ChargeRow[]> {
  const rows = await db
    .select()
    .from(financialCharges)
    .where(opts?.status ? eq(financialCharges.status, opts.status) : undefined)
    .orderBy(desc(financialCharges.dueDate), desc(financialCharges.createdAt));
  return rows;
}

/** Receita mensal recorrente (MRR) somando todas as assinaturas ativas — uma
 *  assinatura anual contribui com o valor anual dividido por 12 (arredondado
 *  para o centavo mais próximo; é uma estimativa para o painel, não um
 *  lançamento contábil). Usada por getFinanceOverview() abaixo. */
function sumMrrCents(active: SubscriptionRow[]): number {
  return active.reduce((sum, s) => {
    if (s.billingCycle === "mensal") return sum + s.monthlyValueCents;
    const annual = computeAnnualValueCents(s.monthlyValueCents, s.annualDiscountMonths);
    return sum + Math.round(annual / 12);
  }, 0);
}

export async function getFinanceOverview() {
  const [pendentes, atrasadas, active] = await Promise.all([
    listCharges({ status: "pendente" }),
    listCharges({ status: "atrasado" }),
    listActiveSubscriptions(),
  ]);
  const mrrCents = sumMrrCents(active);
  const pendingCents = pendentes.reduce((sum, c) => sum + c.valueCents, 0);
  const overdueCents = atrasadas.reduce((sum, c) => sum + c.valueCents, 0);

  return {
    mrrCents,
    activeSubscriptionsCount: active.length,
    pendingCharges: pendentes,
    overdueCharges: atrasadas,
    pendingCents,
    overdueCents,
  };
}

export type FinancialSummary = {
  monthPrefix: string;
  grossReceivedCents: number;
  feesCents: number;
  netReceivedCents: number;
  expensesCents: number;
  netProfitCents: number;
  paymentsCount: number;
  expensesCount: number;
};

/**
 * Faturamento bruto/líquido e lucro de um mês (monthPrefix no formato
 * "YYYY-MM"). Bruto = soma dos recebimentos reais (charge_payments) no mês,
 * não das cobranças lançadas — uma cobrança "pendente" não entra na conta
 * até que um pagamento seja de fato registrado contra ela. Líquido =
 * bruto menos as taxas de maquininha/processadora descontadas nos próprios
 * recebimentos. Lucro = líquido menos os gastos operacionais do mês
 * (gastos cancelados não entram).
 */
export async function getFinancialSummary(monthPrefix: string): Promise<FinancialSummary> {
  const [payments, activeExpenses] = await Promise.all([
    db.select().from(chargePayments).where(like(chargePayments.paidAt, `${monthPrefix}%`)),
    db
      .select()
      .from(expenses)
      .where(and(like(expenses.expenseDate, `${monthPrefix}%`), eq(expenses.status, "ativo"))),
  ]);

  const grossReceivedCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const feesCents = payments.reduce((sum, p) => sum + p.feeCents, 0);
  const netReceivedCents = grossReceivedCents - feesCents;
  const expensesCents = activeExpenses.reduce((sum, e) => sum + e.valueCents, 0);
  const netProfitCents = netReceivedCents - expensesCents;

  return {
    monthPrefix,
    grossReceivedCents,
    feesCents,
    netReceivedCents,
    expensesCents,
    netProfitCents,
    paymentsCount: payments.length,
    expensesCount: activeExpenses.length,
  };
}
