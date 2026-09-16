/**
 * Business-date helpers pinned to America/Fortaleza (UTC-3, no DST) — the
 * Agenda view's "atrasado/hoje/próximo" buckets must use the AGENCY's
 * calendar day, not the server's or the visitor's browser timezone (a
 * server running in UTC would otherwise consider "today" to roll over 3
 * hours before it actually does in Fortaleza, misclassifying items).
 */
const TIMEZONE = "America/Fortaleza";

/** Today's date in America/Fortaleza as "YYYY-MM-DD". */
export function todayInFortaleza(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/** Parses a stored nextActionDate ("YYYY-MM-DD", possibly with time, or
 *  loosely formatted from legacy data) into a comparable "YYYY-MM-DD"
 *  string, or null when absent/unparseable. Comparison is done on the date
 *  string itself (lexicographic order matches chronological order for
 *  ISO-formatted dates), never on a parsed Date + local timezone, to avoid
 *  reintroducing a timezone bug at the comparison site.
 */
export function normalizeDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1] ?? null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(parsed);
}

export type AgendaBucket = "atrasado" | "hoje" | "proximo" | "sem_acao";

export function bucketFor(dateKey: string | null, today: string): AgendaBucket {
  if (!dateKey) return "sem_acao";
  if (dateKey < today) return "atrasado";
  if (dateKey === today) return "hoje";
  return "proximo";
}
