"use client";

import { useState, useTransition } from "react";
import {
  createChargeAction,
  createSubscriptionAction,
  updateChargeStatusAction,
  updateSubscriptionStatusAction,
  recordChargePaymentAction,
} from "@/app/actions/finance";
import { computeAnnualValueCents } from "@/lib/db/schema";
import { Badge, Button } from "./ui";
import type { SubscriptionRow, ChargeRow, ChargePaymentRow } from "@/lib/repo/finance";
import type { ContractRow } from "@/lib/repo/contracts";

const SUB_STATUS_LABEL: Record<string, string> = { ativa: "Ativa", pausada: "Pausada", cancelada: "Cancelada" };
const SUB_STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  ativa: "green",
  pausada: "gold",
  cancelada: "red",
};
const CHARGE_TYPE_LABEL: Record<string, string> = {
  mensalidade: "Mensalidade",
  anual: "Anual",
  ajuste: "Ajuste avulso",
  outro: "Outro",
};
const CHARGE_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};
const CHARGE_STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  pendente: "blue",
  parcial: "gold",
  pago: "green",
  atrasado: "red",
  cancelado: "neutral",
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outro: "Outro",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NewSubscriptionForm({
  clientId,
  contracts,
  onDone,
}: {
  clientId: number;
  contracts: ContractRow[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ monthly: number; discount: number } | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const monthly = Math.round(Number(String(formData.get("monthly")).replace(",", ".")) * 100);
        const contractIdRaw = String(formData.get("contractId") ?? "");
        await createSubscriptionAction({
          clientId,
          contractId: contractIdRaw ? Number(contractIdRaw) : null,
          name: formData.get("name"),
          monthlyValueCents: monthly,
          billingCycle: formData.get("billingCycle"),
          annualDiscountMonths: Number(formData.get("annualDiscountMonths") ?? 2),
          startDate: formData.get("startDate"),
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <input
        name="name"
        required
        placeholder="Nome do plano (ex: Manutenção do site)"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      {contracts.length > 0 && (
        <label className="flex flex-col gap-1 text-[11px] text-ink-500">
          Vincular a um contrato (opcional)
          <select
            name="contractId"
            defaultValue=""
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
          >
            <option value="">Sem vínculo com contrato</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          name="monthly"
          required
          inputMode="decimal"
          placeholder="Valor mensal (R$)"
          onChange={(e) => {
            const v = Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0;
            setPreview((p) => ({ monthly: v, discount: p?.discount ?? 2 }));
          }}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <select
          name="billingCycle"
          defaultValue="mensal"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        >
          <option value="mensal">Ciclo mensal</option>
          <option value="anual">Ciclo anual (à vista, com desconto)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs text-ink-500">
          Meses de desconto no anual
          <input
            name="annualDiscountMonths"
            type="number"
            min={0}
            max={11}
            defaultValue={2}
            onChange={(e) => setPreview((p) => ({ monthly: p?.monthly ?? 0, discount: Number(e.target.value) || 0 }))}
            className="w-16 rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm outline-none focus:border-gold-400"
          />
        </label>
        <input
          type="date"
          name="startDate"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      {preview && preview.monthly > 0 && (
        <p className="text-xs text-ink-500">
          Anual à vista: {formatCents(computeAnnualValueCents(preview.monthly, preview.discount))} (equivalente a{" "}
          {12 - preview.discount} mensalidades, {preview.discount} de desconto)
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Criar assinatura"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function NewChargeForm({
  clientId,
  subscriptions,
  onDone,
}: {
  clientId: number;
  subscriptions: SubscriptionRow[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const subId = String(formData.get("subscriptionId") ?? "");
        await createChargeAction({
          clientId,
          subscriptionId: subId ? Number(subId) : null,
          type: formData.get("type"),
          description: formData.get("description"),
          valueCents: Math.round(Number(String(formData.get("value")).replace(",", ".")) * 100),
          dueDate: formData.get("dueDate"),
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          name="type"
          defaultValue="ajuste"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        >
          <option value="ajuste">Ajuste avulso</option>
          <option value="mensalidade">Mensalidade</option>
          <option value="anual">Anual</option>
          <option value="outro">Outro</option>
        </select>
        {subscriptions.length > 0 && (
          <select
            name="subscriptionId"
            defaultValue=""
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
          >
            <option value="">Sem assinatura vinculada</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <input
        name="description"
        placeholder="Descrição (ex: ajuste de layout fora do escopo)"
        className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="value"
          required
          inputMode="decimal"
          placeholder="Valor (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          type="date"
          name="dueDate"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Lançar cobrança"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function RecordPaymentForm({
  charge,
  remainingCents,
  onDone,
}: {
  charge: ChargeRow;
  remainingCents: number;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("pix");
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const installmentsRaw = String(formData.get("installments") ?? "").trim();
        const feeRaw = String(formData.get("fee") ?? "").replace(",", ".").trim();
        await recordChargePaymentAction({
          chargeId: charge.id,
          amountCents: Math.round(Number(String(formData.get("amount")).replace(",", ".")) * 100),
          method: formData.get("method"),
          installments: method === "cartao_credito" && installmentsRaw ? Number(installmentsRaw) : null,
          feeCents: feeRaw ? Math.round(Number(feeRaw) * 100) : 0,
          paidAt: formData.get("paidAt"),
          note: formData.get("note"),
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível registrar o pagamento.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2.5 rounded-xl border border-gold-300/60 bg-gold-50/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          name="amount"
          required
          inputMode="decimal"
          defaultValue={(remainingCents / 100).toFixed(2).replace(".", ",")}
          placeholder="Valor recebido (R$)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        >
          {Object.entries(PAYMENT_METHOD_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {method === "cartao_credito" && (
          <input
            name="installments"
            type="number"
            min={1}
            max={24}
            placeholder="Parcelas"
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
          />
        )}
        <input
          name="fee"
          inputMode="decimal"
          placeholder="Taxa descontada (R$, opcional)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          name="paidAt"
          defaultValue={today}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
        <input
          name="note"
          placeholder="Observação (opcional)"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Registrando..." : "Registrar pagamento"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function FinancePanel({
  clientId,
  subscriptions,
  charges,
  contracts,
  paymentsByCharge,
  canManage,
  canReconcile,
}: {
  clientId: number;
  subscriptions: SubscriptionRow[];
  charges: ChargeRow[];
  contracts: ContractRow[];
  paymentsByCharge: Record<number, ChargePaymentRow[]>;
  canManage: boolean;
  canReconcile: boolean;
}) {
  const [openForm, setOpenForm] = useState<"none" | "subscription" | "charge">("none");
  const [recordingChargeId, setRecordingChargeId] = useState<number | null>(null);
  const contractTitleById = new Map(contracts.map((c) => [c.id, c.title]));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setSubStatus(subscriptionId: number, status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateSubscriptionStatusAction({ subscriptionId, status });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  function setChargeStatus(chargeId: number, status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateChargeStatusAction({ chargeId, status });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Assinaturas</p>
        {subscriptions.length === 0 && <p className="text-sm text-ink-500">Nenhuma assinatura ativa.</p>}
        <div className="space-y-2">
          {subscriptions.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">{s.name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatCents(s.monthlyValueCents)}/mês
                    {s.billingCycle === "anual"
                      ? ` · anual: ${formatCents(computeAnnualValueCents(s.monthlyValueCents, s.annualDiscountMonths))}`
                      : ""}
                    {s.contractId && contractTitleById.has(s.contractId)
                      ? ` · contrato: ${contractTitleById.get(s.contractId)}`
                      : ""}
                  </p>
                </div>
                <Badge tone={SUB_STATUS_TONE[s.status]}>{SUB_STATUS_LABEL[s.status]}</Badge>
              </div>
              {canManage && s.status !== "cancelada" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.status === "ativa" && (
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setSubStatus(s.id, "pausada")}>
                      Pausar
                    </Button>
                  )}
                  {s.status === "pausada" && (
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setSubStatus(s.id, "ativa")}>
                      Reativar
                    </Button>
                  )}
                  {canReconcile && (
                    <Button size="sm" variant="danger" disabled={isPending} onClick={() => setSubStatus(s.id, "cancelada")}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {canManage && openForm === "subscription" && (
          <div className="mt-2">
            <NewSubscriptionForm clientId={clientId} contracts={contracts} onDone={() => setOpenForm("none")} />
          </div>
        )}
        {canManage && openForm === "none" && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOpenForm("subscription")}>
            Nova assinatura
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Cobranças</p>
        {charges.length === 0 && <p className="text-sm text-ink-500">Nenhuma cobrança lançada ainda.</p>}
        <div className="space-y-1.5">
          {charges.map((c) => {
            const payments = paymentsByCharge[c.id] ?? [];
            const totalReceived = payments.reduce((sum, p) => sum + p.amountCents, 0);
            const remaining = Math.max(0, c.valueCents - totalReceived);
            const canReceivePayment = c.status === "pendente" || c.status === "atrasado" || c.status === "parcial";

            return (
              <div key={c.id} className="rounded-lg bg-ink-50/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-800">
                      {CHARGE_TYPE_LABEL[c.type]} — {formatCents(c.valueCents)}
                      {c.dueDate ? ` · vence ${c.dueDate}` : ""}
                    </p>
                    {c.description && <p className="truncate text-xs text-ink-500">{c.description}</p>}
                    {c.status === "parcial" && (
                      <p className="truncate text-xs font-medium text-gold-700">
                        Recebido {formatCents(totalReceived)} de {formatCents(c.valueCents)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={CHARGE_STATUS_TONE[c.status]}>{CHARGE_STATUS_LABEL[c.status]}</Badge>
                    {canReconcile && canReceivePayment && (
                      <>
                        <button
                          className="text-xs font-medium text-emerald-700 hover:underline"
                          disabled={isPending}
                          onClick={() => setRecordingChargeId(recordingChargeId === c.id ? null : c.id)}
                        >
                          Registrar pagamento
                        </button>
                        {c.status !== "atrasado" && (
                          <button
                            className="text-xs font-medium text-red-700 hover:underline"
                            disabled={isPending}
                            onClick={() => setChargeStatus(c.id, "atrasado")}
                          >
                            Atrasado
                          </button>
                        )}
                        <button
                          className="text-xs font-medium text-ink-400 hover:underline"
                          disabled={isPending}
                          onClick={() => setChargeStatus(c.id, "cancelado")}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {payments.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-ink-100 pt-1.5">
                    {payments.map((p) => (
                      <li key={p.id} className="text-xs text-ink-500">
                        {formatCents(p.amountCents)} via {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                        {p.method === "cartao_credito" && p.installments ? ` (${p.installments}x)` : ""}
                        {p.feeCents > 0 ? ` · taxa ${formatCents(p.feeCents)}` : ""}
                        {p.paidAt ? ` · ${new Date(p.paidAt + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {canReconcile && recordingChargeId === c.id && (
                  <div className="mt-2">
                    <RecordPaymentForm
                      charge={c}
                      remainingCents={remaining}
                      onDone={() => setRecordingChargeId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {canManage && openForm === "charge" && (
          <div className="mt-2">
            <NewChargeForm clientId={clientId} subscriptions={subscriptions} onDone={() => setOpenForm("none")} />
          </div>
        )}
        {canManage && openForm === "none" && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOpenForm("charge")}>
            Lançar cobrança / ajuste
          </Button>
        )}
      </div>
    </div>
  );
}
