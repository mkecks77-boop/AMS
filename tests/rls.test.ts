import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, transaction } from "@/lib/db";
import { runWithTenant, withoutTenant } from "@/lib/tenant";
import { saveEquipment } from "@/lib/equipment";
import { createSite, saveEmployee } from "@/lib/masterdata";
import { createPasswordReset, UserError } from "@/lib/users";
import { resetDb, twoOrgs } from "./helpers";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

async function data() {
  const { actor, orgA, orgB } = await twoOrgs();
  const eqA = await saveEquipment(actor, orgA, null, { inventoryNumber: "A-1", name: "Presse A", category: "Maschinen" });
  const eqB = await saveEquipment(actor, orgB, null, { inventoryNumber: "B-1", name: "Presse B", category: "Maschinen" });
  return { actor, orgA, orgB, eqA, eqB };
}

describe("Row-Level Security", () => {
  it("die Testverbindung umgeht RLS nicht (kein Superuser)", async () => {
    const [r] = await db.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(r).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("Lesen ohne Filter liefert im Mandanten-Kontext nur eigene Zeilen", async () => {
    const { orgA, eqB } = await data();
    // absichtlich OHNE organizationId-Filter – simuliert einen vergessenen Filter im Code
    const seen = await runWithTenant(orgA, () => db.equipment.findMany());
    expect(seen.map((e) => e.inventoryNumber)).toEqual(["A-1"]);
    expect(await runWithTenant(orgA, () => db.equipment.findUnique({ where: { id: eqB.id } }))).toBeNull();
    expect(await runWithTenant(orgA, () => db.equipment.count())).toBe(1);
    // ohne Mandanten-Kontext (System) sieht die Anwendung alles
    expect(await db.equipment.count()).toBe(2);
  });

  it("Ändern und Löschen fremder Zeilen wirkt nicht, Anlegen für fremdes Unternehmen wird abgelehnt", async () => {
    const { orgA, orgB, eqB } = await data();
    const upd = await runWithTenant(orgA, () => db.equipment.updateMany({ where: { id: eqB.id }, data: { name: "gehackt" } }));
    expect(upd.count).toBe(0);
    const del = await runWithTenant(orgA, () => db.equipment.deleteMany({}));
    expect(del.count).toBe(1);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: eqB.id } })).name).toBe("Presse B");
    await expect(runWithTenant(orgA, () => db.site.create({ data: { organizationId: orgB, name: "untergeschoben" } }))).rejects.toThrow();
    // Verschieben einer eigenen Zeile in ein fremdes Unternehmen ebenfalls nicht möglich
    const site = await runWithTenant(orgA, () => db.site.create({ data: { organizationId: orgA, name: "eigen" } }));
    await expect(runWithTenant(orgA, () => db.site.update({ where: { id: site.id }, data: { organizationId: orgB } }))).rejects.toThrow();
  });

  it("gilt auch innerhalb von Transaktionen und für verknüpfte Daten", async () => {
    const { actor, orgA, orgB } = await data();
    const siteB = await createSite(actor, orgB, { name: "Werk B" });
    await saveEmployee(actor, orgB, null, { firstName: "X", lastName: "B", siteId: siteB.id });
    const inTx = await runWithTenant(orgA, () => transaction((tx) => tx.employee.findMany()));
    expect(inTx).toHaveLength(0);
    const sites = await runWithTenant(orgA, () => db.site.findMany({ include: { employees: true } }));
    expect(sites).toHaveLength(0);
    // Services funktionieren im Mandanten-Kontext normal
    const own = await runWithTenant(orgA, () => saveEmployee(actor, orgA, null, { firstName: "Y", lastName: "A" }));
    expect(own.organizationId).toBe(orgA);
  });

  it("bewusst mandantenübergreifende Prüfungen funktionieren weiter (Passwort-Reset externer Sifa)", async () => {
    const { orgA, orgB } = await data();
    const admin = await db.user.create({ data: { email: "admin@a.de", name: "A", passwordHash: "x" } });
    const sifa = await db.user.create({ data: { email: "sifa@extern.de", name: "S", passwordHash: "x" } });
    await db.membership.createMany({ data: [
      { userId: admin.id, organizationId: orgA, role: "ORG_ADMIN" },
      { userId: sifa.id, organizationId: orgA, role: "SAFETY_OFFICER" },
      { userId: sifa.id, organizationId: orgB, role: "SAFETY_OFFICER" },
    ] });
    // ohne withoutTenant würde die Mitgliedschaft in B unsichtbar – und der Reset fälschlich erlaubt
    await expect(runWithTenant(orgA, () => createPasswordReset({ userId: admin.id, isPlatformAdmin: false }, { organizationId: orgA, targetUserId: sifa.id }))).rejects.toThrow(UserError);
    expect(await runWithTenant(orgA, () => withoutTenant(() => db.membership.count({ where: { userId: sifa.id } })))).toBe(2);
  });
});
