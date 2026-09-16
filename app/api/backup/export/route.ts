import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/permissions";
import { db } from "@/lib/db";
import { activities, clients, proposals } from "@/lib/db/schema";
import { BACKUP_VERSION } from "@/lib/backup";

export async function GET() {
  try {
    await requirePermission("backup.export");
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const [clientRows, activityRows, proposalRows] = await Promise.all([
    db.select().from(clients),
    db.select().from(activities),
    db.select().from(proposals),
  ]);

  // Serialize every Date column to ISO 8601 explicitly — relying on
  // JSON.stringify's default Date handling is fine (it also produces ISO),
  // but doing it here keeps the shape self-documenting and matches exactly
  // what backupFileSchema (lib/backup.ts) expects back on restore.
  const body = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clients: clientRows.map((c) => ({
      ...c,
      lastContactAt: c.lastContactAt ? c.lastContactAt.toISOString() : null,
      nextFollowUpAt: c.nextFollowUpAt ? c.nextFollowUpAt.toISOString() : null,
      importedAt: c.importedAt ? c.importedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    activities: activityRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    proposals: proposalRows.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      supersededAt: p.supersededAt ? p.supersededAt.toISOString() : null,
    })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ivs-central-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
