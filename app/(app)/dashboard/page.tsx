import { KpiCard, Card, ProgressBar, Badge } from "@/components/ui";
import {
  getDashboardStats,
  getStageCounts,
  getNiches,
  getPriorityLeads,
} from "@/lib/repo/clients";
import { PRIORITIES, STAGES } from "@/lib/db/schema";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.label]));

export default async function DashboardPage() {
  const [stats, stageCounts, niches, priorityLeads] = await Promise.all([
    getDashboardStats(),
    getStageCounts(),
    getNiches(),
    getPriorityLeads(5),
  ]);

  const conversion =
    stats.total > 0 ? Math.round((stats.fechados / stats.total) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">
          Visão geral
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950 lg:text-3xl">
          Cada oportunidade, um próximo passo.
        </h1>
        <p className="mt-1 text-sm text-ink-500">Seu comercial e suas entregas, no mesmo lugar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Leads ativos" value={String(stats.emAndamento)} sub="Carteira comercial" dark />
        <KpiCard label="Fechados" value={String(stats.fechados)} sub="Contratos fechados" />
        <KpiCard
          label="Taxa de conversão"
          value={`${conversion.toLocaleString("pt-BR")}%`}
          sub="Fechados / total"
        />
        <KpiCard
          label="Diagnósticos"
          value={String(stats.diagnosticosFeitos)}
          sub="Concluídos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Funil comercial</h2>
            <Link href="/crm" className="text-xs font-medium text-gold-700 hover:underline">
              Ver Kanban
            </Link>
          </div>
          <div className="space-y-3">
            {STAGES.filter((s) => s.key !== "sem_interesse").map((stage) => {
              const count = stageCounts.get(stage.key) ?? 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={stage.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-700">{stage.label}</span>
                    <span className="text-ink-400">{count}</span>
                  </div>
                  <ProgressBar value={pct} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Prioridades para hoje</h2>
          {priorityLeads.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhum lead pendente de primeiro contato. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {priorityLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/clientes/${lead.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{lead.name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {lead.niche || "Sem nicho"} · {lead.phone || "sem telefone"}
                      </p>
                    </div>
                    <Badge tone={lead.priority === "alta" ? "gold" : "neutral"}>
                      {PRIORITY_LABEL[lead.priority] ?? lead.priority}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-900">Leads por nicho</h2>
        {niches.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhum lead cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {niches.map((n) => (
              <div key={n.niche} className="flex items-center justify-between border-b border-ink-100 pb-2 text-sm">
                <span className="truncate pr-2 text-ink-600">{n.niche}</span>
                <span className="font-semibold text-ink-900">{n.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
