"use server";

import { db } from "@/lib/db";
import { activities, assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetStatusUpdateSchema,
  assetFlagUpdateSchema,
} from "@/lib/validation";

export async function createAssetAction(input: unknown) {
  const user = await requirePermission("asset.manage");
  const data = assetCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(assets)
      .values({
        clientId: data.clientId,
        name: data.name,
        category: data.category,
        mainLink: data.mainLink,
        adminLink: data.adminLink,
        vaultLink: data.vaultLink,
        loginEmail: data.loginEmail,
        domainIdentifier: data.domainIdentifier,
        platform: data.platform,
        technicalInfo: data.technicalInfo,
        renewalDate: data.renewalDate,
        recurringValueCents: data.recurringValueCents ?? null,
        notes: data.notes,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: assets.id });
    if (!row) throw new Error("Falha ao criar ativo");

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: "nota",
      message: `Ativo adicionado: "${data.name}"`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/ativos");
  return { ok: true, id };
}

export async function updateAssetAction(input: unknown) {
  const user = await requirePermission("asset.manage");
  const data = assetUpdateSchema.parse(input);
  const { assetId, ...rest } = data;

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!current) throw new Error("Ativo não encontrado");

    await tx
      .update(assets)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(assets.id, assetId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Ativo "${current.name}" atualizado`,
      actorId: user.id,
      actorName: user.name,
    });

    revalidatePath(`/clientes/${current.clientId}`);
  });

  revalidatePath("/ativos");
  return { ok: true };
}

export async function updateAssetStatusAction(input: unknown) {
  const user = await requirePermission("asset.manage");
  const { assetId, status } = assetStatusUpdateSchema.parse(input);

  let clientId: number | null = null;
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!current) throw new Error("Ativo não encontrado");
    clientId = current.clientId;

    await tx.update(assets).set({ status, updatedAt: new Date() }).where(eq(assets.id, assetId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Ativo "${current.name}" marcado como "${status}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/ativos");
  revalidatePath("/clientes");
  if (clientId !== null) revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

// Toggle isolado para os dois checkboxes (backupConfirmed / clientApproval) —
// mesma ideia do checklist de produção: uma ação pequena e direta, sem
// precisar reenviar o registro inteiro do ativo para marcar uma caixinha.
export async function updateAssetFlagAction(input: unknown) {
  await requirePermission("asset.manage");
  const { assetId, field, value } = assetFlagUpdateSchema.parse(input);

  const [current] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!current) throw new Error("Ativo não encontrado");

  await db
    .update(assets)
    .set({ [field]: value, updatedAt: new Date() })
    .where(eq(assets.id, assetId));

  revalidatePath("/ativos");
  revalidatePath(`/clientes/${current.clientId}`);
  return { ok: true };
}
