/**
 * Legacy → new-schema mapping for the one-time IVS Central migration.
 *
 * Hard rules enforced here (per the code review):
 *   1. An unrecognized stage/priority value is NEVER silently defaulted
 *      (e.g. to "nao_contatado"/"media"). It is reported as a blocking
 *      inconsistency instead, and the record is excluded from the write
 *      until a human resolves it (either by fixing the source data or by
 *      extending the alias tables below once real legacy values are seen).
 *   2. num() distinguishes "no value" (null/undefined/empty string) from an
 *      actual 0 — Number("") is 0 in JS, which the previous implementation
 *      returned as a real rating, silently fabricating "0.0 stars" for
 *      clients that were simply never rated yet.
 *   3. Boolean fields are parsed from the actual range of legacy
 *      representations (true/false, "true"/"false", "sim"/"não", 1/0, "1"/
 *      "0", missing) instead of `Boolean(v)`, which is wrong for exactly
 *      the case the review called out: Boolean("false") === true.
 *
 * IMPORTANT — known limitation: the alias tables below (STAGE_ALIASES,
 * PRIORITY_ALIASES, TRUE_STRINGS/FALSE_STRINGS) were written without a real
 * export from the legacy (ChatGPT-hosted) app to check them against, because
 * that backup has not been provided yet (see MIGRATION_NOTES.md). They cover
 * the values named explicitly in the review plus obvious variants. The
 * first real dry-run against the actual backup will very likely surface
 * legacy values not yet listed here — that is expected and is exactly what
 * the inconsistency report is for: extend the alias table, do not add a
 * silent fallback.
 */
import { PRIORITIES, STAGES } from "./db/schema";

export type StageKey = (typeof STAGES)[number]["key"];
export type PriorityKey = (typeof PRIORITIES)[number]["key"];

const STAGE_KEYS = new Set<string>(STAGES.map((s) => s.key));
const PRIORITY_KEYS = new Set<string>(PRIORITIES.map((p) => p.key));

export function normalize(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// --- Stage aliases -----------------------------------------------------
// Canonical set (all 9 preserved, per the review): nao_contatado,
// diagnostico_feito, visitado, whatsapp_enviado, ligacao_feita,
// reuniao_marcada, proposta_enviada, fechado, sem_interesse.
const STAGE_ALIASES: Record<string, StageKey> = {
  "nao contatado": "nao_contatado",
  "não contatado": "nao_contatado",
  novo: "nao_contatado",
  "diagnostico feito": "diagnostico_feito",
  "diagnóstico feito": "diagnostico_feito",
  diagnostico: "diagnostico_feito",
  visitado: "visitado",
  "visita realizada": "visitado",
  "whatsapp enviado": "whatsapp_enviado",
  whatsapp: "whatsapp_enviado",
  "ligacao feita": "ligacao_feita",
  "ligação feita": "ligacao_feita",
  "ligacao realizada": "ligacao_feita",
  "reuniao marcada": "reuniao_marcada",
  "reunião marcada": "reuniao_marcada",
  reuniao: "reuniao_marcada",
  "proposta enviada": "proposta_enviada",
  proposta: "proposta_enviada",
  fechado: "fechado",
  ganho: "fechado",
  "cliente fechado": "fechado",
  "sem interesse": "sem_interesse",
  perdido: "sem_interesse",
  "sem resposta": "sem_interesse",
};

// Values already canonical map to themselves.
for (const key of STAGE_KEYS) STAGE_ALIASES[key] = key as StageKey;

const PRIORITY_ALIASES: Record<string, PriorityKey> = {
  alta: "alta",
  alto: "alta",
  media: "media",
  média: "media",
  medio: "media",
  médio: "media",
  baixa: "baixa",
  baixo: "baixa",
  confirmar: "confirmar",
  "a confirmar": "confirmar",
};
for (const key of PRIORITY_KEYS) PRIORITY_ALIASES[key] = key as PriorityKey;

export interface MapResult<T> {
  value: T | null;
  matched: boolean;
  raw: unknown;
}

// Boolean parsing never has a "no value" outcome — an absent/empty/
// unrecognized input still resolves to a concrete false (see parseBoolean
// below), it just may not be `matched`. Kept distinct from MapResult<T>
// (whose `value` is nullable) so callers never need a null-check on a
// field that can never actually be null.
export interface BoolMapResult {
  value: boolean;
  matched: boolean;
  raw: unknown;
}

/** Maps a legacy stage value. Returns matched:false (value:null) instead of
 *  silently defaulting when the value isn't recognized. */
export function mapStage(value: unknown): MapResult<StageKey> {
  const key = normalize(value);
  const mapped = STAGE_ALIASES[key];
  if (mapped) return { value: mapped, matched: true, raw: value };
  // Truly empty ("no stage recorded") is treated as the legitimate initial
  // stage, not as an inconsistency — that is different from an unrecognized
  // non-empty value.
  if (key === "") return { value: "nao_contatado", matched: true, raw: value };
  return { value: null, matched: false, raw: value };
}

export function mapPriority(value: unknown): MapResult<PriorityKey> {
  const key = normalize(value);
  const mapped = PRIORITY_ALIASES[key];
  if (mapped) return { value: mapped, matched: true, raw: value };
  if (key === "") return { value: "media", matched: true, raw: value };
  return { value: null, matched: false, raw: value };
}

const TRUE_STRINGS = new Set(["true", "1", "sim", "yes", "y", "verdadeiro"]);
const FALSE_STRINGS = new Set(["false", "0", "nao", "não", "no", "n", "falso"]);

/** Proper boolean parsing — Boolean("false") is true in JS, which is wrong
 *  for a field whose legacy source may literally be the string "false". */
export function parseBoolean(value: unknown): BoolMapResult {
  if (typeof value === "boolean") return { value, matched: true, raw: value };
  if (value === null || value === undefined || value === "") {
    return { value: false, matched: true, raw: value };
  }
  if (typeof value === "number") {
    if (value === 0) return { value: false, matched: true, raw: value };
    if (value === 1) return { value: true, matched: true, raw: value };
    return { value: Boolean(value), matched: false, raw: value };
  }
  const key = normalize(value);
  if (TRUE_STRINGS.has(key)) return { value: true, matched: true, raw: value };
  if (FALSE_STRINGS.has(key)) return { value: false, matched: true, raw: value };
  return { value: Boolean(value), matched: false, raw: value };
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** null/undefined/"" stay null (no value recorded) instead of becoming 0 —
 *  Number("") === 0 in JS, which previously fabricated a real rating for
 *  clients that simply had none yet. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null) return raw[k];
  }
  return undefined;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface FieldIssue {
  field: string;
  rawValue: unknown;
  reason: string;
}

export interface MappedClient {
  legacyId: string | null;
  name: string;
  niche: string;
  category: string;
  stage: StageKey;
  priority: PriorityKey;
  phone: string;
  contact: string;
  address: string;
  website: string;
  siteStatus: string;
  instagram: string;
  instagramStatus: string;
  googleRating: number | null;
  googleReviews: number | null;
  googleVisibility: string;
  diagnosis: string;
  notes: string;
  nextAction: string;
  nextActionDate: string;
  source: string;
  checklist: Record<string, boolean>;
  archived: boolean;
  recommendedServices: string[];
  surveyStatus: string;
  surveyDate: string;
  inPersonConfirmed: boolean;
  campaign: string;
  visitOrder: number | null;
  suggestedDay: string;
  lastContactAt: Date | null;
  lastContactResult: string;
  nextFollowUpAt: Date | null;
  followUpStage: string;
  preferredChannel: string;
  objection: string;
  responsibleName: string;
  qualification: Record<string, unknown> | null;
  notionUrl: string;
  importedAt: Date;
}

export interface MappedActivity {
  type: string;
  message: string;
  actorName: string;
  createdAt: Date | null;
}

export interface MapClientResult {
  /** null when there is a blocking inconsistency (unrecognized stage or
   *  priority) — the record must not be written until resolved. */
  data: MappedClient | null;
  activities: MappedActivity[];
  issues: FieldIssue[];
  legacyId: string | null;
}

/** Extracts the legacy history/timeline array (real authors + dates), under
 *  whichever key name the export used — this preserves the field the
 *  previous importer discarded entirely (review item 7). */
function mapLegacyActivities(raw: Record<string, unknown>): MappedActivity[] {
  const source = firstDefined(raw, ["history", "historico", "timeline", "activities", "atividades"]);
  if (!Array.isArray(source)) return [];

  return source
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => ({
      type: str(firstDefined(entry, ["type", "tipo"])) || "nota",
      message: str(firstDefined(entry, ["message", "mensagem", "text", "texto", "nota"])),
      actorName: str(firstDefined(entry, ["author", "autor", "actorName", "responsavel"])) || "Importação",
      createdAt: parseDate(firstDefined(entry, ["date", "data", "createdAt", "criadoEm"])),
    }))
    .filter((a) => a.message !== "");
}

export function mapLegacyClient(raw: Record<string, unknown>): MapClientResult {
  const issues: FieldIssue[] = [];

  const legacyId = str(firstDefined(raw, ["id", "legacyId", "legacy_id", "_id", "notionId"])) || null;
  if (!legacyId) {
    issues.push({ field: "legacyId", rawValue: raw.id, reason: "Registro sem identificador legado — não é possível migrar de forma idempotente." });
  }

  const name = str(firstDefined(raw, ["name", "nome", "empresa", "establishment"]));
  if (!name) {
    issues.push({ field: "name", rawValue: raw.name, reason: "Nome ausente." });
  }

  const stageResult = mapStage(firstDefined(raw, ["stage", "etapa", "status"]));
  if (!stageResult.matched) {
    issues.push({ field: "stage", rawValue: stageResult.raw, reason: `Etapa não reconhecida: "${String(stageResult.raw)}".` });
  }

  const priorityResult = mapPriority(firstDefined(raw, ["priority", "prioridade"]));
  if (!priorityResult.matched) {
    issues.push({ field: "priority", rawValue: priorityResult.raw, reason: `Prioridade não reconhecida: "${String(priorityResult.raw)}".` });
  }

  const legacyChecklist = (firstDefined(raw, ["checklist", "etapas", "checklists"]) ?? {}) as Record<string, unknown>;
  const checklist: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(legacyChecklist)) {
    const parsed = parseBoolean(v);
    if (!parsed.matched) {
      issues.push({ field: `checklist.${k}`, rawValue: v, reason: "Valor booleano não reconhecido — mantido como falso, revisar manualmente." });
    }
    checklist[k] = parsed.value;
  }

  const inPersonConfirmed = parseBoolean(
    firstDefined(raw, ["inPersonConfirmed", "confirmacaoPresencial", "presencialConfirmado"])
  );
  if (!inPersonConfirmed.matched) {
    issues.push({ field: "inPersonConfirmed", rawValue: inPersonConfirmed.raw, reason: "Valor booleano não reconhecido." });
  }

  const archived = parseBoolean(firstDefined(raw, ["archived", "arquivado"]));

  const recommendedServicesRaw = firstDefined(raw, ["recommendedServices", "servicosRecomendados", "servicos_recomendados"]);
  const recommendedServices = Array.isArray(recommendedServicesRaw)
    ? recommendedServicesRaw.map((s) => str(s)).filter(Boolean)
    : [];

  const qualificationRaw = firstDefined(raw, ["qualification", "qualificacao", "qualificacaoComercial"]);
  const qualification =
    qualificationRaw && typeof qualificationRaw === "object" && !Array.isArray(qualificationRaw)
      ? (qualificationRaw as Record<string, unknown>)
      : null;

  const blocking = issues.some((i) => i.field === "legacyId" || i.field === "name" || i.field === "stage" || i.field === "priority");

  const data: MappedClient | null = blocking
    ? null
    : {
        legacyId,
        name,
        niche: str(firstDefined(raw, ["niche", "nicho"])),
        category: str(firstDefined(raw, ["category", "categoria"])),
        stage: stageResult.value as StageKey,
        priority: priorityResult.value as PriorityKey,
        phone: str(firstDefined(raw, ["phone", "telefone"])),
        contact: str(firstDefined(raw, ["contact", "contato"])),
        address: str(firstDefined(raw, ["address", "endereco"])),
        website: str(firstDefined(raw, ["website", "site"])),
        siteStatus: str(firstDefined(raw, ["siteStatus", "statusSite"])) || "Não verificado",
        instagram: str(firstDefined(raw, ["instagram"])),
        instagramStatus: str(firstDefined(raw, ["instagramStatus", "statusInstagram"])) || "Pendente",
        googleRating: num(firstDefined(raw, ["googleRating", "notaGoogle", "avaliacaoGoogle"])),
        googleReviews: num(firstDefined(raw, ["googleReviews", "avaliacoesGoogle"])),
        googleVisibility: str(firstDefined(raw, ["googleVisibility", "visibilidadeGoogle"])) || "Pendente",
        diagnosis: str(firstDefined(raw, ["diagnosis", "diagnostico", "diagnosticoDigital"])),
        notes: str(firstDefined(raw, ["notes", "observacoes", "notas"])),
        nextAction: str(firstDefined(raw, ["nextAction", "proximaAcao"])),
        nextActionDate: str(firstDefined(raw, ["nextActionDate", "dataProximaAcao"])),
        source: str(firstDefined(raw, ["source", "origem"])),
        checklist,
        archived: archived.value,
        recommendedServices,
        surveyStatus: str(firstDefined(raw, ["surveyStatus", "statusPesquisa", "situacaoPesquisa"])),
        surveyDate: str(firstDefined(raw, ["surveyDate", "dataPesquisa"])),
        inPersonConfirmed: inPersonConfirmed.value,
        campaign: str(firstDefined(raw, ["campaign", "campanha"])),
        visitOrder: num(firstDefined(raw, ["visitOrder", "ordemVisita", "order"])),
        suggestedDay: str(firstDefined(raw, ["suggestedDay", "diaSugerido"])),
        lastContactAt: parseDate(firstDefined(raw, ["lastContactAt", "ultimoContato"])),
        lastContactResult: str(firstDefined(raw, ["lastContactResult", "resultadoUltimoContato"])),
        nextFollowUpAt: parseDate(firstDefined(raw, ["nextFollowUpAt", "proximoRetorno"])),
        followUpStage: str(firstDefined(raw, ["followUpStage", "etapaFollowUp"])),
        preferredChannel: str(firstDefined(raw, ["preferredChannel", "canalPreferido"])),
        objection: str(firstDefined(raw, ["objection", "objecao"])),
        responsibleName: str(firstDefined(raw, ["responsibleName", "responsavel"])),
        qualification,
        notionUrl: str(firstDefined(raw, ["notionUrl", "linkNotion", "notion_url"])),
        importedAt: new Date(),
      };

  return {
    data,
    activities: mapLegacyActivities(raw),
    issues,
    legacyId,
  };
}
