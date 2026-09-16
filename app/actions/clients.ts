"use server";

import { db } from "@/lib/db";
import { activities, clients } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  activityCreateSchema,
  agendaResultSchema,
  archiveClientSchema,
  checklistToggleSchema,
  clientCreateSchema,
  clientUpdateSchema,
  stageUpdateSchema,
} from "@/lib/validation";

/**
 * Toggle one checklist key. Uses an atomic JSONB merge (`||`) inside the
 * UPDATE itself instead of read-modify-write, so two concurrent toggles on
 * different keys of the same client can never clobber each other — the
 * previous implementation read the row, merged in memory, then wrote the
 * whole object back, which silently lost whichever write landed second.
 * The mutation and its audit-trail entry are written in the same
 * transaction so they can never diverge (e.g. a crash between the two
 * leaving a state change with no history record, or vice versa).
 */
export async function toggleChecklistAction(input: unknown) {
  const user = await requirePermission("client.checklist.toggle");
  const { clientId, key, value } = checklistToggleSchema.parse(input);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(clients)
      .set({
        checklist: sql`${clients.checklist} || jsonb_build_object(${key}::text, ${value}::boolean)`,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });

    if (!row) throw new Error("Cliente não encontrado");

    await tx.insert(activities).values({
      clientId,
      type: "nota",
      message: `${value ? "Marcou" : "Desmarcou"} etapa "${key}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/crm");
  return { ok: true };
}

export async function updateClientAction(input: unknown) {
  await requirePermission("client.update");
  const data = clientUpdateSchema.parse(input);
  const { id, ...rest } = data;

  if (Object.keys(rest).length === 0) return { ok: true };

  const [row] = await db
    .update(clients)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!row) throw new Error("Cliente não encontrado");

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateStageAction(input: unknown) {
  const user = await requirePermission("client.stage.update");
  const { clientId, stage } = stageUpdateSchema.parse(input);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(clients)
      .set({ stage, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });

    if (!row) throw new Error("Cliente não encontrado");

    await tx.insert(activities).values({
      clientId,
      type: "nota",
      message: `Movido para a etapa "${stage}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/crm");
  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function addActivityAction(input: unknown) {
  const user = await requirePermission("activity.create");
  const data = activityCreateSchema.parse(input);

  await db.transaction(async (tx) => {
    const [client] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);
    if (!client) throw new Error("Cliente não encontrado");

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: data.type,
      message: data.message,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createClientAction(input: unknown) {
  const user = await requirePermission("client.create");
  const data = clientCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clients)
      .values({ ...data, checklist: {} })
      .returning({ id: clients.id });

    if (!row) throw new Error("Falha ao criar cliente");

    await tx.insert(activities).values({
      clientId: row.id,
      type: "nota",
      message: "Lead criado manualmente",
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath("/clientes");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

/**
 * CRM → Agenda: registra o resultado de um atendimento e a próxima ação em
 * uma única transação (o texto do resultado vira uma entrada de histórico
 * real, e nextAction/nextActionDate/lastContact* do cliente são atualizados
 * juntos — nunca um sem o outro).
 */
export async function logAgendaResultAction(input: unknown) {
  const user = await requirePermission("activity.create");
  const { clientId, result, nextAction, nextActionDate } = agendaResultSchema.parse(input);

  await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(clients)
      .set({
        nextAction,
        nextActionDate,
        lastContactAt: now,
        lastContactResult: result,
        updatedAt: now,
      })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });

    if (!row) throw new Error("Cliente não encontrado");

    await tx.insert(activities).values({
      clientId,
      type: "nota",
      message: result,
      actorId: user.id,
      actorName: user.name,
      createdAt: now,
    });
  });

  revalidatePath("/crm");
  revalidatePath("/crm/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function archiveClientAction(input: unknown) {
  const user = await requirePermission("client.archive");
  const { clientId, archived } = archiveClientSchema.parse(input);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(clients)
      .set({ archived, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });

    if (!row) throw new Error("Cliente não encontrado");

    await tx.insert(activities).values({
      clientId,
      type: "nota",
      message: archived ? "Cliente arquivado" : "Cliente reativado",
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/clientes");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true };
}
