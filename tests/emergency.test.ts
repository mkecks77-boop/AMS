import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { completeDrill, drillStatus, planDrill, savePlan } from "@/lib/emergency";
import { createAction } from "@/lib/measures";
import { createSite } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("Brandschutz und Notfall", () => {
  it("Alarmplan: Sammelplatz Pflicht, Wiedervorlage, fremder Standort abgelehnt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const site = await createSite(actor, orgA, { name: "Werk" });
    const siteB = await createSite(actor, orgB, { name: "B" });
    await expect(savePlan(actor, orgA, site.id, { assemblyPoint: "" })).rejects.toThrow("Sammelplatz");
    await expect(savePlan(actor, orgA, siteB.id, { assemblyPoint: "x" })).rejects.toThrow("Standort");
    const p = await savePlan(actor, orgA, site.id, { assemblyPoint: "Parkplatz Nord", internalEmergency: "222" }, d("2026-01-15"));
    expect(p.reviewDue).toEqual(d("2027-01-15"));
    expect(p.fireBrigade).toBe("112");
    const p2 = await savePlan(actor, orgA, site.id, { assemblyPoint: "Parkplatz Süd" }, d("2026-02-01"));
    expect(p2.id).toBe(p.id);
  });

  it("Übung planen, auswerten, nächste Fälligkeit nach 12 Monaten, Maßnahme, Fristen", async () => {
    const { actor, orgA } = await twoOrgs();
    const site = await createSite(actor, orgA, { name: "Werk" });
    const other = await createSite(actor, orgA, { name: "Lager" });
    const now = d("2026-11-09");
    expect(await getDeadlines(orgA, {}, now)).toHaveLength(0);

    const drill = await planDrill(actor, orgA, { siteId: site.id, kind: "EVACUATION", plannedAt: d("2026-10-01") });
    let dl = (await getDeadlines(orgA, {}, now)).filter((x) => x.source === "emergency");
    expect(dl.find((x) => x.siteId === site.id && x.title === "Räumungsübung")?.status).toBe("overdue");
    expect(dl.filter((x) => x.title === "Alarmplan erstellen")).toHaveLength(2);

    await expect(completeDrill(actor, orgA, drill.id, { performedAt: d("2026-10-01"), observations: "" }, now)).rejects.toThrow("Beobachtungen");
    await completeDrill(actor, orgA, drill.id, { performedAt: d("2026-10-01"), participants: 45, evacuationMinutes: 4, observations: "Notausgang Halle 2 klemmt" }, now);
    await expect(completeDrill(actor, orgA, drill.id, { performedAt: d("2026-10-01"), observations: "x" }, now)).rejects.toThrow("bereits");
    const a = await createAction(actor, orgA, { title: "Notausgang Halle 2 instand setzen", dueDate: d("2026-11-30") }, { drillId: drill.id });
    expect(a.sourceType).toBe("DRILL");

    const st = await drillStatus(orgA, now);
    expect(st.find((s) => s.site.id === site.id)!.nextDue).toEqual(d("2027-10-01"));
    expect(st.find((s) => s.site.id === other.id)!.nextDue).toEqual(now);
    dl = (await getDeadlines(orgA, { siteId: site.id }, now)).filter((x) => x.source === "emergency");
    expect(dl.map((x) => x.title).sort()).toEqual(["Alarmplan erstellen", "Räumungsübung durchführen"]);
  });
});
