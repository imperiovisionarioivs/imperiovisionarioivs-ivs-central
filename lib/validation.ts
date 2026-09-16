import { z } from "zod";
import {
  CHECKLIST_STEPS,
  priorityEnum,
  stageEnum,
  assetCategoryEnum,
  assetStatusEnum,
  paymentMethodEnum,
  expenseCategoryEnum,
  expenseStatusEnum,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/permissions";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB — see /api/admin/import

/**
 * Campo de texto opcional vindo direto de FormData.get(...). O browser só
 * envia `null` quando o <input> daquele nome nem existe no formulário (um
 * campo presente e vazio já chega como "") — mas nunca se deve confiar
 * cegamente no client: um formulário futuro que remova um input, ou um
 * chamador que monte o payload manualmente, pode muito bem mandar `null`
 * ou `undefined` aqui. z.string() rejeita ambos por padrão (só .default()
 * cobre `undefined`), o que derrubaria a Server Action inteira com um erro
 * de validação genérico em vez de simplesmente tratar como "sem valor".
 * Este helper normaliza null/undefined para "" antes de validar.
 */
function optionalText(max: number) {
  return z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().max(max)
  );
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

// Single source of truth: derived from the schema's enums instead of being
// re-declared (and risking drift from what the database actually accepts).
export const stageValues = stageEnum.enumValues;
export const priorityValues = priorityEnum.enumValues;

const CHECKLIST_KEYS = new Set<string>(CHECKLIST_STEPS.map((s) => s.key));

export const clientUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
  niche: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  stage: z.enum(stageValues).optional(),
  priority: z.enum(priorityValues).optional(),
  phone: z.string().trim().max(40).optional(),
  contact: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  website: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(200).optional(),
  diagnosis: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
  nextAction: z.string().trim().max(300).optional(),
  nextActionDate: z.string().trim().max(40).optional(),
  archived: z.boolean().optional(),
});

// Restricted to keys the app actually knows about (CHECKLIST_STEPS) — this
// is the *interactive toggle* schema. Legacy checklist keys the app does
// not recognize are still preserved verbatim by the importer (which writes
// the raw legacy checklist object directly), they just cannot be toggled
// from the UI. This prevents a crafted request from writing arbitrary keys
// into a client's checklist JSON.
export const checklistToggleSchema = z.object({
  clientId: z.number().int().positive(),
  key: z.string().refine((k) => CHECKLIST_KEYS.has(k), "Etapa de checklist desconhecida"),
  value: z.boolean(),
});

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(200),
  niche: z.string().trim().max(120).default(""),
  category: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
  priority: z.enum(priorityValues).default("media"),
});

export const activityCreateSchema = z.object({
  clientId: z.number().int().positive(),
  type: z.enum(["visita", "whatsapp", "ligacao", "reuniao", "nota"]),
  message: z.string().trim().min(1, "Escreva uma mensagem").max(2000),
});

export const stageUpdateSchema = z.object({
  clientId: z.number().int().positive(),
  stage: z.enum(stageValues),
});

export const archiveClientSchema = z.object({
  clientId: z.number().int().positive(),
  archived: z.boolean(),
});

// CRM → Agenda: registra o resultado de um atendimento e a próxima ação em
// uma única operação (ver app/actions/clients.ts logAgendaResultAction).
export const agendaResultSchema = z.object({
  clientId: z.number().int().positive(),
  result: z.string().trim().min(1, "Descreva o resultado do atendimento").max(2000),
  nextAction: z.string().trim().max(300).optional().default(""),
  nextActionDate: z.string().trim().max(40).optional().default(""),
});

export const changeRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["admin", "comercial", "producao", "visitante"]),
});

// Outer request body accepted by /api/admin/import. Individual client
// records are intentionally kept loose here (z.record) because the legacy
// export's exact shape is not guaranteed — per-field validation happens
// after mapping, in lib/import-mapping.ts, against the actual insert shape.
export const importPayloadSchema = z.object({
  clients: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
  // When true, validates and reports what WOULD happen without writing
  // anything to the database.
  dryRun: z.boolean().optional().default(false),
  // When true, an existing (by legacyId) record that was edited by a user
  // since its last import is overwritten anyway. Default false: the
  // importer must never silently clobber a change made inside the app
  // after the original migration.
  overwrite: z.boolean().optional().default(false),
});

export { MAX_IMPORT_BYTES };

// --- Propostas -----------------------------------------------------------
export const proposalStatusValues = ["rascunho", "enviada", "aceita", "recusada"] as const;

export const proposalCreateSchema = z.object({
  clientId: z.number().int().positive(),
  title: z.string().trim().min(1, "Informe um título").max(200),
  description: z.string().trim().max(8000).default(""),
  // Recebido em reais na UI, convertido para centavos antes de chegar aqui.
  valueCents: z.number().int().nonnegative().nullable().optional(),
  validUntil: z.string().trim().max(40).default(""),
});

export const proposalReviseSchema = proposalCreateSchema.extend({
  proposalId: z.number().int().positive(),
});

export const proposalStatusUpdateSchema = z.object({
  proposalId: z.number().int().positive(),
  status: z.enum(proposalStatusValues),
});

// --- Contratos -------------------------------------------------------------
export const contractStatusValues = ["rascunho", "enviado", "assinado", "encerrado"] as const;

export const contractCreateSchema = z.object({
  clientId: z.number().int().positive(),
  proposalId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1, "Informe um título").max(200),
  valueCents: z.number().int().nonnegative().nullable().optional(),
  startDate: optionalText(40),
  endDate: optionalText(40),
  notes: optionalText(4000),
});

export const contractStatusUpdateSchema = z.object({
  contractId: z.number().int().positive(),
  status: z.enum(contractStatusValues),
});

// Registrar a assinatura move o contrato para "assinado" e grava a
// evidência — provedor (texto livre: "Clicksign", "Presencial", etc.) e uma
// referência (URL do documento assinado, ou um identificador/protocolo).
export const contractSignSchema = z.object({
  contractId: z.number().int().positive(),
  signerName: z.string().trim().min(1, "Informe quem assinou").max(200),
  signatureProvider: optionalText(120),
  signatureReference: optionalText(500),
});

// --- Financeiro: assinaturas e cobranças -----------------------------------
export const subscriptionCycleValues = ["mensal", "anual"] as const;
export const subscriptionStatusValues = ["ativa", "pausada", "cancelada"] as const;

export const subscriptionCreateSchema = z.object({
  clientId: z.number().int().positive(),
  contractId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1, "Informe o nome do plano").max(200),
  monthlyValueCents: z.number().int().positive("Informe um valor mensal maior que zero"),
  billingCycle: z.enum(subscriptionCycleValues).default("mensal"),
  annualDiscountMonths: z.number().int().min(0).max(11).default(2),
  startDate: optionalText(40),
});

export const subscriptionStatusUpdateSchema = z.object({
  subscriptionId: z.number().int().positive(),
  status: z.enum(subscriptionStatusValues),
});

export const chargeTypeValues = ["mensalidade", "anual", "ajuste", "outro"] as const;
export const chargeStatusValues = ["pendente", "parcial", "pago", "atrasado", "cancelado"] as const;

export const chargeCreateSchema = z.object({
  clientId: z.number().int().positive(),
  subscriptionId: z.number().int().positive().nullable().optional(),
  type: z.enum(chargeTypeValues).default("outro"),
  description: optionalText(500),
  valueCents: z.number().int().positive("Informe um valor maior que zero"),
  dueDate: optionalText(40),
});

// "pago" e "parcial" nunca são um alvo válido aqui — só são alcançados via
// recordChargePaymentAction, a partir de um recebimento real registrado
// (ver app/actions/finance.ts). Esta ação manual serve só para marcar
// atraso ou cancelar, que não envolvem dinheiro entrando.
export const chargeManualStatusValues = ["atrasado", "cancelado"] as const;
export const chargeStatusUpdateSchema = z.object({
  chargeId: z.number().int().positive(),
  status: z.enum(chargeManualStatusValues),
});

// --- Financeiro: recebimentos (pagamentos contra uma cobrança) -------------
export const paymentMethodValues = paymentMethodEnum.enumValues;

export const chargePaymentCreateSchema = z.object({
  chargeId: z.number().int().positive(),
  amountCents: z.number().int().positive("Informe um valor recebido maior que zero"),
  method: z.enum(paymentMethodValues).default("outro"),
  installments: z.number().int().min(1).max(24).nullable().optional(),
  feeCents: z.number().int().nonnegative().default(0),
  paidAt: optionalText(40),
  note: optionalText(500),
});

// --- Financeiro: gastos operacionais da agência -----------------------------
export const expenseCategoryValues = expenseCategoryEnum.enumValues;
export const expenseStatusValues = expenseStatusEnum.enumValues;

export const expenseCreateSchema = z.object({
  category: z.enum(expenseCategoryValues).default("outro"),
  description: z.string().trim().min(1, "Descreva o gasto").max(300),
  valueCents: z.number().int().positive("Informe um valor maior que zero"),
  expenseDate: z.string().trim().min(1, "Informe a data do gasto").max(40),
  recurring: z.boolean().default(false),
  notes: optionalText(1000),
});

export const expenseCancelSchema = z.object({
  expenseId: z.number().int().positive(),
});

// --- Equipe (gestão de usuários) --------------------------------------------
// "visitante" fica de fora das criações/edições normais de conta: é o papel
// somente-leitura pronto para o acesso específico da Jeisyelle, e nada aqui
// envia convite algum — criar/editar é só gravar no banco e mostrar a senha
// gerada uma única vez, para o admin repassar por um canal que ele escolher.
export const assignableRoleValues = ROLES;

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(200),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido"),
  role: z.enum(assignableRoleValues),
});

export const userRoleUpdateSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(assignableRoleValues),
});

export const userActiveUpdateSchema = z.object({
  userId: z.number().int().positive(),
  active: z.boolean(),
});

export const userPasswordResetSchema = z.object({
  userId: z.number().int().positive(),
});

// --- Ativos, links e acessos -------------------------------------------
export const assetCategoryValues = assetCategoryEnum.enumValues;
export const assetStatusValues = assetStatusEnum.enumValues;

export const assetCreateSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().trim().min(1, "Informe o nome do ativo").max(200),
  category: z.enum(assetCategoryValues).default("outro"),
  mainLink: optionalText(500),
  adminLink: optionalText(500),
  vaultLink: optionalText(500),
  loginEmail: optionalText(200),
  domainIdentifier: optionalText(200),
  platform: optionalText(200),
  technicalInfo: optionalText(2000),
  renewalDate: optionalText(40),
  recurringValueCents: z.number().int().nonnegative().nullable().optional(),
  notes: optionalText(2000),
});

export const assetUpdateSchema = assetCreateSchema.partial().extend({
  assetId: z.number().int().positive(),
});

export const assetStatusUpdateSchema = z.object({
  assetId: z.number().int().positive(),
  status: z.enum(assetStatusValues),
});

export const assetFlagUpdateSchema = z.object({
  assetId: z.number().int().positive(),
  field: z.enum(["backupConfirmed", "clientApproval"]),
  value: z.boolean(),
});

// Defense-in-depth check applied to every mapLegacyClient() output right
// before it is written — independent of the mapping logic itself, so a bug
// in the mapper's own invariants doesn't silently reach the database.
export const mappedClientSchema = z.object({
  legacyId: z.string().min(1),
  name: z.string().min(1),
  stage: z.enum(stageValues),
  priority: z.enum(priorityValues),
});
