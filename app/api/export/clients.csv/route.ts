import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/permissions";
import { listClients } from "@/lib/repo/clients";

// Spreadsheet formula-injection guard (CWE-1236): a cell whose CSV content
// begins with =, +, -, @, a tab, or a carriage return is interpreted as a
// formula by Excel/Sheets/LibreOffice when the file is opened — e.g. a
// client name of "=cmd|'/c calc'!A1" would execute on open. Prefixing with
// a leading apostrophe forces those programs to treat it as literal text,
// same as manually typing an apostrophe before a formula-looking cell.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCsv(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (FORMULA_TRIGGER.test(str)) str = `'${str}`;
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  try {
    await requirePermission("client.export");
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const clients = await listClients({ includeArchived: true });
  const headers = [
    "id",
    "name",
    "niche",
    "category",
    "stage",
    "priority",
    "phone",
    "contact",
    "address",
    "website",
    "instagram",
    "nextAction",
    "archived",
  ];

  const lines = [headers.join(",")];
  for (const c of clients) {
    lines.push(
      headers
        .map((h) => escapeCsv((c as unknown as Record<string, unknown>)[h]))
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ivs-clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
