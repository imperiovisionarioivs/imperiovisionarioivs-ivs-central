import Link from "next/link";
import { getProspectionQueue } from "@/lib/repo/clients";
import { PRIORITIES } from "@/lib/db/schema";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.label]));
const PRIORITY_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  alta: "red",
  media: "gold",
  confirmar: "blue",
  baixa: "neutral",
};

export default async function ProspeccaoPage() {
  const groups = await getProspectionQueue();
  const total = groups.reduce((n, g) => n + g.clients.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-950">Prospecção</h1>
        <p className="text-sm text-ink-500">
          {total} lead(s) ativo(s) em {groups.length} nicho(s) — ordenados pela fila de visita da semana
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500">Nenhum lead ativo no momento.</p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.niche}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-900">{group.niche}</p>
              <span className="text-xs text-ink-400">{group.clients.length} lead(s)</span>
            </div>
            <div className="divide-y divide-ink-100">
              {group.clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-ink-50/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{c.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {c.visitOrder != null ? `Ordem de visita: ${c.visitOrder}` : "Sem ordem definida"}
                      {c.suggestedDay ? ` · Dia sugerido: ${c.suggestedDay}` : ""}
                    </p>
                  </div>
                  <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
