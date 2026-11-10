/**
 * Legt das Konto des Plattform-Betreibers an.
 *   npm run setup -- --email du@firma.de --name "Max Muster"
 * Das Passwort wird interaktiv abgefragt bzw. über AMS_SETUP_PASSWORD gesetzt.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePassword } from "../src/lib/password";

const db = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  if (!email || !name) throw new Error('Aufruf: npm run setup -- --email du@firma.de --name "Max Muster"');

  let password = process.env.AMS_SETUP_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Passwort: ");
    rl.close();
  }
  const err = validatePassword(password);
  if (err) throw new Error(err);

  const user = await db.user.upsert({
    where: { email },
    create: { email, name, passwordHash: await hashPassword(password), isPlatformAdmin: true },
    update: { name, passwordHash: await hashPassword(password), isPlatformAdmin: true, active: true },
  });
  console.log(`Plattform-Admin ${user.email} ist eingerichtet. Anmelden und unter „Plattform“ Unternehmen anlegen.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
