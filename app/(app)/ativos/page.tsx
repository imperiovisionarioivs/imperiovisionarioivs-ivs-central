import Link from "next/link";
import { listAssets, listUpcomingRenewals, isAssetDone } from "@/lib/repo/assets";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Badge, Card, KpiCard } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((c) => [c.key, c.label]));
const STATUS_LABEL: Record<string, string> = Object.fromEntries(ASSET_STATUSES.map((s) => [s.key, s.label]));
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  a_configurar: "neutral",
  em_configuracao: "gold",
  ativo: "green",
  em_manutencao: "blue",
  pendente_cliente: "gold",
  cancelado: "red",
};

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AtivosPage() {
  const [all, upcomingRenewals] = await Promise.all([listAssets(), listUpcomingRenewals(30)]);

  const pending = all.filter((a) => !isAssetDone(a.status) && a.status !== "cancelado");
  const clientIds = [...new Set(all.map((a) => a.clientId))];
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">Ativos</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950 lg:text-3xl">
          Ativos, acessos e progresso de entrega.
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          O que já está pronto e o que ainda falta configurar, por cliente — site, landing page, redes sociais,
          domínio, hospedagem e outros acessos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Total de ativos" value={String(all.length)} sub="Cadastrados no sistema" dark />
        <KpiCard label="Pendentes" value={String(pending.length)} sub="Ainda não entregues" />
        <KpiCard label="Renovações em 30 dias" value={String(upcomingRenewals.length)} sub="Domínio, hospedagem etc." />
        <KpiCard
          label="Ativos"
          value={String(all.filter((a) => a.status === "ativo").length)}
          sub="Rodando normalmente"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Pendentes por cliente</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-ink-400">Nada pendente no momento. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/clientes/${a.clientId}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{a.name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {clientName.get(a.clientId) ?? "Cliente"} · {CATEGORY_LABEL[a.category]}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Renovações nos próximos 30 dias</h2>
          {upcomingRenewals.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhuma renovação próxima.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingRenewals.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/clientes/${a.clientId}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{a.name}</p>
                      <p className="truncate text-xs text-ink-400">{clientName.get(a.clientId) ?? "Cliente"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-ink-500">
                        {new Date(a.renewalDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      {a.recurringValueCents !== null && (
                        <span className="text-sm font-medium text-ink-700">{formatCents(a.recurringValueCents)}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
