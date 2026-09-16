"use server";

import { db } from "@/lib/db";
import { activities, financialCharges, subscriptions, chargePayments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/permissions";
import { todayInFortaleza } from "@/lib/date-br";
import {
  chargeCreateSchema,
  chargeStatusUpdateSchema,
  chargePaymentCreateSchema,
  subscriptionCreateSchema,
  subscriptionStatusUpdateSchema,
} from "@/lib/validation";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "cartão de crédito",
  cartao_debito: "cartão de débito",
  boleto: "boleto",
  dinheiro: "dinheiro",
  transferencia: "transferência",
  outro: "outro método",
};

export async function createSubscriptionAction(input: unknown) {
  const user = await requirePermission("finance.manage");
  const data = subscriptionCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(subscriptions)
      .values({
        clientId: data.clientId,
        contractId: data.contractId ?? null,
        name: data.name,
        monthlyValueCents: data.monthlyValueCents,
        billingCycle: data.billingCycle,
        annualDiscountMonths: data.annualDiscountMonths,
        startDate: data.startDate,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: subscriptions.id });
    if (!row) throw new Error("Falha ao criar assinatura");

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: "nota",
      message: `Assinatura criada: "${data.name}" (${formatCents(data.monthlyValueCents)}/mês)`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/financeiro");
  return { ok: true, id };
}

/**
 * Pausar/reativar uma assinatura é operação comercial de rotina
 * (finance.manage); cancelar é terminal e impacta receita reconhecida, por
 * isso exige finance.reconcile (só admin) — a mesma separação "vender" vs.
 * "conciliar dinheiro" usada nas cobranças abaixo.
 */
export async function updateSubscriptionStatusAction(input: unknown) {
  const { subscriptionId, status } = subscriptionStatusUpdateSchema.parse(input);
  const requiredPermission = status === "cancelada" ? "finance.reconcile" : "finance.manage";
  const user = await requireUser();
  if (!can(user.role, requiredPermission)) throw new ForbiddenError(requiredPermission);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!current) throw new Error("Assinatura não encontrada");
    if (current.status === "cancelada") throw new Error("Assinatura já cancelada — cancelamento é definitivo");

    await tx
      .update(subscriptions)
      .set({
        status,
        updatedAt: new Date(),
        canceledAt: status === "cancelada" ? new Date() : current.canceledAt,
      })
      .where(eq(subscriptions.id, subscriptionId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Assinatura "${current.name}" marcada como "${status}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/financeiro");
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Lança uma cobrança — mensalidade/anual recorrente OU um ajuste avulso
 * (trabalho fora do escopo do plano). O valor de um ajuste é decidido por
 * quem lança, caso a caso; o sistema não tenta adivinhar um multiplicador.
 */
export async function createChargeAction(input: unknown) {
  const user = await requirePermission("finance.manage");
  const data = chargeCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financialCharges)
      .values({
        clientId: data.clientId,
        subscriptionId: data.subscriptionId ?? null,
        type: data.type,
        description: data.description,
        valueCents: data.valueCents,
        dueDate: data.dueDate,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: financialCharges.id });
    if (!row) throw new Error("Falha ao lançar cobrança");

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: "nota",
      message: `Cobrança lançada (${data.type}): ${formatCents(data.valueCents)}${data.description ? ` — ${data.description}` : ""}`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/financeiro");
  return { ok: true, id };
}

/** Conciliação financeira manual (marcar atraso/cancelar) — restrita a
 *  admin, separada de quem só vende/lança a cobrança. "pago" e "parcial"
 *  não são alvos válidos aqui (o schema já bloqueia isso): só são
 *  alcançados registrando um recebimento real, em recordChargePaymentAction
 *  abaixo — ver o comentário em chargeManualStatusValues. */
export async function updateChargeStatusAction(input: unknown) {
  const user = await requirePermission("finance.reconcile");
  const { chargeId, status } = chargeStatusUpdateSchema.parse(input);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(financialCharges).where(eq(financialCharges.id, chargeId)).limit(1);
    if (!current) throw new Error("Cobrança não encontrada");
    if (current.status === "pago") {
      throw new Error("Uma cobrança já paga não pode ser revertida — lance um ajuste separado se necessário");
    }
    if (current.status === "cancelado" && status !== "cancelado") {
      throw new Error("Uma cobrança cancelada não pode ser reaberta — lance uma nova cobrança se necessário");
    }

    await tx.update(financialCharges).set({ status }).where(eq(financialCharges.id, chargeId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Cobrança de ${formatCents(current.valueCents)} marcada como "${status}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/financeiro");
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Registra um recebimento real (parcial ou integral) contra uma cobrança.
 * O status da cobrança é sempre recalculado a partir da soma de TODOS os
 * recebimentos já registrados contra ela — nunca definido à mão — porque é
 * isso que faz o faturamento bruto/líquido do painel corresponder a
 * dinheiro que de fato entrou, e não a uma cobrança marcada "paga" sem
 * nenhum registro por trás. Por isso este é o único caminho para uma
 * cobrança virar "pago" ou "parcial" (substituindo o antigo botão "marcar
 * pago" manual).
 */
export async function recordChargePaymentAction(input: unknown) {
  const user = await requirePermission("finance.reconcile");
  const data = chargePaymentCreateSchema.parse(input);

  const { clientId, status, totalReceived } = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(financialCharges)
      .where(eq(financialCharges.id, data.chargeId))
      .limit(1);
    if (!current) throw new Error("Cobrança não encontrada");
    if (current.status === "pago") throw new Error("Esta cobrança já está totalmente paga.");
    if (current.status === "cancelado") {
      throw new Error("Uma cobrança cancelada não pode receber pagamento — lance uma nova cobrança se necessário.");
    }

    await tx.insert(chargePayments).values({
      chargeId: data.chargeId,
      amountCents: data.amountCents,
      method: data.method,
      installments: data.method === "cartao_credito" ? data.installments ?? null : null,
      feeCents: data.feeCents,
      paidAt: data.paidAt || todayInFortaleza(),
      note: data.note,
      createdById: user.id,
      createdByName: user.name,
    });

    const existingPayments = await tx
      .select()
      .from(chargePayments)
      .where(eq(chargePayments.chargeId, data.chargeId));
    const total = existingPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const newStatus: "parcial" | "pago" = total >= current.valueCents ? "pago" : "parcial";

    await tx
      .update(financialCharges)
      .set({ status: newStatus, paidAt: newStatus === "pago" ? new Date() : current.paidAt })
      .where(eq(financialCharges.id, data.chargeId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message:
        newStatus === "pago"
          ? `Pagamento registrado: ${formatCents(data.amountCents)} via ${PAYMENT_METHOD_LABEL[data.method]} — cobrança quitada`
          : `Pagamento parcial registrado: ${formatCents(data.amountCents)} via ${PAYMENT_METHOD_LABEL[data.method]} — recebido ${formatCents(total)} de ${formatCents(current.valueCents)}`,
      actorId: user.id,
      actorName: user.name,
    });

    return { clientId: current.clientId, status: newStatus, totalReceived: total };
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/financeiro");
  revalidatePath("/clientes");
  return { ok: true, status, totalReceived };
}
