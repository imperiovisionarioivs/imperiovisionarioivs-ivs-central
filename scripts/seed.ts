import { loadEnv } from "./load-env";
loadEnv();

import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Ezequiel Batista";
  // Explicit opt-in required to touch an existing user's password/active
  // state. Without this, re-running `npm run db:seed` (e.g. as part of a
  // deploy script, or by habit) would silently reset whatever password is
  // currently in use and silently reactivate an account someone had
  // deliberately deactivated — both are real incidents waiting to happen,
  // not just theoretical.
  const forceReset = process.env.SEED_FORCE_RESET === "true";

  if (!email || !password) {
    console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD nas variáveis de ambiente.");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing[0]) {
    if (!forceReset) {
      console.log(
        `Usuário já existe: ${email} (role: ${existing[0].role}, active: ${existing[0].active}). ` +
          "Nada foi alterado. Defina SEED_FORCE_RESET=true para forçar redefinição de senha e reativação."
      );
      process.exit(0);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash, active: true }).where(eq(users.email, email));
    console.log(`Usuário existente atualizado (SEED_FORCE_RESET=true): ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ name, email, passwordHash, role: "admin" });
    console.log(`Usuário admin criado: ${email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
