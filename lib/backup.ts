import "server-only";
import { z } from "zod";
import { priorityValues, stageValues, proposalStatusValues } from "./validation";

// Full-fidelity backup — every column of every table, including
// relationships (client_id, root_id) preserved by original id, unlike the
// CSV export which only carries a display subset. This is the "backup
// completo em JSON" the review calls for, distinct from the one-time legacy
// importer (lib/import-mapping.ts): this one round-trips THIS app's own
// data losslessly, id-for-id, so a restore reproduces the exact state
// (including which activity belongs to which client) rather than
// re-mapping from a foreign shape.
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024; // 20 MB

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Data inválida (esperado ISO 8601)");

export const clientBackupSchema = z.object({
  id: z.number().int().positive(),
  legacyId: z.string().nullable(),
  name: z.string().min(1),
  niche: z.string(),
  category: z.string(),
  stage: z.enum(stageValues),
  priority: z.enum(priorityValues),
  phone: z.string(),
  contact: z.string(),
  address: z.string(),
  website: z.string(),
  siteStatus: z.string(),
  instagram: z.string(),
  instagramStatus: z.string(),
  googleRating: z.number().nullable(),
  googleReviews: z.number().int().nullable(),
  googleVisibility: z.string(),
  diagnosis: z.string(),
  notes: z.string(),
  nextAction: z.string(),
  nextActionDate: z.string(),
  source: z.string(),
  score: z.number().int(),
  checklist: z.record(z.string(), z.boolean()),
  archived: z.boolean(),
  ownerId: z.number().int().nullable(),
  recommendedServices: z.array(z.string()),
  surveyStatus: z.string(),
  surveyDate: z.string(),
  inPersonConfirmed: z.boolean(),
  campaign: z.string(),
  visitOrder: z.number().int().nullable(),
  suggestedDay: z.string(),
  lastContactAt: isoDate.nullable(),
  lastContactResult: z.string(),
  nextFollowUpAt: isoDate.nullable(),
  followUpStage: z.string(),
  preferredChannel: z.string(),
  objection: z.string(),
  responsibleName: z.string(),
  qualification: z.record(z.string(), z.unknown()).nullable(),
  notionUrl: z.string(),
  importedAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const activityBackupSchema = z.object({
  id: z.number().int().positive(),
  clientId: z.number().int().positive(),
  type: z.string(),
  message: z.string(),
  actorId: z.number().int().nullable(),
  actorName: z.string(),
  createdAt: isoDate,
});

export const proposalBackupSchema = z.object({
  id: z.number().int().positive(),
  clientId: z.number().int().positive(),
  rootId: z.number().int().positive(),
  revisionNumber: z.number().int(),
  isLatest: z.boolean(),
  status: z.enum(proposalStatusValues),
  title: z.string(),
  description: z.string(),
  valueCents: z.number().int().nullable(),
  validUntil: z.string(),
  createdById: z.number().int().nullable(),
  createdByName: z.string(),
  createdAt: isoDate,
  supersededAt: isoDate.nullable(),
});

export const backupFileSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: isoDate,
  clients: z.array(clientBackupSchema),
  activities: z.array(activityBackupSchema),
  proposals: z.array(proposalBackupSchema),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

// Explicit, non-guessable confirmation string required for a real (non
// dry-run) restore — a defense against a restore being triggered by
// accident (a copy-pasted curl command, a retried request), given that it
// can overwrite current rows with the backup's version of them.
export const RESTORE_CONFIRMATION = "RESTAURAR-SUBSTITUIR-DADOS-ATUAIS";

export const restoreRequestSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  confirm: z.string().optional(),
  backup: backupFileSchema,
});
