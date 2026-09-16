import Link from "next/link";
import { getFinanceOverview, listActiveSubscriptions, getFinancialSummary } from "@/lib/repo/finance";
import { listExpenses } from "@/lib/repo/expenses";
import { computeAnnualValueCents } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Badge, Card, KpiCard } from "@/components/ui";
import { ExpensePanel } from "@/components/expense-panel";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { todayInFortaleza } from "@/lib/date-br";

export const dynamic = "force-dynamic";

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

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function FinanceiroPage() {
  const user = await getCurrentUser();
  const canSeeProfitability = user ? can(user.role, "finance.reconcile") : false;
  const monthPrefix = todayInFortaleza().slice(0, 7);

  const [overview, activeSubscriptions, summary, expenseRows] = await Promise.all([
    getFinanceOverview(),
    listActiveSubscriptions(),
    canSeeProfitability ? getFinancialSummary(monthPrefix) : Promise.resolve(null),
    canSeeProfitability ? listExpenses() : Promise.resolve([]),
  ]);

  const dueCharges = [...overview.overdueCharges, ...overview.pendingCharges];
  const clientIds = [...new Set([...dueCharges.map((c) => c.clientId), ...activeSubscriptions.map((s) => s.clientId)])];
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">Financeiro</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950 lg:text-3xl">
          Assinaturas e cobranças.
        </h1>
        <p className="mt-1 text-sm text-ink-500">Receita recorrente e o que está pendente de recebimento.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="MRR estimado" value={formatCents(overview.mrrCents)} sub="Receita mensal recorrente" dark />
        <KpiCard label="Assinaturas ativas" value={String(overview.activeSubscriptionsCount)} sub="Clientes em plano" />
        <KpiCard label="A receber" value={formatCents(overview.pendingCents)} sub={`${overview.pendingCharges.length} cobrança(s) pendente(s)`} />
        <KpiCard label="Em atraso" value={formatCents(overview.overdueCents)} sub={`${overview.overdueCharges.length} cobrança(s) atrasada(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Assinaturas ativas</h2>
          {activeSubscriptions.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhuma assinatura ativa ainda.</p>
          ) : (
            <ul className="space-y-3">
              {activeSubscriptions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/clientes/${s.clientId}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{s.name}</p>
                      <p className="truncate text-xs text-ink-400">{clientName.get(s.clientId) ?? "Cliente"}</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-ink-700">
                      {formatCents(s.monthlyValueCents)}/mês
                      {s.billingCycle === "anual" && (
                        <span className="ml-1.5 text-xs font-normal text-ink-400">
                          (anual: {formatCents(computeAnnualValueCents(s.monthlyValueCents, s.annualDiscountMonths))})
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Cobranças pendentes e atrasadas</h2>
          {dueCharges.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhuma cobrança pendente. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {dueCharges.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clientes/${c.clientId}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{clientName.get(c.clientId) ?? "Cliente"}</p>
                      <p className="truncate text-xs text-ink-400">
                        {c.description || c.type}
                        {c.dueDate ? ` · vence ${c.dueDate}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium text-ink-700">{formatCents(c.valueCents)}</span>
                      <Badge tone={CHARGE_STATUS_TONE[c.status]}>{CHARGE_STATUS_LABEL[c.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canSeeProfitability && summary && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">Faturamento e lucro</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-950">
              Mês atual ({monthPrefix})
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Faturamento aqui é sempre dinheiro que de fato entrou (recebimentos registrados), não cobranças só
              lançadas. Visível apenas para quem concilia o financeiro.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            <KpiCard label="Faturamento bruto" value={formatCents(summary.grossReceivedCents)} sub={`${summary.paymentsCount} recebimento(s)`} dark />
            <KpiCard label="Taxas descontadas" value={formatCents(summary.feesCents)} sub="Maquininha/processadora" />
            <KpiCard label="Faturamento líquido" value={formatCents(summary.netReceivedCents)} sub="Bruto − taxas" />
            <KpiCard label="Gastos" value={formatCents(summary.expensesCents)} sub={`${summary.expensesCount} lançamento(s)`} />
            <KpiCard
              label="Lucro líquido"
              value={formatCents(summary.netProfitCents)}
              sub="Líquido − gastos"
              dark={summary.netProfitCents < 0}
            />
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Gastos da agência</h2>
            <ExpensePanel expenses={expenseRows} />
          </Card>
        </div>
      )}
    </div>
  );
}
