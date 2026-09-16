import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// "visitante" is read-only across the whole app (see lib/permissions.ts) —
// used for stakeholders who need visibility but must never mutate data.
export const roleEnum = pgEnum("role", ["admin", "comercial", "producao", "visitante"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("comercial"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// Every stage from the legacy system is preserved 1:1 (see STAGES below for
// labels and canonical order) — the migration must never collapse an
// unrecognized legacy stage into "nao_contatado".
export const stageEnum = pgEnum("stage", [
  "nao_contatado",
  "diagnostico_feito",
  "visitado",
  "whatsapp_enviado",
  "ligacao_feita",
  "reuniao_marcada",
  "proposta_enviada",
  "fechado",
  "sem_interesse",
]);

// "confirmar" preserved from the legacy system — a priority pending human
// review, distinct from "baixa".
export const priorityEnum = pgEnum("priority", ["alta", "media", "baixa", "confirmar"]);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),

    // Stable identifier from the legacy (ChatGPT-hosted) app. Nullable
    // because manually-created clients have none, but unique when present
    // — this is what makes re-running the importer idempotent (upsert by
    // legacyId instead of blindly inserting duplicates).
    legacyId: text("legacy_id"),

    name: text("name").notNull(),
    niche: text("niche").notNull().default(""),
    category: text("category").notNull().default(""),
    stage: stageEnum("stage").notNull().default("nao_contatado"),
    priority: priorityEnum("priority").notNull().default("media"),
    phone: text("phone").notNull().default(""),
    contact: text("contact").notNull().default(""),
    address: text("address").notNull().default(""),
    website: text("website").notNull().default(""),
    siteStatus: text("site_status").notNull().default("Não verificado"),
    instagram: text("instagram").notNull().default(""),
    instagramStatus: text("instagram_status").notNull().default("Pendente"),
    // doublePrecision (not integer) so a rating like 4.9 survives the
    // round-trip, and null (no rating yet) stays distinguishable from 0.
    googleRating: doublePrecision("google_rating"),
    googleReviews: integer("google_reviews"),
    googleVisibility: text("google_visibility").notNull().default("Pendente"),
    diagnosis: text("diagnosis").notNull().default(""),
    notes: text("notes").notNull().default(""),
    nextAction: text("next_action").notNull().default(""),
    nextActionDate: text("next_action_date").notNull().default(""),
    source: text("source").notNull().default(""),
    score: integer("score").notNull().default(0),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
    archived: boolean("archived").notNull().default(false),
    ownerId: integer("owner_id").references(() => users.id),

    // --- fields preserved from the legacy system (previously discarded
    // by the importer) ---
    recommendedServices: jsonb("recommended_services").$type<string[]>().notNull().default([]),
    surveyStatus: text("survey_status").notNull().default(""),
    surveyDate: text("survey_date").notNull().default(""),
    inPersonConfirmed: boolean("in_person_confirmed").notNull().default(false),
    campaign: text("campaign").notNull().default(""),
    visitOrder: integer("visit_order"),
    suggestedDay: text("suggested_day").notNull().default(""),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    lastContactResult: text("last_contact_result").notNull().default(""),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    followUpStage: text("follow_up_stage").notNull().default(""),
    preferredChannel: text("preferred_channel").notNull().default(""),
    objection: text("objection").notNull().default(""),
    responsibleName: text("responsible_name").notNull().default(""),
    // Free-form legacy qualification data that doesn't map to a modeled
    // column — preserved as-is instead of being dropped on the floor.
    qualification: jsonb("qualification").$type<Record<string, unknown> | null>(),
    notionUrl: text("notion_url").notNull().default(""),
    importedAt: timestamp("imported_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    legacyIdIdx: uniqueIndex("clients_legacy_id_idx").on(t.legacyId),
  })
);

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // visita | whatsapp | ligacao | reuniao | nota | sistema
  message: text("message").notNull(),
  actorId: integer("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull().default("Sistema"),
  // When importing legacy history entries, this preserves the ORIGINAL
  // event date instead of the import timestamp; defaults to now() for
  // activities created directly in this app.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Persistent (Postgres-backed) login rate limiting. An in-memory Map does
// not work across serverless invocations — each cold start (or each
// concurrent instance) gets its own empty Map, so an attacker's requests
// landing on different instances would never accumulate a shared count.
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    // `${ip}:${email}` — see lib/auth.ts checkRateLimit().
    identifier: text("identifier").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identifierIdx: index("login_attempts_identifier_idx").on(t.identifier, t.attemptedAt),
  })
);

// Proposta comercial de um cliente. Uma "revisão" nunca sobrescreve a
// anterior — cada edição grava uma NOVA linha (revisionNumber + 1),
// encadeada por rootId (o id da primeira revisão da série) e marcando a
// linha anterior com isLatest=false. Isso preserva o histórico completo
// de propostas (o que foi oferecido, quando, e como mudou) em vez de
// perder as versões anteriores a cada edição.
export const proposalStatusEnum = pgEnum("proposal_status", [
  "rascunho",
  "enviada",
  "aceita",
  "recusada",
]);

export const proposals = pgTable(
  "proposals",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // Aponta para o id da primeira revisão da série. É atualizado para o
    // próprio id logo após o insert da primeira revisão (ver
    // app/actions/proposals.ts) — assim toda a cadeia de revisões pode ser
    // buscada com uma única query por rootId.
    rootId: integer("root_id").notNull(),
    revisionNumber: integer("revision_number").notNull().default(1),
    // Apenas uma linha por rootId tem isLatest=true — é a que a UI mostra
    // como "a proposta atual"; as demais são histórico somente-leitura.
    isLatest: boolean("is_latest").notNull().default(true),
    status: proposalStatusEnum("status").notNull().default("rascunho"),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    // Valor em centavos (não double/float) para nunca introduzir erro de
    // arredondamento em um campo monetário.
    valueCents: integer("value_cents"),
    validUntil: text("valid_until").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index("proposals_client_idx").on(t.clientId),
    rootIdx: index("proposals_root_idx").on(t.rootId),
    // Garante em nível de banco que nunca existam duas revisões "atuais"
    // simultâneas para a mesma série — não depende apenas da aplicação se
    // lembrar de desmarcar a anterior corretamente.
    latestPerRootIdx: uniqueIndex("proposals_latest_per_root_idx")
      .on(t.rootId)
      .where(sql`${t.isLatest} = true`),
  })
);

// Contrato — normalmente nasce de uma proposta aceita (proposalId), mas
// pode existir sem uma (ex.: renovação, contrato avulso). "Assinatura
// externa" aqui é uma REFERÊNCIA (provedor + link/identificador do
// documento assinado, ex. Clicksign/DocuSign) — este app não tem infra de
// upload/armazenamento de arquivo nem integra nenhum provedor de
// assinatura; ele registra a evidência de que a assinatura aconteceu em
// outro lugar, não a substitui.
export const contractStatusEnum = pgEnum("contract_status", [
  "rascunho",
  "enviado",
  "assinado",
  "encerrado",
]);

export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    proposalId: integer("proposal_id").references(() => proposals.id),
    title: text("title").notNull().default(""),
    status: contractStatusEnum("status").notNull().default("rascunho"),
    valueCents: integer("value_cents"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: text("signer_name").notNull().default(""),
    signatureProvider: text("signature_provider").notNull().default(""),
    signatureReference: text("signature_reference").notNull().default(""),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("contracts_client_idx").on(t.clientId),
  })
);

// Assinatura de serviço recorrente (ex.: manutenção mensal de site).
// annualDiscountMonths é quantos meses "de desconto" o ciclo anual dá em
// relação a pagar 12 mensalidades avulsas — ex.: monthlyValueCents=30000
// (R$300) e annualDiscountMonths=2 → valor anual = 10 × R$300 = R$3.000,
// nunca 12 × R$300. Valores em centavos (nunca double) para nunca
// introduzir erro de arredondamento num campo monetário.
export const subscriptionCycleEnum = pgEnum("subscription_cycle", ["mensal", "anual"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ativa",
  "pausada",
  "cancelada",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: integer("contract_id").references(() => contracts.id),
    name: text("name").notNull().default(""),
    monthlyValueCents: integer("monthly_value_cents").notNull(),
    billingCycle: subscriptionCycleEnum("billing_cycle").notNull().default("mensal"),
    annualDiscountMonths: integer("annual_discount_months").notNull().default(2),
    status: subscriptionStatusEnum("status").notNull().default("ativa"),
    startDate: text("start_date").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index("subscriptions_client_idx").on(t.clientId),
  })
);

// Lançamento financeiro individual — mensalidade/anual recorrente OU um
// ajuste avulso (trabalho fora do escopo do plano, valor definido por quem
// lança, caso a caso). subscriptionId é opcional: um ajuste avulso pode
// existir sem estar ligado a nenhuma assinatura.
export const chargeTypeEnum = pgEnum("charge_type", ["mensalidade", "anual", "ajuste", "outro"]);
// "parcial" existe entre "pendente" e "pago": nunca é definido à mão — é
// sempre calculado a partir da soma dos recebimentos em charge_payments
// (ver recordChargePaymentAction em app/actions/finance.ts). Isso é o que
// garante que "pago" signifique, de verdade, "o valor cheio entrou".
export const chargeStatusEnum = pgEnum("charge_status", [
  "pendente",
  "parcial",
  "pago",
  "atrasado",
  "cancelado",
]);

export const financialCharges = pgTable(
  "financial_charges",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id").references(() => subscriptions.id),
    type: chargeTypeEnum("type").notNull().default("outro"),
    description: text("description").notNull().default(""),
    valueCents: integer("value_cents").notNull(),
    dueDate: text("due_date").notNull().default(""),
    status: chargeStatusEnum("status").notNull().default("pendente"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("financial_charges_client_idx").on(t.clientId),
    subscriptionIdx: index("financial_charges_subscription_idx").on(t.subscriptionId),
  })
);

// Forma de pagamento de um recebimento. Cartão de crédito parcelado e a
// taxa da maquininha (quando houver) reduzem o valor líquido que a agência
// efetivamente fica, mesmo que o valor bruto cobrado do cliente seja outro
// — por isso ficam registrados por recebimento, não só no total da cobrança.
export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "dinheiro",
  "transferencia",
  "outro",
]);

// Ledger de recebimentos contra uma cobrança — permite pagamento parcial
// (uma ou mais entradas que juntas não fecham o valor) e integral (a soma
// cobre o valor). O status da cobrança (parcial/pago, em financialCharges)
// é sempre DERIVADO da soma destas linhas pelo servidor, nunca digitado à
// mão — é isso que faz o faturamento do painel corresponder a dinheiro que
// de fato entrou, não a uma cobrança marcada "paga" sem nenhum registro.
export const chargePayments = pgTable(
  "charge_payments",
  {
    id: serial("id").primaryKey(),
    chargeId: integer("charge_id")
      .notNull()
      .references(() => financialCharges.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull().default("outro"),
    // Só relevante para cartão de crédito; fica nulo para os demais métodos.
    installments: integer("installments"),
    // Taxa da maquininha/processadora descontada deste recebimento, em
    // centavos (valor absoluto, não percentual) — quem lança já sabe o
    // valor cobrado pela operadora; o sistema não tenta adivinhar uma taxa.
    feeCents: integer("fee_cents").notNull().default(0),
    paidAt: text("paid_at").notNull().default(""),
    note: text("note").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chargeIdx: index("charge_payments_charge_idx").on(t.chargeId),
  })
);

// Gastos operacionais da agência (folha, ferramentas, mídia paga, impostos
// etc.). Deliberadamente sem clientId — diferente de todo o resto do
// financeiro, um gasto não pertence a um cliente específico. Usado só para
// compor faturamento líquido e lucro no painel geral (ver
// getFinancialSummary em lib/repo/finance.ts).
export const expenseCategoryEnum = pgEnum("expense_category", [
  "equipe_folha",
  "ferramentas_software",
  "midia_paga",
  "impostos_taxas",
  "escritorio_infra",
  "comissoes",
  "outro",
]);

export const expenseStatusEnum = pgEnum("expense_status", ["ativo", "cancelado"]);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    category: expenseCategoryEnum("category").notNull().default("outro"),
    description: text("description").notNull(),
    valueCents: integer("value_cents").notNull(),
    expenseDate: text("expense_date").notNull(),
    // Só sinaliza que é um gasto recorrente (aluguel, assinatura de
    // ferramenta) — não gera lançamentos futuros automaticamente ainda.
    recurring: boolean("recurring").notNull().default(false),
    status: expenseStatusEnum("status").notNull().default("ativo"),
    notes: text("notes").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateIdx: index("expenses_date_idx").on(t.expenseDate),
  })
);

// Ativos e acessos técnicos do cliente (site, landing page, domínio,
// hospedagem, redes sociais, contas de anúncio etc.) — o "o que já foi
// entregue e o que falta" por item, além de onde cada coisa está hospedada
// e quando vence. Modelado diretamente a partir da base "Ativos, links e
// acessos" que a agência já usava no Notion antes deste app existir —
// mesmas categorias e o mesmo cuidado de nunca guardar senha aqui, só um
// link para o cofre de senhas (vaultLink) e o login/e-mail (nunca a senha).
export const assetCategoryEnum = pgEnum("asset_category", [
  "dominio",
  "hospedagem",
  "site",
  "landing_page",
  "painel",
  "instagram",
  "facebook",
  "google_meu_negocio",
  "google_analytics",
  "search_console",
  "google_ads",
  "meta_ads",
  "whatsapp_business",
  "email_profissional",
  "design",
  "drive_arquivos",
  "codigo_repositorio",
  "outro",
]);

// "a_configurar" → "em_configuracao" → "ativo" é o caminho feliz (o que foi
// feito vs. o que falta, por item). "pendente_cliente" cobre quando o
// bloqueio é o cliente (aguardando material/aprovação/acesso), não a
// agência — distinção que o próprio time já fazia no Notion.
export const assetStatusEnum = pgEnum("asset_status", [
  "a_configurar",
  "em_configuracao",
  "ativo",
  "em_manutencao",
  "pendente_cliente",
  "cancelado",
]);

export const ASSET_CATEGORIES = [
  { key: "dominio", label: "Domínio" },
  { key: "hospedagem", label: "Hospedagem" },
  { key: "site", label: "Site" },
  { key: "landing_page", label: "Landing page" },
  { key: "painel", label: "Painel / WordPress" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "google_meu_negocio", label: "Google Meu Negócio" },
  { key: "google_analytics", label: "Google Analytics" },
  { key: "search_console", label: "Search Console" },
  { key: "google_ads", label: "Google Ads" },
  { key: "meta_ads", label: "Meta Ads" },
  { key: "whatsapp_business", label: "WhatsApp Business" },
  { key: "email_profissional", label: "E-mail profissional" },
  { key: "design", label: "Design / Canva" },
  { key: "drive_arquivos", label: "Drive / Arquivos" },
  { key: "codigo_repositorio", label: "Código / Repositório" },
  { key: "outro", label: "Outro" },
] as const;

// "Feito" agrupa o que já está entregue/rodando; o resto é "o que falta"
// (inclui pendente_cliente porque, mesmo bloqueado pelo cliente, ainda não
// está pronto — só muda de quem é a bola).
export const ASSET_STATUSES = [
  { key: "a_configurar", label: "A configurar", done: false },
  { key: "em_configuracao", label: "Em configuração", done: false },
  { key: "ativo", label: "Ativo", done: true },
  { key: "em_manutencao", label: "Em manutenção", done: true },
  { key: "pendente_cliente", label: "Pendente do cliente", done: false },
  { key: "cancelado", label: "Cancelado", done: false },
] as const;

export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: assetCategoryEnum("category").notNull().default("outro"),
    status: assetStatusEnum("status").notNull().default("a_configurar"),
    mainLink: text("main_link").notNull().default(""),
    adminLink: text("admin_link").notNull().default(""),
    // Link para o item no gerenciador de senhas (1Password, Bitwarden...) —
    // nunca a senha em si. loginEmail guarda só o usuário/e-mail de acesso.
    vaultLink: text("vault_link").notNull().default(""),
    loginEmail: text("login_email").notNull().default(""),
    domainIdentifier: text("domain_identifier").notNull().default(""),
    platform: text("platform").notNull().default(""),
    technicalInfo: text("technical_info").notNull().default(""),
    renewalDate: text("renewal_date").notNull().default(""),
    recurringValueCents: integer("recurring_value_cents"),
    backupConfirmed: boolean("backup_confirmed").notNull().default(false),
    clientApproval: boolean("client_approval").notNull().default(false),
    responsibleId: integer("responsible_id").references(() => users.id),
    notes: text("notes").notNull().default(""),
    createdById: integer("created_by_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default("Sistema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("assets_client_idx").on(t.clientId),
  })
);

export const CHECKLIST_STEPS = [
  { key: "diagnosisDone", label: "Diagnóstico" },
  { key: "initialService", label: "Atendimento inicial" },
  { key: "meetingDone", label: "Reunião realizada" },
  { key: "proposalSent", label: "Proposta enviada" },
  { key: "contractClosed", label: "Contrato fechado" },
  { key: "depositReceived", label: "Sinal recebido" },
  { key: "materialsReceived", label: "Materiais recebidos" },
  { key: "siteStarted", label: "Site iniciado" },
  { key: "siteDone", label: "Site concluído" },
  { key: "instagramSetup", label: "Instagram configurado" },
  { key: "googleOptimized", label: "Google otimizado" },
  { key: "contentDelivered", label: "Conteúdo entregue" },
  { key: "clientApproval", label: "Aprovação do cliente" },
  { key: "finalPayment", label: "Pagamento final" },
  { key: "projectDone", label: "Projeto finalizado" },
] as const;

// Canonical order (dashboard funnel, agenda, etc.) AND the full set of
// stages carried over unchanged from the legacy system — this is the
// single source of truth other code must import rather than re-declaring.
export const STAGES = [
  { key: "nao_contatado", label: "Não contatado" },
  { key: "diagnostico_feito", label: "Diagnóstico feito" },
  { key: "visitado", label: "Visitado" },
  { key: "whatsapp_enviado", label: "WhatsApp enviado" },
  { key: "ligacao_feita", label: "Ligação feita" },
  { key: "reuniao_marcada", label: "Reunião marcada" },
  { key: "proposta_enviada", label: "Proposta enviada" },
  { key: "fechado", label: "Fechado" },
  { key: "sem_interesse", label: "Sem interesse" },
] as const;

// Explicit sort order for priority — do NOT sort by the enum/string value
// (Postgres and JS would both sort "alta" < "baixa" < "confirmar" < "media"
// alphabetically, which is meaningless business-wise). Lower number = shown
// first.
export const PRIORITIES = [
  { key: "alta", label: "Alta", order: 0 },
  { key: "media", label: "Média", order: 1 },
  { key: "confirmar", label: "Confirmar", order: 2 },
  { key: "baixa", label: "Baixa", order: 3 },
] as const;

export const PRIORITY_ORDER: Record<string, number> = Object.fromEntries(
  PRIORITIES.map((p) => [p.key, p.order])
);

/** Valor anual = (12 - annualDiscountMonths) mensalidades — nunca 12 cheias
 *  quando há desconto. Ex.: R$300/mês, 2 meses de desconto → R$3.000/ano
 *  (equivalente a 10 mensalidades), não R$3.600. */
export function computeAnnualValueCents(monthlyValueCents: number, annualDiscountMonths: number): number {
  const months = Math.max(0, 12 - annualDiscountMonths);
  return monthlyValueCents * months;
}
