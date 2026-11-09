import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addSubstanceUse, decideSubstance, phaseOutSubstance, saveSubstance, type SubstanceInput } from "@/lib/substances";
import {
  newVersion,
  releaseInstruction,
  submitForReview,
  updateInstruction,
  withdrawInstruction,
} from "@/lib/instructions";
import { createSite } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const ACETON: SubstanceInput = {
  name: "Aceton",
  manufacturer: "Chemie AG",
  casNumber: "67-64-1",
  usage: "Reinigen",
  pictograms: ["GHS02", "GHS07"],
  signalWord: "DANGER",
  hStatements: ["H225", "H319", "H336"],
  pStatements: ["P210", "P280", "P305_P351_P338"],
  storageClass: "3",
  waterHazardClass: "1",
  sdsDate: d("2026-03-01"),
  substitutionChecked: true,
  substitutionNotes: "Kein geeigneter Ersatzstoff",
};

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

async function secondUser() {
  const u = await db.user.create({ data: { email: "zweite@x.de", name: "Zweite", passwordHash: "x" } });
  return { userId: u.id, isPlatformAdmin: false };
}

describe("Gefahrstoffe", () => {
  it("Antrag → Freigabe erzeugt BA-Entwurf; SDB-Wiedervorlage wird gesetzt", async () => {
    const { actor, orgA } = await twoOrgs();
    const now = d("2026-11-09");
    const s = await saveSubstance(actor, orgA, null, ACETON, now);
    expect(s.status).toBe("REQUESTED");
    expect(s.sdsReviewDue).toEqual(d("2027-11-09"));

    const draft = await decideSubstance(actor, orgA, s.id, "APPROVED", null, now);
    expect(draft?.status).toBe("DRAFT");
    expect(draft?.substanceId).toBe(s.id);
    expect(draft?.hazards).toContain("H225");
    await expect(decideSubstance(actor, orgA, s.id, "APPROVED")).rejects.toThrow("bereits entschieden");
  });

  it("Freigabe nur mit Substitutionsprüfung und SDB, Ablehnung nur mit Begründung", async () => {
    const { actor, orgA } = await twoOrgs();
    const s = await saveSubstance(actor, orgA, null, { ...ACETON, substitutionChecked: false });
    await expect(decideSubstance(actor, orgA, s.id, "APPROVED")).rejects.toThrow("Substitutionsprüfung");
    const s2 = await saveSubstance(actor, orgA, null, { ...ACETON, sdsDate: null });
    await expect(decideSubstance(actor, orgA, s2.id, "APPROVED")).rejects.toThrow("Sicherheitsdatenblatt");
    await expect(decideSubstance(actor, orgA, s.id, "REJECTED")).rejects.toThrow("begründen");
    await decideSubstance(actor, orgA, s.id, "REJECTED", "Ersatzstoff vorhanden");
    expect(await db.operatingInstruction.count()).toBe(0);
  });

  it("Eingaben werden geprüft", async () => {
    const { actor, orgA } = await twoOrgs();
    await expect(saveSubstance(actor, orgA, null, { ...ACETON, casNumber: "abc" })).rejects.toThrow("CAS");
    await expect(saveSubstance(actor, orgA, null, { ...ACETON, pictograms: ["GHS10"] })).rejects.toThrow("Piktogramme");
    await expect(saveSubstance(actor, orgA, null, { ...ACETON, storageClass: "99" })).rejects.toThrow("Lagerklasse");
  });

  it("Mandantentrennung: fremder Gefahrstoff, fremder Standort", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const s = await saveSubstance(actor, orgA, null, ACETON);
    const siteB = await createSite(actor, orgB, { name: "B" });
    await expect(decideSubstance(actor, orgB, s.id, "APPROVED")).rejects.toThrow("nicht gefunden");
    await expect(addSubstanceUse(actor, orgB, { substanceId: s.id, workArea: "X" })).rejects.toThrow("nicht gefunden");
    await expect(addSubstanceUse(actor, orgA, { substanceId: s.id, workArea: "X", siteId: siteB.id })).rejects.toThrow("Standort");
  });

  it("SDB-Wiedervorlage erscheint im Fristenkalender (nur freigegebene, mit Standortfilter)", async () => {
    const { actor, orgA } = await twoOrgs();
    const site = await createSite(actor, orgA, { name: "Werk" });
    const now = d("2026-11-09");
    const s = await saveSubstance(actor, orgA, null, { ...ACETON, sdsReviewDue: d("2026-11-01") }, now);
    expect(await getDeadlines(orgA, {}, now)).toHaveLength(0);
    await decideSubstance(actor, orgA, s.id, "APPROVED", null, now);
    await addSubstanceUse(actor, orgA, { substanceId: s.id, siteId: site.id, workArea: "Teilereinigung", quantity: 10, unit: "l" });

    const list = await getDeadlines(orgA, {}, now);
    expect(list.map((x) => [x.source, x.status])).toEqual([["sds", "overdue"]]);
    expect(list[0].siteName).toBe("Werk");
    const other = await createSite(actor, orgA, { name: "Anderes Werk" });
    expect(await getDeadlines(orgA, { siteId: other.id }, now)).toHaveLength(0);

    await phaseOutSubstance(actor, orgA, s.id);
    expect(await getDeadlines(orgA, {}, now)).toHaveLength(0);
  });
});

describe("Betriebsanweisungen: Versionen und Freigabe", () => {
  it("Entwurf → vorlegen → Freigabe durch zweite Person → neue Version löst alte ab", async () => {
    const { actor, orgA } = await twoOrgs();
    const reviewer = await secondUser();
    const s = await saveSubstance(actor, orgA, null, ACETON);
    const v1 = (await decideSubstance(actor, orgA, s.id, "APPROVED"))!;

    await submitForReview(actor, orgA, v1.id);
    await expect(releaseInstruction(actor, orgA, v1.id)).rejects.toThrow("Vier-Augen");
    const now = d("2026-11-09");
    await releaseInstruction(reviewer, orgA, v1.id, now);
    const released = await db.operatingInstruction.findUniqueOrThrow({ where: { id: v1.id } });
    expect(released.status).toBe("RELEASED");
    expect(released.reviewDue).toEqual(d("2028-11-09"));

    await expect(updateInstruction(actor, orgA, v1.id, { ...released })).rejects.toThrow("neue Version");

    const v2 = await newVersion(actor, orgA, v1.id);
    expect(v2.version).toBe(2);
    expect(v2.seriesId).toBe(v1.seriesId);
    await expect(newVersion(actor, orgA, v1.id)).rejects.toThrow("offene Version");

    await updateInstruction(actor, orgA, v2.id, { ...v2, firstAid: v2.firstAid + "\n• Augenspülflasche am Arbeitsplatz" });
    await submitForReview(actor, orgA, v2.id);
    await releaseInstruction(reviewer, orgA, v2.id, now);

    const series = await db.operatingInstruction.findMany({ where: { seriesId: v1.seriesId }, orderBy: { version: "asc" } });
    expect(series.map((x) => x.status)).toEqual(["ARCHIVED", "RELEASED"]);
  });

  it("Bearbeiten während der Prüfung setzt zurück auf Entwurf; leere Abschnitte blockieren das Vorlegen", async () => {
    const { actor, orgA } = await twoOrgs();
    const reviewer = await secondUser();
    const s = await saveSubstance(actor, orgA, null, ACETON);
    const v1 = (await decideSubstance(actor, orgA, s.id, "APPROVED"))!;
    await submitForReview(actor, orgA, v1.id);
    await updateInstruction(reviewer, orgA, v1.id, { ...v1, maintenance: "" });
    const back = await db.operatingInstruction.findUniqueOrThrow({ where: { id: v1.id } });
    expect(back.status).toBe("DRAFT");
    expect(back.lastEditorId).toBe(reviewer.userId);
    await expect(submitForReview(actor, orgA, v1.id)).rejects.toThrow("Entsorgung");
  });

  it("Überprüfungsfrist erscheint im Fristenkalender; zurückgezogene nicht", async () => {
    const { actor, orgA } = await twoOrgs();
    const reviewer = await secondUser();
    const s = await saveSubstance(actor, orgA, null, { ...ACETON, sdsDate: d("2026-01-01"), sdsReviewDue: d("2030-01-01") });
    const v1 = (await decideSubstance(actor, orgA, s.id, "APPROVED"))!;
    await submitForReview(actor, orgA, v1.id);
    await releaseInstruction(reviewer, orgA, v1.id, d("2024-12-01"));

    const now = d("2026-11-09");
    const list = await getDeadlines(orgA, { until: d("2027-12-31") }, now);
    expect(list.map((x) => [x.source, x.status])).toEqual([["instruction", "due30"]]);
    await withdrawInstruction(actor, orgA, v1.id);
    expect(await getDeadlines(orgA, { until: d("2027-12-31") }, now)).toHaveLength(0);
  });
});
