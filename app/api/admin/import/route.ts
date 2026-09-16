import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, clients } from "@/lib/db/schema";
import { importPayloadSchema, mappedClientSchema, MAX_IMPORT_BYTES } from "@/lib/validation";
import { mapLegacyClient, type FieldIssue } from "@/lib/import-mapping";
import { eq } from "drizzle-orm";

/**
 * One-time migration endpoint used to bring data over from the previous
 * ChatGPT-hosted app. Protected by TWO independent gates (not just a
 * secret): IMPORT_SECRET (who may call it) and IMPORT_ENABLED (whether the
 * endpoint does anything at all). After the real migration has run and
 * been verified, set IMPORT_ENABLED=false (or remove it) — this is the
 * "restrict and disable after migration" requirement from the review.
 * A leaked/reused IMPORT_SECRET alone is then not enough to write data.
 */
function importIsEnabled(): boolean {
  return process.env.IMPORT_ENABLED === "true";
}

interface RecordReport {
  legacyId: string | null;
  index: number;
  action: "insert" | "update" | "skip_conflict" | "blocked";
  issues: FieldIssue[];
}

export async function POST(req: NextRequest) {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "import disabled: IMPORT_SECRET não configurado" }, { status: 403 });
  }
  if (!importIsEnabled()) {
    return NextResponse.json(
      { error: "import disabled: defina IMPORT_ENABLED=true explicitamente para reabilitar (uso único)" },
      { status: 403 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "payload excede o limite de tamanho (5 MB)" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "payload excede o limite de tamanho (5 MB)" }, { status: 413 });
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { clients: rawClients, dryRun, overwrite } = parsed.data;

  // --- Map + fully validate every record BEFORE any write happens -------
  const mapped = rawClients.map((raw) => mapLegacyClient(raw));

  // Reject the whole batch if the same legacyId appears twice — silently
  // upserting both would make the "second wins" outcome undefined and
  // order-dependent.
  const seen = new Map<string, number>();
  for (const [i, m] of mapped.entries()) {
    if (!m.legacyId) continue;
    const prevIndex = seen.get(m.legacyId);
    if (prevIndex !== undefined) {
      return NextResponse.json(
        {
          error: `legacyId duplicado no payload: "${m.legacyId}" aparece nos índices ${prevIndex} e ${i}. Corrija a origem dos dados antes de reenviar.`,
        },
        { status: 400 }
      );
    }
    seen.set(m.legacyId, i);
  }

  const reports: RecordReport[] = [];
  const toWrite: { index: number; legacyId: string; data: NonNullable<ReturnType<typeof mapLegacyClient>["data"]>; activities: ReturnType<typeof mapLegacyClient>["activities"] }[] = [];

  for (const [index, m] of mapped.entries()) {
    if (!m.data) {
      reports.push({ legacyId: m.legacyId, index, action: "blocked", issues: m.issues });
      continue;
    }
    const validated = mappedClientSchema.safeParse(m.data);
    if (!validated.success) {
      reports.push({
        legacyId: m.legacyId,
        index,
        action: "blocked",
        issues: [
          ...m.issues,
          ...validated.error.issues.map((i) => ({ field: i.path.join("."), rawValue: undefined, reason: i.message })),
        ],
      });
      continue;
    }
    toWrite.push({ index, legacyId: m.legacyId as string, data: m.data, activities: m.activities });
  }

  // --- Resolve insert vs. update vs. conflict against the current DB ----
  const existingRows = toWrite.length
    ? await db
        .select({ id: clients.id, legacyId: clients.legacyId, updatedAt: clients.updatedAt, importedAt: clients.importedAt })
        .from(clients)
    : [];
  const existingByLegacyId = new Map(existingRows.filter((r) => r.legacyId).map((r) => [r.legacyId as string, r]));

  const toInsert: typeof toWrite = [];
  const toUpdate: { index: number; legacyId: string; id: number; data: (typeof toWrite)[number]["data"] }[] = [];

  for (const item of toWrite) {
    const existing = existingByLegacyId.get(item.legacyId);
    if (!existing) {
      toInsert.push(item);
      reports.push({ legacyId: item.legacyId, index: item.index, action: "insert", issues: [] });
      continue;
    }
    // Untouched since the last import (updatedAt === importedAt) is safe to
    // refresh. Anything edited afterward inside the app is a real user
    // change and must never be silently clobbered by a re-run — unless the
    // caller explicitly opted into `overwrite`.
    const editedSinceImport =
      existing.importedAt == null || existing.updatedAt.getTime() !== existing.importedAt.getTime();
    if (editedSinceImport && !overwrite) {
      reports.push({
        legacyId: item.legacyId,
        index: item.index,
        action: "skip_conflict",
        issues: [
          {
            field: "*",
            rawValue: undefined,
            reason: "Registro foi editado no app após a última importação — pulado para não perder a alteração. Reenvie com overwrite:true para forçar.",
          },
        ],
      });
      continue;
    }
    toUpdate.push({ index: item.index, legacyId: item.legacyId, id: existing.id, data: item.data });
    reports.push({ legacyId: item.legacyId, index: item.index, action: "update", issues: [] });
  }

  const summary = {
    total: rawClients.length,
    insert: toInsert.length,
    update: toUpdate.length,
    skipConflict: reports.filter((r) => r.action === "skip_conflict").length,
    blocked: reports.filter((r) => r.action === "blocked").length,
  };

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, summary, reports });
  }

  if (toInsert.length === 0 && toUpdate.length === 0) {
    return NextResponse.json({ ok: true, dryRun: false, summary, reports, written: 0 });
  }

  // All-or-nothing for the valid subset: a partial failure here (e.g. a
  // constraint violation the pre-validation didn't catch) must not leave
  // half the batch committed.
  let written = 0;
  await db.transaction(async (tx) => {
    for (const item of toInsert) {
      // updatedAt/createdAt are pinned to the SAME Date instance as
      // importedAt (instead of Postgres's independent now() default) so a
      // later re-run can tell "untouched since this import" apart from a
      // real edit by comparing updatedAt === importedAt exactly. Two
      // independently-generated clocks (JS now() at mapping time vs.
      // Postgres now() at insert time) are never bit-identical, which is
      // what made the very first re-run of an untouched row misreport as
      // "edited since import" and skip forever — caught by actually
      // re-running the importer against real data, not by the build.
      const [row] = await tx
        .insert(clients)
        .values({ ...item.data, updatedAt: item.data.importedAt, createdAt: item.data.importedAt })
        .returning({ id: clients.id });
      written += 1;
      if (row && item.activities.length > 0) {
        await tx.insert(activities).values(
          item.activities.map((a) => ({
            clientId: row.id,
            type: a.type,
            message: a.message,
            actorName: a.actorName,
            ...(a.createdAt ? { createdAt: a.createdAt } : {}),
          }))
        );
      }
    }
    for (const item of toUpdate) {
      await tx
        .update(clients)
        .set({ ...item.data, updatedAt: item.data.importedAt })
        .where(eq(clients.id, item.id));
      written += 1;
    }
  });

  return NextResponse.json({ ok: true, dryRun: false, summary, reports, written });
}
