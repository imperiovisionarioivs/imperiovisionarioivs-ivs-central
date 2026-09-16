import Link from "next/link";
import { listContracts } from "@/lib/repo/contracts";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
  encerrado: "Encerrado",
};
const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "blue"> = {
  rascunho: "neutral",
  enviado: "blue",
  assinado: "green",
  encerrado: "red",
};

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ContratosPage() {
  const contracts = await listContracts();
  const clientIds = [...new Set(contracts.map((c) => c.clientId))];
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  const totals = contracts.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.status === "assinado") acc.assinados += 1;
      if (c.status === "enviado") acc.enviados += 1;
      return acc;
    },
    { total: 0, assinados: 0, enviados: 0 }
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-950">Contratos</h1>
        <p className="text-sm text-ink-500">
          {totals.total} contrato(s) · {totals.enviados} aguardando assinatura · {totals.assinados} assinado(s)
        </p>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-500">
            Nenhum contrato criado ainda. Crie o primeiro a partir da página de um cliente, geralmente a partir de
            uma proposta aceita.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {contracts.map((c) => (
            <Link key={c.id} href={`/clientes/${c.clientId}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{c.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {clientName.get(c.clientId) ?? "Cliente"} · {formatCents(c.valueCents)}
                      {c.signedAt ? ` · assinado em ${new Date(c.signedAt).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
