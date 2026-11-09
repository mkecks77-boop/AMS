/** Demodaten zum Ausprobieren. Passwort für alle: Demo-Passwort1 */
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("Demo-Passwort1");
  const orgs = await Promise.all(
    [
      { name: "Muster Metallbau GmbH", slug: "muster-metallbau" },
      { name: "Beispiel Logistik AG", slug: "beispiel-logistik" },
    ].map((o) => db.organization.upsert({ where: { slug: o.slug }, create: o, update: {} })),
  );

  const users: { email: string; name: string; platform?: boolean; m: [number, Role, boolean][] }[] = [
    { email: "betreiber@example.com", name: "Paula Plattform", platform: true, m: [] },
    { email: "sifa@example.com", name: "Erik Extern", m: [[0, "SAFETY_OFFICER", true], [1, "SAFETY_OFFICER", true]] },
    { email: "admin@metallbau.example.com", name: "Anna Admin", m: [[0, "ORG_ADMIN", false]] },
    { email: "meister@metallbau.example.com", name: "Max Meister", m: [[0, "MANAGER", false]] },
    { email: "admin@logistik.example.com", name: "Lea Logistik", m: [[1, "ORG_ADMIN", false]] },
  ];

  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash, isPlatformAdmin: !!u.platform },
      update: {},
    });
    for (const [i, role, external] of u.m) {
      await db.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: orgs[i].id } },
        create: { userId: user.id, organizationId: orgs[i].id, role, external },
        update: {},
      });
    }
  }
  console.log("Demodaten angelegt. Passwort: Demo-Passwort1");
}

main().finally(() => db.$disconnect());
