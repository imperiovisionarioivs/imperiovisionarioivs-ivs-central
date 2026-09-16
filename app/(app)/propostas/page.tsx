import Link from "next/link";
import { listLatestProposals } from "@/lib/repo/proposals";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  rascunho: "neutral",
  enviada: "blue",
  aceita: "green",
  recusada: "red",
};

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PropostasPage() {
  const proposals = await listLatestProposals();
  const clientIds = [...new Set(proposals.map((p) => p.clientId))];
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  const totals = proposals.reduce(
    (acc, p) => {
      acc.total += 1;
      if (p.status === "aceita") acc.aceitas += 1;
      if (p.status === "enviada") acc.enviadas += 1;
      return acc;
    },
    { total: 0, aceitas: 0, enviadas: 0 }
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-950">Propostas</h1>
        <p className="text-sm text-ink-500">
          {totals.total} proposta(s) ativa(s) · {totals.enviadas} enviada(s) · {totals.aceitas} aceita(s)
        </p>
      </div>

      {proposals.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500">
            Nenhuma proposta criada ainda. Crie a primeira a partir da página de um cliente.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {proposals.map((p) => (
            <Link key={p.id} href={`/clientes/${p.clientId}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{p.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {clientName.get(p.clientId) ?? "Cliente"} · Rev. {p.revisionNumber} · {formatCents(p.valueCents)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
