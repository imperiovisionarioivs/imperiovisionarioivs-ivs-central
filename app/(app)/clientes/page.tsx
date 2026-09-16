import { listClients, getNiches } from "@/lib/repo/clients";
import { ClientesFilters } from "@/components/clientes-filters";
import { Badge } from "@/components/ui";
import { CHECKLIST_KEYS } from "@/lib/repo/clients";
import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { PRIORITIES, STAGES } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.key, `Prioridade ${p.label.toLowerCase()}`]));
// Covers all 9 legacy stages (see lib/db/schema.ts STAGES) — a stage
// missing from this map would render with no color at all, so every key is
// listed explicitly rather than relying on a fallback.
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

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; niche?: string }>;
}) {
  const params = await searchParams;
  const [clients, niches] = await Promise.all([
    listClients({ search: params.q, niche: params.niche }),
    getNiches(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">
            Base comercial
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">Clientes</h1>
          <p className="mt-1 text-sm text-ink-500">{clients.length} registros</p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-950 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Novo lead</span>
        </Link>
      </div>

      <ClientesFilters niches={niches.map((n) => n.niche)} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clients.length === 0 ? (
          <p className="col-span-full py-10 text-center text-sm text-ink-400">
            Nenhum cliente encontrado.
          </p>
        ) : (
          clients.map((client) => {
            const done = CHECKLIST_KEYS.filter((k) => client.checklist?.[k]).length;
            return (
              <Link
                key={client.id}
                href={`/clientes/${client.id}`}
                className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition-shadow hover:shadow-soft"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink-900">{client.name}</p>
                  <Badge tone={STAGE_TONE[client.stage]}>{STAGE_LABEL[client.stage]}</Badge>
                </div>
                <p className="truncate text-xs text-ink-400">{client.niche || "Sem nicho"}</p>
                <p className="mt-1 truncate text-xs text-ink-400">
                  {client.phone || "Sem telefone"}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
                  <span>
                    {done}/{CHECKLIST_KEYS.length} etapas
                  </span>
                  <span
                    className={
                      client.priority === "alta" ? "font-medium text-gold-700" : undefined
                    }
                  >
                    {PRIORITY_LABEL[client.priority] ?? client.priority}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
