import "server-only";
import { db } from "@/lib/db";
import { activities, clients } from "@/lib/db/schema";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { CHECKLIST_STEPS, PRIORITIES } from "@/lib/db/schema";
import { bucketFor, normalizeDateKey, todayInFortaleza, type AgendaBucket } from "@/lib/date-br";

export type ClientRow = typeof clients.$inferSelect;

// PRIORITIES.order is the single source of truth for business ordering
// (alta, media, confirmar, baixa). We must NOT sort by the enum/text value
// itself — Postgres and JS both sort "alta" < "baixa" < "confirmar" <
// "media" alphabetically, which would put "baixa" ahead of "media" and
// "confirmar", silently misprioritizing the list. This builds an explicit
// CASE expression from PRIORITIES so the SQL order always matches the
// canonical order, with no risk of drifting from it.
const priorityOrderExpr = sql`case ${clients.priority} ${sql.join(
  PRIORITIES.map((p) => sql`when ${p.key} then ${p.order}`),
  sql` `
)} else 99 end`;

export async function listClients(opts?: {
  stage?: string;
  niche?: string;
  search?: string;
  includeArchived?: boolean;
}) {
  const conditions = [];
  if (!opts?.includeArchived) conditions.push(eq(clients.archived, false));
  if (opts?.stage) conditions.push(eq(clients.stage, opts.stage as ClientRow["stage"]));
  if (opts?.niche) conditions.push(eq(clients.niche, opts.niche));
  if (opts?.search) {
    conditions.push(
      or(ilike(clients.name, `%${opts.search}%`), ilike(clients.phone, `%${opts.search}%`))
    );
  }

  return db
    .select()
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(priorityOrderExpr), clients.name);
}

export async function getClient(id: number) {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getClientActivities(clientId: number) {
  return db
    .select()
    .from(activities)
    .where(eq(activities.clientId, clientId))
    .orderBy(desc(activities.createdAt));
}

export async function getNiches() {
  const rows = await db
    .select({ niche: clients.niche, count: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.archived, false))
    .groupBy(clients.niche)
    .orderBy(desc(sql`count(*)`));
  return rows.filter((r) => r.niche);
}

export async function getDashboardStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fechados: sql<number>`count(*) filter (where ${clients.stage} = 'fechado')::int`,
      emAndamento: sql<number>`count(*) filter (where ${clients.stage} not in ('fechado','sem_interesse'))::int`,
      diagnosticosFeitos: sql<number>`count(*) filter (where (${clients.checklist}->>'diagnosisDone') = 'true')::int`,
    })
    .from(clients)
    .where(eq(clients.archived, false));

  return (
    row ?? { total: 0, fechados: 0, emAndamento: 0, diagnosticosFeitos: 0 }
  );
}

export const CHECKLIST_KEYS = CHECKLIST_STEPS.map((s) => s.key);

export async function getStageCounts() {
  const rows = await db
    .select({ stage: clients.stage, count: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.archived, false))
    .groupBy(clients.stage);

  const map = new Map(rows.map((r) => [r.stage, r.count]));
  return map;
}

export async function getPriorityLeads(limit = 5) {
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.archived, false), eq(clients.stage, "nao_contatado")))
    .orderBy(asc(priorityOrderExpr), clients.name)
    .limit(limit);
}

/**
 * Prospecção por nicho e fila semanal: agrupa os clientes ainda não
 * fechados/perdidos por nicho, e dentro de cada nicho ordena pela fila de
 * visita da semana (visitOrder, depois suggestedDay) — ambos campos
 * preservados da migração legada, mas que a versão anterior deste app não
 * expunha em nenhuma tela.
 */
export type ProspectionGroup = { niche: string; clients: ClientRow[] };

export async function getProspectionQueue(): Promise<ProspectionGroup[]> {
  const rows = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.archived, false), ne(clients.stage, "fechado"), ne(clients.stage, "sem_interesse"))
    )
    .orderBy(asc(clients.niche), asc(clients.visitOrder), asc(priorityOrderExpr), clients.name);

  const groups = new Map<string, ClientRow[]>();
  for (const row of rows) {
    const key = row.niche || "Sem nicho definido";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([niche, list]) => ({ niche, clients: list }));
}

export type AgendaEntry = ClientRow & { agendaBucket: AgendaBucket; agendaDateKey: string | null };

/**
 * CRM → Agenda: buckets active (non-closed, non-archived) clients into
 * atrasado/hoje/próximo/sem_acao using nextActionDate compared against
 * "today" in America/Fortaleza — see lib/date-br.ts for why the timezone
 * matters here specifically (the agency's business day, not the server's).
 */
export async function getAgenda(): Promise<Record<AgendaBucket, AgendaEntry[]>> {
  const today = todayInFortaleza();
  const rows = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.archived, false), ne(clients.stage, "fechado"), ne(clients.stage, "sem_interesse"))
    )
    .orderBy(asc(priorityOrderExpr), clients.name);

  const buckets: Record<AgendaBucket, AgendaEntry[]> = {
    atrasado: [],
    hoje: [],
    proximo: [],
    sem_acao: [],
  };

  for (const row of rows) {
    const dateKey = normalizeDateKey(row.nextActionDate);
    const bucket = bucketFor(dateKey, today);
    buckets[bucket].push({ ...row, agendaBucket: bucket, agendaDateKey: dateKey });
  }

  // Dentro de "próximo", ordena pela data mais próxima primeiro (a query
  // acima já ordena por prioridade — reordenamos apenas este balde por
  // data, que é o que importa para "o que vem a seguir").
  buckets.proximo.sort((a, b) => (a.agendaDateKey ?? "").localeCompare(b.agendaDateKey ?? ""));

  return buckets;
}
