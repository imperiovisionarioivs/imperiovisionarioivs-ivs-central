import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env loader for standalone scripts (migrate/seed) run via `tsx`.
 *
 * Next.js itself loads .env.local automatically for `next dev`/`build`/
 * `start`, but a script executed directly with `tsx scripts/x.ts` gets none
 * of that — process.env only has whatever the shell already exported. That
 * was the bug: the documented `npm run db:migrate`/`db:seed` commands
 * silently read an empty DATABASE_URL from a clean shell.
 *
 * A real dependency (dotenv) is avoidable for a handful of KEY=VALUE lines,
 * so this is a small hand-rolled parser instead of adding one.
 */
function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnv() {
  // Precedence, lowest to highest: .env, .env.local, then whatever the
  // shell already exported (never overwritten) — same precedence Next.js
  // itself uses.
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const parsed = parseEnvFile(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
