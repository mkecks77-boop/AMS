import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addObligation,
  changeEquipmentStatus,
  recordInspection,
  saveEquipment,
} from "@/lib/equipment";
import { createSite, saveEmployee } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

async function machine(actor: { userId: string; isPlatformAdmin: boolean }, orgId: string, inv = "M-001") {
  return saveEquipment(actor, orgId, null, { inventoryNumber: inv, name: "Drehmaschine", category: "Maschinen" });
}

describe("Mandantentrennung", () => {
  it("Standort eines anderen Unternehmens kann nicht verknüpft werden", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const siteB = await createSite(actor, orgB, { name: "Werk B" });
    await expect(
      saveEquipment(actor, orgA, null, { inventoryNumber: "1", name: "X", category: "Maschinen", siteId: siteB.id }),
    ).rejects.toThrow("Standort nicht gefunden");
    await expect(
      saveEmployee(actor, orgA, null, { firstName: "A", lastName: "B", siteId: siteB.id }),
    ).rejects.toThrow("Standort nicht gefunden");
  });

  it("Prüfung zu Prüfpflicht eines anderen Unternehmens wird abgelehnt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const eqB = await machine(actor, orgB);
    const obB = await addObligation(actor, orgB, { equipmentId: eqB.id, title: "UVV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" });
    await expect(
      recordInspection(actor, orgA, { obligationId: obB.id, performedAt: d("2026-01-01"), inspectorName: "P", result: "PASSED" }),
    ).rejects.toThrow("nicht gefunden");
  });

  it("gleiche Inventarnummer in zwei Unternehmen erlaubt, im selben nicht", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    await machine(actor, orgA);
    await machine(actor, orgB);
    await expect(machine(actor, orgA)).rejects.toThrow("bereits vergeben");
  });
});

describe("Prüfungen", () => {
  it("mehrere Prüfpflichten je Anlage; Prüfung setzt nächste Fälligkeit", async () => {
    const { actor, orgA } = await twoOrgs();
    const eq = await machine(actor, orgA);
    const e = await addObligation(actor, orgA, { equipmentId: eq.id, title: "E-Prüfung", intervalMonths: 12, inspectorType: "COMPETENT_PERSON", firstDueAt: d("2026-12-01") });
    await addObligation(actor, orgA, { equipmentId: eq.id, title: "UVV", intervalMonths: 24, inspectorType: "EXTERNAL", firstDueAt: d("2027-06-01") });

    await recordInspection(actor, orgA, { obligationId: e.id, performedAt: d("2026-11-05"), inspectorName: "Elektro Meier", result: "PASSED" }, d("2026-11-09"));
    const after = await db.inspectionObligation.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.nextDueAt).toEqual(d("2027-11-05"));
    expect(await db.inspectionObligation.count({ where: { equipmentId: eq.id } })).toBe(2);
  });

  it("nachträglich erfasste ältere Prüfung verschiebt die Fälligkeit nicht", async () => {
    const { actor, orgA } = await twoOrgs();
    const eq = await machine(actor, orgA);
    const ob = await addObligation(actor, orgA, { equipmentId: eq.id, title: "UVV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" });
    await recordInspection(actor, orgA, { obligationId: ob.id, performedAt: d("2026-10-01"), inspectorName: "P", result: "PASSED" });
    await recordInspection(actor, orgA, { obligationId: ob.id, performedAt: d("2025-10-01"), inspectorName: "P", result: "PASSED" });
    const after = await db.inspectionObligation.findUniqueOrThrow({ where: { id: ob.id } });
    expect(after.nextDueAt).toEqual(d("2027-10-01"));
  });

  it("nicht bestanden sperrt die Anlage, Freigabe nur mit Begründung", async () => {
    const { actor, orgA } = await twoOrgs();
    const eq = await machine(actor, orgA);
    const ob = await addObligation(actor, orgA, { equipmentId: eq.id, title: "UVV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" });
    await expect(
      recordInspection(actor, orgA, { obligationId: ob.id, performedAt: d("2026-01-01"), inspectorName: "P", result: "FAILED" }),
    ).rejects.toThrow("Mängel beschreiben");
    await recordInspection(actor, orgA, { obligationId: ob.id, performedAt: d("2026-01-01"), inspectorName: "P", result: "FAILED", notes: "Not-Halt defekt" });

    const locked = await db.equipment.findUniqueOrThrow({ where: { id: eq.id }, include: { statusChanges: true } });
    expect(locked.status).toBe("LOCKED");
    expect(locked.statusChanges).toHaveLength(1);

    await expect(changeEquipmentStatus(actor, orgA, eq.id, "ACTIVE")).rejects.toThrow("begründen");
    await changeEquipmentStatus(actor, orgA, eq.id, "ACTIVE", "Not-Halt getauscht, Nachprüfung i. O.");
    expect((await db.equipment.findUniqueOrThrow({ where: { id: eq.id } })).status).toBe("ACTIVE");
  });

  it("Prüfdatum in der Zukunft wird abgelehnt", async () => {
    const { actor, orgA } = await twoOrgs();
    const eq = await machine(actor, orgA);
    const ob = await addObligation(actor, orgA, { equipmentId: eq.id, title: "UVV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" });
    await expect(
      recordInspection(actor, orgA, { obligationId: ob.id, performedAt: d("2026-12-01"), inspectorName: "P", result: "PASSED" }, d("2026-11-09")),
    ).rejects.toThrow("Zukunft");
  });
});

describe("Fristenkalender", () => {
  it("zeigt Fristen des eigenen Unternehmens, ohne stillgelegte Anlagen, mit Ampel und Standortfilter", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const site1 = await createSite(actor, orgA, { name: "Werk 1" });
    const eq1 = await saveEquipment(actor, orgA, null, { inventoryNumber: "1", name: "Presse", category: "Maschinen", siteId: site1.id });
    const eq2 = await machine(actor, orgA, "2");
    const eq3 = await machine(actor, orgA, "3");
    const eqB = await machine(actor, orgB, "B1");
    const base = { intervalMonths: 12, inspectorType: "COMPETENT_PERSON" as const };
    await addObligation(actor, orgA, { ...base, equipmentId: eq1.id, title: "überfällig", firstDueAt: d("2026-10-01") });
    await addObligation(actor, orgA, { ...base, equipmentId: eq2.id, title: "bald", firstDueAt: d("2026-11-20") });
    await addObligation(actor, orgA, { ...base, equipmentId: eq3.id, title: "stillgelegt", firstDueAt: d("2026-10-01") });
    await addObligation(actor, orgB, { ...base, equipmentId: eqB.id, title: "fremd", firstDueAt: d("2026-10-01") });
    await changeEquipmentStatus(actor, orgA, eq3.id, "DECOMMISSIONED");

    const now = d("2026-11-09");
    const all = await getDeadlines(orgA, {}, now);
    expect(all.map((x) => [x.title, x.status])).toEqual([["überfällig", "overdue"], ["bald", "due30"]]);
    expect((await getDeadlines(orgA, { siteId: site1.id }, now)).map((x) => x.title)).toEqual(["überfällig"]);
    expect((await getDeadlines(orgA, { status: "due30" }, now)).map((x) => x.title)).toEqual(["bald"]);
  });
});
