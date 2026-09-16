import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/permissions";
import { db } from "@/lib/db";
import { activities, clients, proposals } from "@/lib/db/schema";
import { MAX_BACKUP_BYTES, RESTORE_CONFIRMATION, restoreRequestSchema, type BackupFile } from "@/lib/backup";
import { sql } from "drizzle-orm";

/**
 * Restaura um backup completo (ver /api/backup/export) — restauração
 * validada, transacional e idempotente por id (upsert), nunca um `as never`
 * ou um INSERT sem verificação de tipo. Diferente do importador legado
 * (que remapeia dados de um formato estranho), aqui os ids são os IDs REAIS
 * desta aplicação — o upsert por id é o que faz um restore reproduzir o
 * estado exato de quando o backup foi tirado, inclusive as referências
 * (activities.client_id, proposals.root_id).
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("backup.restore");
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "payload excede o limite de tamanho (20 MB)" }, { status: 413 });
  }
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "payload excede o limite de tamanho (20 MB)" }, { status: 413 });
  }

  const parsedBody = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  const parsed = restoreRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dryRun, confirm, backup } = parsed.data;

  const existingClientIds = new Set((await db.select({ id: clients.id }).from(clients)).map((r) => r.id));
  const existingActivityIds = new Set((await db.select({ id: activities.id }).from(activities)).map((r) => r.id));
  const existingProposalIds = new Set((await db.select({ id: proposals.id }).from(proposals)).map((r) => r.id));

  const summary = {
    clients: {
      insert: backup.clients.filter((c) => !existingClientIds.has(c.id)).length,
      update: backup.clients.filter((c) => existingClientIds.has(c.id)).length,
    },
    activities: {
      insert: backup.activities.filter((a) => !existingActivityIds.has(a.id)).length,
      update: backup.activities.filter((a) => existingActivityIds.has(a.id)).length,
    },
    proposals: {
      insert: backup.proposals.filter((p) => !existingProposalIds.has(p.id)).length,
      update: backup.proposals.filter((p) => existingProposalIds.has(p.id)).length,
    },
    backupExportedAt: backup.exportedAt,
  };

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, summary });
  }

  // A real restore can overwrite current rows with the backup's version —
  // require an explicit, non-guessable confirmation string in addition to
  // dryRun:false, so an accidental or retried request can never trigger it.
  if (confirm !== RESTORE_CONFIRMATION) {
    return NextResponse.json(
      {
        error: `restauração real requer o campo "confirm" com o valor exato "${RESTORE_CONFIRMATION}"`,
      },
      { status: 400 }
    );
  }

  await db.transaction(async (tx) => {
    for (const c of backup.clients) {
      const { id, ...rest } = toClientRow(c);
      await tx
        .insert(clients)
        .values({ id, ...rest })
        .onConflictDoUpdate({ target: clients.id, set: rest });
    }
    for (const a of backup.activities) {
      const { id, ...rest } = toActivityRow(a);
      await tx
        .insert(activities)
        .values({ id, ...rest })
        .onConflictDoUpdate({ target: activities.id, set: rest });
    }
    for (const p of backup.proposals) {
      const { id, ...rest } = toProposalRow(p);
      await tx
        .insert(proposals)
        .values({ id, ...rest })
        .onConflictDoUpdate({ target: proposals.id, set: rest });
    }

    // Restored rows carry explicit ids, so the id sequences must be pushed
    // past the highest restored id — otherwise the very next manually
    // created client/activity/proposal collides with a restored id.
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('clients', 'id'), COALESCE((SELECT MAX(id) FROM clients), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('activities', 'id'), COALESCE((SELECT MAX(id) FROM activities), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('proposals', 'id'), COALESCE((SELECT MAX(id) FROM proposals), 1))`);
  });

  return NextResponse.json({ ok: true, dryRun: false, summary });
}

function toClientRow(c: BackupFile["clients"][number]) {
  return {
    ...c,
    lastContactAt: c.lastContactAt ? new Date(c.lastContactAt) : null,
    nextFollowUpAt: c.nextFollowUpAt ? new Date(c.nextFollowUpAt) : null,
    importedAt: c.importedAt ? new Date(c.importedAt) : null,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  };
}

function toActivityRow(a: BackupFile["activities"][number]) {
  return { ...a, createdAt: new Date(a.createdAt) };
}

function toProposalRow(p: BackupFile["proposals"][number]) {
  return {
    ...p,
    createdAt: new Date(p.createdAt),
    supersededAt: p.supersededAt ? new Date(p.supersededAt) : null,
  };
}
