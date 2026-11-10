import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { copyAssessment, deleteHazard, releaseAssessment, releaseProblems, riskLevel, saveAssessment, saveHazard } from "@/lib/risk";
import { complianceRate, createTemplate, ensureDefaultTemplates, planWalkthrough, saveAnswers } from "@/lib/walkthroughs";
import { ensureDefaultPpe, issuePpe, returnPpe } from "@/lib/ppe";
import { appoint, endAppointment } from "@/lib/appointments";
import { createAction } from "@/lib/measures";
import { createSite, saveEmployee } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("Regeln", () => {
  it("Risikomatrix 5×5", () => {
    expect(riskLevel(1, 4)).toBe("low");
    expect(riskLevel(1, 5)).toBe("medium");
    expect(riskLevel(3, 3)).toBe("medium");
    expect(riskLevel(2, 5)).toBe("high");
    expect(riskLevel(4, 5)).toBe("very_high");
  });
  it("Freigabehindernisse", () => {
    expect(releaseProblems([])).toHaveLength(1);
    const h = { description: "Quetschen", probability: 4, severity: 4, measures: "", residualProbability: null, residualSeverity: null };
    expect(releaseProblems([h])).toHaveLength(2);
    expect(releaseProblems([{ ...h, measures: "Schutzgitter", residualProbability: 5, residualSeverity: 4 }])[0]).toContain("sehr hoch");
    expect(releaseProblems([{ ...h, measures: "Schutzgitter", residualProbability: 1, residualSeverity: 4 }])).toHaveLength(0);
  });
  it("Erfüllungsgrad", () => {
    expect(complianceRate([{ result: "OK" }, { result: "OK" }, { result: "DEFECT" }, { result: "NA" }])).toBe(67);
    expect(complianceRate([{ result: "NA" }])).toBeNull();
  });
});

describe("Phase 6", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("GBU: Gefährdung erfassen, Freigabe, Änderung setzt zurück, Frist, Kopie, Maßnahme", async () => {
    const { actor, orgA } = await twoOrgs();
    const ra = await saveAssessment(actor, orgA, null, { title: "Drehmaschine", kind: "GENERAL", reviewIntervalMonths: 24 });
    const h = await saveHazard(actor, orgA, ra.id, null, { factor: "1", description: "Erfassen durch rotierende Teile", probability: 3, severity: 4 });
    await expect(releaseAssessment(actor, orgA, ra.id)).rejects.toThrow("Schutzmaßnahmen fehlen");
    await saveHazard(actor, orgA, ra.id, h.id, { factor: "1", description: "Erfassen durch rotierende Teile", probability: 3, severity: 4, measures: "Verriegelte Schutztür", residualProbability: 1, residualSeverity: 4 });
    await expect(saveHazard(actor, orgA, ra.id, null, { factor: "99", description: "x", probability: 1, severity: 1 })).rejects.toThrow("Gefährdungsfaktor");
    await expect(saveHazard(actor, orgA, ra.id, null, { factor: "2", description: "x", probability: 6, severity: 1 })).rejects.toThrow("zwischen 1 und 5");

    await releaseAssessment(actor, orgA, ra.id, d("2025-12-01"));
    const rel = await db.riskAssessment.findUniqueOrThrow({ where: { id: ra.id } });
    expect(rel.reviewDue).toEqual(d("2027-12-01"));
    const dl = await getDeadlines(orgA, { until: d("2028-01-01") }, d("2027-11-15"));
    expect(dl.map((x) => [x.source, x.status])).toEqual([["risk", "due30"]]);

    const a = await createAction(actor, orgA, { title: "Not-Halt prüfen", dueDate: d("2026-12-01") }, { riskAssessmentId: ra.id, hazardId: h.id });
    expect(a.sourceType).toBe("RISK");

    const h2 = await saveHazard(actor, orgA, ra.id, null, { factor: "7", description: "Lärm", probability: 3, severity: 2, measures: "Gehörschutz", residualProbability: 2, residualSeverity: 2 });
    expect((await db.riskAssessment.findUniqueOrThrow({ where: { id: ra.id } })).status).toBe("DRAFT");
    await deleteHazard(actor, orgA, ra.id, h2.id);

    const copy = await copyAssessment(actor, orgA, ra.id);
    expect(await db.hazard.count({ where: { assessmentId: copy.id } })).toBe(1);
    expect(copy.status).toBe("DRAFT");
  });

  it("GBU: Mandantentrennung", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const ra = await saveAssessment(actor, orgA, null, { title: "A", kind: "GENERAL" });
    const siteB = await createSite(actor, orgB, { name: "B" });
    await expect(saveHazard(actor, orgB, ra.id, null, { factor: "1", description: "x", probability: 1, severity: 1 })).rejects.toThrow("nicht gefunden");
    await expect(saveAssessment(actor, orgA, null, { title: "X", kind: "GENERAL", siteId: siteB.id })).rejects.toThrow("Standort");
    await expect(createAction(actor, orgB, { title: "t", dueDate: d("2026-12-01") }, { riskAssessmentId: ra.id })).rejects.toThrow("nicht gefunden");
  });

  it("Begehung: Standardchecklisten, Abschluss nur vollständig, Mängel beschreiben, Frist", async () => {
    const { actor, orgA } = await twoOrgs();
    await ensureDefaultTemplates(orgA);
    await ensureDefaultTemplates(orgA);
    expect(await db.checklistTemplate.count({ where: { organizationId: orgA } })).toBe(2);
    const t = await createTemplate(actor, orgA, { title: "Lager", itemsText: "Regale: Belastungsschild vorhanden\nRegale: Anfahrschutz\nOrdnung" });
    const items = await db.checklistItem.findMany({ where: { templateId: t.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.section)).toEqual(["Regale", "Regale", "Allgemein"]);

    const w = await planWalkthrough(actor, orgA, { templateId: t.id, plannedAt: d("2026-11-20"), auditor: "Sifa" });
    expect((await getDeadlines(orgA, {}, d("2026-11-09"))).map((x) => x.source)).toEqual(["walkthrough"]);

    const answers = items.map((i, n) => ({ itemId: i.id, result: (n === 1 ? "DEFECT" : "OK") as "OK" | "DEFECT" }));
    await expect(saveAnswers(actor, orgA, w.id, answers.slice(0, 2), { complete: true })).rejects.toThrow("alle Prüfpunkte");
    await expect(saveAnswers(actor, orgA, w.id, answers, { complete: true })).rejects.toThrow("Mangel");
    answers[1] = { ...answers[1], note: "Anfahrschutz fehlt an Regal 3" } as typeof answers[1];
    await saveAnswers(actor, orgA, w.id, answers, { complete: true, summary: "Insgesamt gut" });
    await expect(saveAnswers(actor, orgA, w.id, answers)).rejects.toThrow("abgeschlossen");
    const done = await db.walkthrough.findUniqueOrThrow({ where: { id: w.id }, include: { answers: true } });
    expect(done.status).toBe("DONE");
    expect(complianceRate(done.answers)).toBe(67);
    expect(await getDeadlines(orgA, {}, d("2026-11-09"))).toHaveLength(0);
  });

  it("PSA: Ausgabe mit Austauschfrist, Rückgabe beendet Frist; fremde Person abgelehnt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    await ensureDefaultPpe(orgA);
    const shoes = await db.ppeItem.findFirstOrThrow({ where: { organizationId: orgA, name: "Sicherheitsschuhe S3" } });
    const e = await saveEmployee(actor, orgA, null, { firstName: "Tom", lastName: "D" });
    const eB = await saveEmployee(actor, orgB, null, { firstName: "X", lastName: "Y" });
    const now = d("2026-11-09");
    const issue = await issuePpe(actor, orgA, { itemId: shoes.id, employeeId: e.id, size: "43", issuedAt: d("2025-12-01") }, now);
    expect(issue.replaceDue).toEqual(d("2026-12-01"));
    await expect(issuePpe(actor, orgA, { itemId: shoes.id, employeeId: eB.id, issuedAt: d("2026-01-01") }, now)).rejects.toThrow("nicht gefunden");
    expect((await getDeadlines(orgA, {}, now)).map((x) => [x.source, x.status])).toEqual([["ppe", "due30"]]);
    await returnPpe(actor, orgA, issue.id, now);
    expect(await getDeadlines(orgA, {}, now)).toHaveLength(0);
  });

  it("Beauftragte: Pflichtenübertragung braucht Bereich, befristete Bestellung als Frist", async () => {
    const { actor, orgA } = await twoOrgs();
    const e = await saveEmployee(actor, orgA, null, { firstName: "Max", lastName: "M" });
    await expect(appoint(actor, orgA, { employeeId: e.id, role: "DUTY_TRANSFER", appointedAt: d("2026-01-01") })).rejects.toThrow("Verantwortungsbereich");
    await expect(appoint(actor, orgA, { employeeId: e.id, role: "XYZ", appointedAt: d("2026-01-01") })).rejects.toThrow("Unbekannte");
    const a = await appoint(actor, orgA, { employeeId: e.id, role: "SAFETY_REP", appointedAt: d("2024-01-01"), validUntil: d("2026-12-31") });
    expect((await getDeadlines(orgA, {}, d("2026-11-09"))).map((x) => x.source)).toEqual(["appointment"]);
    await endAppointment(actor, orgA, a.id);
    expect(await getDeadlines(orgA, {}, d("2026-11-09"))).toHaveLength(0);
  });
});
