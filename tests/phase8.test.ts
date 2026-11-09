import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ensureDefaultMedicalTypes, medicalOverview, recordMedical, setMedicalRequirements } from "@/lib/medical";
import { activatePermit, addWorker, briefWorker, closePermit, contractorProblems, decidePermit, PERMIT_CHECKS, requestPermit, saveContractor, setContractorBlocked } from "@/lib/contractors";
import { complianceRateOf, ensureDefaultLegal, evaluateLegal } from "@/lib/legal";
import { createAction } from "@/lib/measures";
import { createDepartment, saveEmployee } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const t = (s: string) => new Date(`${s}:00Z`);

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("Arbeitsmedizinische Vorsorge", () => {
  it("Pflichtvorsorge fehlt → Tätigkeitsverbot; Erfassung, Frist, keine Ablehnung bei Pflicht", async () => {
    const { actor, orgA } = await twoOrgs();
    await ensureDefaultMedicalTypes(orgA);
    const laerm = await db.medicalCheckType.findFirstOrThrow({ where: { organizationId: orgA, name: "Lärm (Pflicht)" } });
    const bild = await db.medicalCheckType.findFirstOrThrow({ where: { organizationId: orgA, name: "Bildschirmarbeit" } });
    const dep = await createDepartment(actor, orgA, { name: "Fertigung" });
    const e = await saveEmployee(actor, orgA, null, { firstName: "Tom", lastName: "D", departmentId: dep.id });
    const office = await saveEmployee(actor, orgA, null, { firstName: "Eva", lastName: "B" });
    await setMedicalRequirements(actor, orgA, laerm.id, { allEmployees: false, departmentIds: [dep.id] });
    await setMedicalRequirements(actor, orgA, bild.id, { allEmployees: true, departmentIds: [] });
    const now = d("2026-11-09");

    let o = await medicalOverview(orgA, now);
    expect(o.rows.find((r) => r.employee.id === e.id)!.blocked).toBe(true);
    expect(o.rows.find((r) => r.employee.id === office.id)!.blocked).toBe(false);

    await expect(recordMedical(actor, orgA, { typeId: laerm.id, employeeId: e.id, date: d("2026-01-10"), outcome: "DECLINED" }, now)).rejects.toThrow("Pflichtvorsorge");
    await recordMedical(actor, orgA, { typeId: laerm.id, employeeId: e.id, date: d("2024-01-10"), outcome: "DONE" }, now);
    await recordMedical(actor, orgA, { typeId: bild.id, employeeId: office.id, date: d("2026-01-10"), outcome: "DECLINED" }, now);
    o = await medicalOverview(orgA, now);
    expect(o.rows.find((r) => r.employee.id === e.id)!.blocked).toBe(false);
    const dl = (await getDeadlines(orgA, { until: d("2027-12-31") }, now)).filter((x) => x.source === "medical");
    expect(dl.map((x) => [x.subject, x.dueAt])).toEqual([["D, Tom", d("2027-01-10")]]);
    const log = await db.auditLog.findFirst({ where: { action: "medical.recorded" } });
    expect(JSON.stringify(log?.details)).not.toMatch(/DONE|DECLINED/);
  });
});

describe("Fremdfirmen und Erlaubnisscheine", () => {
  it("Hinderungsgründe", () => {
    const at = d("2026-11-09");
    expect(contractorProblems({ name: "X", blocked: false, blockReason: null, insuranceUntil: d("2027-01-01") }, [{ name: "A", briefedUntil: d("2027-01-01") }], at)).toEqual([]);
    expect(contractorProblems({ name: "X", blocked: true, blockReason: "Verstoß", insuranceUntil: null }, [{ name: "A", briefedUntil: null }], at)).toHaveLength(3);
  });

  it("Ablauf: Antrag → Vier-Augen-Genehmigung → Freigabe mit Checkliste → Abschluss mit Brandwache", async () => {
    const { actor, orgA } = await twoOrgs();
    const boss = await db.user.create({ data: { email: "boss@x.de", name: "B", passwordHash: "x" } });
    const approver = { userId: boss.id, isPlatformAdmin: false };
    const c = await saveContractor(actor, orgA, null, { name: "Schweiß GmbH", insuranceUntil: d("2027-06-30") });
    const w = await addWorker(actor, orgA, { contractorId: c.id, name: "Karl Schweißer" });
    const base = { type: "HOT_WORK" as const, location: "Halle 1, Dach", description: "Schweißen an Stahlträger", contractorId: c.id, workerIds: [w.id] };
    await expect(requestPermit(actor, orgA, { ...base, validFrom: t("2026-11-10T08:00"), validTo: t("2026-11-11T12:00") })).rejects.toThrow("24 Stunden");
    const p = await requestPermit(actor, orgA, { ...base, validFrom: t("2026-11-10T08:00"), validTo: t("2026-11-10T16:00") });
    expect(p.number).toBe("E2026-001");

    await expect(decidePermit(actor, orgA, p.id, true)).rejects.toThrow("Vier-Augen");
    await expect(decidePermit(approver, orgA, p.id, true, null, t("2026-11-09T12:00"))).rejects.toThrow("Fremdfirmeneinweisung");
    await briefWorker(actor, orgA, w.id, d("2026-11-09"), t("2026-11-09T12:00"));
    await decidePermit(approver, orgA, p.id, true, null, t("2026-11-09T12:00"));

    await expect(activatePermit(approver, orgA, p.id, PERMIT_CHECKS.HOT_WORK, t("2026-11-10T06:30"))).rejects.toThrow("frühestens");
    const now = t("2026-11-10T08:30");
    await expect(activatePermit(approver, orgA, p.id, PERMIT_CHECKS.HOT_WORK.slice(0, 2), now)).rejects.toThrow("Noch nicht bestätigt");
    await activatePermit(approver, orgA, p.id, PERMIT_CHECKS.HOT_WORK, now);
    await expect(closePermit(approver, orgA, p.id, null, t("2026-11-10T15:00"))).rejects.toThrow("Brandwache");
    await expect(closePermit(approver, orgA, p.id, t("2026-11-10T08:40"), t("2026-11-10T15:00"))).rejects.toThrow("30 Minuten");
    await closePermit(approver, orgA, p.id, t("2026-11-10T16:00"), t("2026-11-10T15:00"));
    expect((await db.permit.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CLOSED");
  });

  it("Gesperrte Fremdfirma kann nicht genehmigt werden; fremde Arbeiter abgelehnt; Fristen", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const boss = await db.user.create({ data: { email: "boss@x.de", name: "B", passwordHash: "x" } });
    const c = await saveContractor(actor, orgA, null, { name: "Dach KG", insuranceUntil: d("2026-11-30") });
    const cB = await saveContractor(actor, orgB, null, { name: "Andere", insuranceUntil: d("2027-11-30") });
    const wB = await addWorker(actor, orgB, { contractorId: cB.id, name: "X", briefedAt: d("2026-10-01") });
    await expect(requestPermit(actor, orgA, { type: "HEIGHT", location: "Dach", description: "Rinne", contractorId: c.id, workerIds: [wB.id], validFrom: t("2026-11-10T08:00"), validTo: t("2026-11-10T12:00") })).rejects.toThrow("gehören nicht");
    const p = await requestPermit(actor, orgA, { type: "HEIGHT", location: "Dach", description: "Rinne", contractorId: c.id, validFrom: t("2026-11-10T08:00"), validTo: t("2026-11-10T12:00") });
    await expect(setContractorBlocked(actor, orgA, c.id, true)).rejects.toThrow("begründen");
    await setContractorBlocked(actor, orgA, c.id, true, "Sicherheitsverstoß");
    await expect(decidePermit({ userId: boss.id, isPlatformAdmin: false }, orgA, p.id, true)).rejects.toThrow("gesperrt");
    await setContractorBlocked(actor, orgA, c.id, false);
    const dl = (await getDeadlines(orgA, {}, d("2026-11-09"))).filter((x) => x.source === "contractor");
    expect(dl.map((x) => x.title)).toEqual(["Haftpflichtnachweis läuft ab"]);
  });
});

describe("Rechtskataster", () => {
  it("Grundbestand, Bewertung mit Nachweis, Quote, Maßnahme, Frist", async () => {
    const { actor, orgA } = await twoOrgs();
    await ensureDefaultLegal(orgA);
    await ensureDefaultLegal(orgA);
    const all = await db.legalRequirement.findMany({ where: { organizationId: orgA }, orderBy: { createdAt: "asc" } });
    expect(all.length).toBeGreaterThan(15);
    const now = d("2026-11-09");
    await expect(evaluateLegal(actor, orgA, all[0].id, { status: "FULFILLED" }, now)).rejects.toThrow("Nachweis");
    await evaluateLegal(actor, orgA, all[0].id, { status: "FULFILLED", evidence: "Organigramm" }, now);
    await evaluateLegal(actor, orgA, all[1].id, { status: "PARTIAL" }, now);
    await evaluateLegal(actor, orgA, all[2].id, { status: "NOT_RELEVANT" }, now);
    const after = await db.legalRequirement.findMany({ where: { organizationId: orgA } });
    expect(complianceRateOf(after)).toBe(75);
    const a = await createAction(actor, orgA, { title: "Fehlende GBU erstellen", dueDate: d("2027-01-31") }, { legalRequirementId: all[1].id });
    expect(a.sourceType).toBe("LEGAL");
    const dl = (await getDeadlines(orgA, { until: d("2028-01-01") }, d("2027-11-01"))).filter((x) => x.source === "legal");
    expect(dl).toHaveLength(2);
  });
});
