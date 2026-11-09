/** Demodaten zum Ausprobieren. Passwort für alle: Demo-Passwort1 */
import { PrismaClient, type InspectorType, type Role } from "@prisma/client";
import { addMonths } from "../src/lib/dates";
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
  // Stammdaten, Anlagen und Prüfpflichten für Muster Metallbau
  const org = orgs[0];
  if ((await db.site.count({ where: { organizationId: org.id } })) === 0) {
    const werk = await db.site.create({ data: { organizationId: org.id, name: "Werk Nord", address: "Industriestr. 1, 12345 Musterstadt" } });
    const lager = await db.site.create({ data: { organizationId: org.id, name: "Lager Süd" } });
    const fertigung = await db.department.create({ data: { organizationId: org.id, name: "Fertigung", siteId: werk.id } });
    const logistik = await db.department.create({ data: { organizationId: org.id, name: "Logistik", siteId: lager.id } });
    const people = [
      ["1001", "Max", "Meister", "Meister Fertigung", werk.id, fertigung.id, false],
      ["1002", "Tom", "Dreher", "Zerspanungsmechaniker", werk.id, fertigung.id, false],
      ["1003", "Lisa", "Lager", "Fachkraft Lagerlogistik", lager.id, logistik.id, false],
      ["1004", "Jan", "Jung", "Auszubildender Metallbau", werk.id, fertigung.id, true],
    ] as const;
    const emps = [];
    for (const [nr, first, last, job, siteId, depId, azubi] of people) {
      emps.push(await db.employee.create({
        data: { organizationId: org.id, personnelNumber: nr, firstName: first, lastName: last, jobTitle: job, siteId, departmentId: depId, apprentice: azubi },
      }));
    }
    const now = new Date();
    const day = (n: number) => new Date(now.getTime() + n * 86400000);
    const machines: [string, string, string, string, string, [string, number, InspectorType, Date][]][] = [
      ["M-001", "CNC-Drehmaschine", "Maschinen", werk.id, emps[1].id, [
        ["Wiederkehrende Prüfung Maschine (Schutzeinrichtungen)", 12, "COMPETENT_PERSON", day(-12)],
        ["Prüfung ortsfester elektrischer Anlagen", 48, "COMPETENT_PERSON", day(200)],
      ]],
      ["S-001", "Gabelstapler Linde H25", "Flurförderzeuge", lager.id, emps[2].id, [
        ["Prüfung Flurförderzeug (Stapler)", 12, "COMPETENT_PERSON", day(18)],
      ]],
      ["R-001", "Palettenregal Halle 2", "Regale", lager.id, emps[2].id, [
        ["Inspektion Regalanlage", 12, "COMPETENT_PERSON", day(60)],
      ]],
      ["L-001", "Stehleiter 6 Stufen", "Leitern und Tritte", werk.id, emps[0].id, [
        ["Prüfung Leitern und Tritte", 12, "COMPETENT_PERSON", day(150)],
      ]],
      ["K-001", "Brückenkran 5 t", "Krane", werk.id, emps[0].id, [
        ["Prüfung Krananlage", 12, "COMPETENT_PERSON", day(25)],
        ["Prüfung Lastaufnahme- und Anschlagmittel", 12, "COMPETENT_PERSON", day(-3)],
      ]],
    ];
    for (const [inv, name, category, siteId, responsibleId, obs] of machines) {
      const eq = await db.equipment.create({
        data: { organizationId: org.id, inventoryNumber: inv, name, category, siteId, responsibleId, ceMarked: true, hasOperatingManual: true },
      });
      for (const [title, intervalMonths, inspectorType, nextDueAt] of obs) {
        await db.inspectionObligation.create({
          data: { organizationId: org.id, equipmentId: eq.id, title, intervalMonths, inspectorType, nextDueAt, lastInspectedAt: addMonths(nextDueAt, -intervalMonths) },
        });
      }
    }
  }

  console.log("Demodaten angelegt. Passwort: Demo-Passwort1");
}

main().finally(() => db.$disconnect());
