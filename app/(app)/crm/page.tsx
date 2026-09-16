import { listClients } from "@/lib/repo/clients";
import { STAGES } from "@/lib/db/schema";
import { Badge } from "@/components/ui";
import { StageSelect } from "@/components/stage-select";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Covers all 9 legacy stages (see lib/db/schema.ts STAGES).
const STAGE_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  nao_contatado: "neutral",
  diagnostico_feito: "blue",
  visitado: "blue",
  whatsapp_enviado: "blue",
  ligacao_feita: "blue",
  reuniao_marcada: "gold",
  proposta_enviada: "gold",
  fechado: "green",
  sem_interesse: "red",
};

export default async function CrmPage() {
  const clients = await listClients();

  const byStage = new Map<string, typeof clients>();
  for (const stage of STAGES) byStage.set(stage.key, []);
  for (const c of clients) {
    byStage.get(c.stage)?.push(c);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">CRM</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Funil comercial
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {clients.length} oportunidades na carteira · use o seletor de cada card para mover de
          etapa
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1 text-sm font-medium">
        <span className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-ink-900 shadow-sm">
          Funil
        </span>
        <Link href="/crm/agenda" className="flex-1 rounded-lg px-3 py-2 text-center text-ink-600 hover:bg-white/60">
          Agenda
        </Link>
      </div>

      <div className="kanban-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
        {STAGES.map((stage) => {
          const items = byStage.get(stage.key) ?? [];
          return (
            <div
              key={stage.key}
              className="kanban-col w-[280px] shrink-0 rounded-2xl border border-ink-100 bg-white/60"
            >
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-ink-800">{stage.label}</h2>
                <Badge tone={STAGE_TONE[stage.key]}>{items.length}</Badge>
              </div>
              <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3">
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-ink-300">Vazio</p>
                ) : (
                  items.map((client) => (
                    <div
                      key={client.id}
                      className="space-y-2 rounded-xl border border-ink-100 bg-white p-3 shadow-card"
                    >
                      <Link href={`/clientes/${client.id}`} className="block">
                        <p className="truncate text-sm font-medium text-ink-900">{client.name}</p>
                        <p className="truncate text-xs text-ink-400">
                          {client.niche || "Sem nicho"}
                        </p>
                      </Link>
                      <StageSelect clientId={client.id} currentStage={client.stage} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
