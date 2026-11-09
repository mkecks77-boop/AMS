import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addQualification,
  effectiveInterval,
  ensureDefaultQualificationTypes,
  getMatrix,
  isRequired,
  quotaReport,
  recordSession,
  requiredCount,
  saveTopic,
  setRequirements,
  topicFromInstruction,
  trainingStatus,
  validUntilFor,
} from "@/lib/trainings";
import { createDepartment, createSite, saveEmployee } from "@/lib/masterdata";
import { createInstruction, releaseInstruction, submitForReview } from "@/lib/instructions";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("Regeln", () => {
  it("Azubis: Unterweisung halbjährlich, Schulungen unverändert", () => {
    expect(effectiveInterval("INSTRUCTION", 12, true)).toBe(6);
    expect(effectiveInterval("INSTRUCTION", 12, false)).toBe(12);
    expect(effectiveInterval("COURSE", 24, true)).toBe(24);
    expect(effectiveInterval("INSTRUCTION", 0, true)).toBe(0);
    expect(validUntilFor(d("2026-01-15"), "INSTRUCTION", 12, true)).toEqual(d("2026-07-15"));
    expect(validUntilFor(d("2026-01-15"), "INSTRUCTION", 0, false)).toBeNull();
  });
  it("Status", () => {
    const now = d("2026-11-09");
    expect(trainingStatus(null, now)).toBe("missing");
    expect(trainingStatus({ validUntil: null }, now)).toBe("ok");
    expect(trainingStatus({ validUntil: d("2026-11-01") }, now)).toBe("overdue");
  });
  it("Quoten", () => {
    expect(requiredCount(0, 10)).toBe(0);
    expect(requiredCount(15, 10)).toBe(2);
    expect(requiredCount(8, 5)).toBe(1);
    expect(requiredCount(100, 5)).toBe(5);
  });
  it("Zuordnung nach Abteilung und Azubi", () => {
    const e = { departmentId: "d1", apprentice: false };
    expect(isRequired([{ departmentId: null, apprenticesOnly: false }], e)).toBe(true);
    expect(isRequired([{ departmentId: "d2", apprenticesOnly: false }], e)).toBe(false);
    expect(isRequired([{ departmentId: null, apprenticesOnly: true }], e)).toBe(false);
    expect(isRequired([{ departmentId: null, apprenticesOnly: true }], { ...e, apprentice: true })).toBe(true);
  });
});

describe("Unterweisungen und Qualifikationen", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("Unterweisung erfassen, Matrix und Fristen; Azubi bekommt 6 Monate", async () => {
    const { actor, orgA } = await twoOrgs();
    const dep = await createDepartment(actor, orgA, { name: "Fertigung" });
    const max = await saveEmployee(actor, orgA, null, { firstName: "Max", lastName: "A", departmentId: dep.id });
    const azubi = await saveEmployee(actor, orgA, null, { firstName: "Jan", lastName: "B", departmentId: dep.id, apprentice: true });
    const other = await saveEmployee(actor, orgA, null, { firstName: "Eva", lastName: "C" });
    const topic = await saveTopic(actor, orgA, null, { title: "Allgemeine Unterweisung", kind: "INSTRUCTION", intervalMonths: 12 });
    await setRequirements(actor, orgA, topic.id, { allEmployees: false, departmentIds: [dep.id], apprenticesOnly: false });

    const now = d("2026-11-09");
    await recordSession(actor, orgA, { topicId: topic.id, date: d("2026-06-01"), trainer: "Sifa", employeeIds: [max.id, azubi.id] }, now);

    const recs = await db.trainingRecord.findMany({ orderBy: { validUntil: "asc" } });
    expect(recs.map((r) => r.validUntil)).toEqual([d("2026-12-01"), d("2027-06-01")]);

    const m = await getMatrix(orgA, {}, now);
    const row = (id: string) => m.rows.find((r) => r.employee.id === id)!.cells[0];
    expect(row(max.id).status).toBe("ok");
    expect(row(azubi.id).status).toBe("due30");
    expect(row(other.id).required).toBe(false);
    expect(m.rate).toBe(100);

    const dl = await getDeadlines(orgA, { until: d("2027-12-31") }, now);
    expect(dl.filter((x) => x.source === "training").map((x) => x.subject)).toEqual(["B, Jan", "A, Max"]);
  });

  it("Mandantentrennung bei Teilnehmenden und Themen", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const eB = await saveEmployee(actor, orgB, null, { firstName: "X", lastName: "Y" });
    const t = await saveTopic(actor, orgA, null, { title: "T", kind: "INSTRUCTION", intervalMonths: 12 });
    await expect(recordSession(actor, orgA, { topicId: t.id, date: d("2026-01-01"), trainer: "S", employeeIds: [eB.id] })).rejects.toThrow("nicht gefunden");
    await expect(recordSession(actor, orgB, { topicId: t.id, date: d("2026-01-01"), trainer: "S", employeeIds: [eB.id] })).rejects.toThrow("Thema");
  });

  it("Unterweisung aus freigegebener Betriebsanweisung", async () => {
    const { actor, orgA } = await twoOrgs();
    const reviewer = await db.user.create({ data: { email: "r@x.de", name: "R", passwordHash: "x" } });
    const ba = await createInstruction(actor, orgA, {
      type: "MACHINE", title: "Bandsäge", hazards: "Schnitt", protectiveMeasures: "Schutzhaube", malfunctions: "NOT-HALT", firstAid: "112", maintenance: "nur Fachkraft", pictograms: [],
    });
    await expect(topicFromInstruction(actor, orgA, ba.id)).rejects.toThrow("freigegebene");
    await submitForReview(actor, orgA, ba.id);
    await releaseInstruction({ userId: reviewer.id, isPlatformAdmin: false }, orgA, ba.id);
    const t = await topicFromInstruction(actor, orgA, ba.id);
    expect(t.title).toBe("Unterweisung: Bandsäge");
    expect(t.content).toContain("Schutzhaube");
    expect((await topicFromInstruction(actor, orgA, ba.id)).id).toBe(t.id);
  });

  it("Qualifikationen: Standardarten, Ablauf, Quote je Standort", async () => {
    const { actor, orgA } = await twoOrgs();
    await ensureDefaultQualificationTypes(orgA);
    await ensureDefaultQualificationTypes(orgA);
    const types = await db.qualificationType.findMany({ where: { organizationId: orgA } });
    expect(types.length).toBeGreaterThan(5);
    const ersthelfer = types.find((t) => t.category === "FIRST_AID")!;

    const site = await createSite(actor, orgA, { name: "Werk" });
    const emps = [];
    for (let i = 0; i < 12; i++) emps.push(await saveEmployee(actor, orgA, null, { firstName: `P${i}`, lastName: "N", siteId: site.id }));
    const now = d("2026-11-09");
    const q = await addQualification(actor, orgA, { employeeId: emps[0].id, typeId: ersthelfer.id, acquiredAt: d("2025-03-01") }, now);
    expect(q.validUntil).toEqual(d("2027-03-01"));
    await addQualification(actor, orgA, { employeeId: emps[1].id, typeId: ersthelfer.id, acquiredAt: d("2024-01-01") }, now);

    const [werk] = await quotaReport(orgA, now);
    expect(werk).toMatchObject({ site: "Werk", employees: 12, firstAid: 1, firstAidRequired: 2, fireWarden: 0, fireWardenRequired: 1 });

    const dl = await getDeadlines(orgA, { until: d("2027-12-31") }, now);
    expect(dl.filter((x) => x.source === "qualification").map((x) => x.status)).toEqual(["overdue", "ok"]);
  });
});
