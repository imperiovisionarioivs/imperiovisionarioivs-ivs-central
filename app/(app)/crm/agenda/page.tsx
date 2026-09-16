import Link from "next/link";
import { getAgenda } from "@/lib/repo/clients";
import { Badge, Card } from "@/components/ui";
import { AgendaResultForm } from "@/components/agenda-result-form";
import { PRIORITIES } from "@/lib/db/schema";
import type { AgendaEntry } from "@/lib/repo/clients";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.label]));

const SECTIONS: { key: "atrasado" | "hoje" | "proximo" | "sem_acao"; title: string; tone: "red" | "gold" | "blue" | "neutral"; empty: string }[] = [
  { key: "atrasado", title: "Atrasados", tone: "red", empty: "Nenhum contato atrasado." },
  { key: "hoje", title: "Hoje", tone: "gold", empty: "Nada previsto para hoje." },
  { key: "proximo", title: "Próximos", tone: "blue", empty: "Nenhum próximo contato agendado." },
  { key: "sem_acao", title: "Sem próxima ação definida", tone: "neutral", empty: "Todos os leads ativos têm uma próxima ação." },
];

export default async function AgendaPage() {
  const agenda = await getAgenda();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-600">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">Agenda</h1>
          <p className="mt-1 text-sm text-ink-500">
            Atrasados, hoje e próximos contatos — horário de Fortaleza.
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1 text-sm font-medium">
        <Link href="/crm" className="flex-1 rounded-lg px-3 py-2 text-center text-ink-600 hover:bg-white/60">
          Funil
        </Link>
        <span className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-ink-900 shadow-sm">
          Agenda
        </span>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const items = agenda[section.key];
          return (
            <div key={section.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
                <Badge tone={section.tone}>{items.length}</Badge>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-ink-400">{section.empty}</p>
              ) : (
                <div className="space-y-2">
                  {items.map((client) => (
                    <AgendaCard key={client.id} client={client} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaCard({ client }: { client: AgendaEntry }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/clientes/${client.id}`} className="truncate text-sm font-medium text-ink-900 hover:underline">
            {client.name}
          </Link>
          <p className="truncate text-xs text-ink-400">
            {client.niche || "Sem nicho"} · {client.phone || "sem telefone"}
          </p>
          {client.nextAction && (
            <p className="mt-1 truncate text-xs text-ink-600">Próxima ação: {client.nextAction}</p>
          )}
          {client.lastContactResult && (
            <p className="mt-0.5 truncate text-xs text-ink-400">Último resultado: {client.lastContactResult}</p>
          )}
        </div>
        <Badge tone={client.priority === "alta" ? "gold" : "neutral"}>
          {PRIORITY_LABEL[client.priority] ?? client.priority}
        </Badge>
      </div>
      <div className="mt-2">
        <AgendaResultForm clientId={client.id} />
      </div>
    </Card>
  );
}
