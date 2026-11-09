import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addFirstAidEntry,
  convertFirstAidEntry,
  incidentStats,
  isReportable,
  purgeFirstAidEntries,
  reportDueDate,
  reportIncident,
  thousandRate,
  updateIncident,
} from "@/lib/incidents";
import { canTransition, createAction, updateActionStatus } from "@/lib/measures";
import { saveEmployee } from "@/lib/masterdata";
import { getDeadlines } from "@/lib/deadlines";
import { can } from "@/lib/roles";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("Regeln", () => {
  it("Meldepflicht: mehr als 3 Tage AU oder tödlich, nur Arbeits-/Wegeunfall", () => {
    expect(isReportable({ type: "ACCIDENT", lostDays: 3, fatal: false })).toBe(false);
    expect(isReportable({ type: "ACCIDENT", lostDays: 4, fatal: false })).toBe(true);
    expect(isReportable({ type: "COMMUTING", lostDays: 10, fatal: false })).toBe(true);
    expect(isReportable({ type: "NEAR_MISS", lostDays: 10, fatal: false })).toBe(false);
    expect(isReportable({ type: "ACCIDENT", lostDays: 0, fatal: true })).toBe(true);
  });
  it("Frist und 1000-Mann-Quote", () => {
    expect(reportDueDate({ occurredAt: d("2026-11-02"), createdAt: d("2026-11-05") })).toEqual(d("2026-11-08"));
    expect(thousandRate(2, 80)).toBe(25);
    expect(thousandRate(1, 0)).toBeNull();
  });
  it("Statuswechsel Maßnahmen", () => {
    expect(canTransition("OPEN", "DONE")).toBe(true);
    expect(canTransition("OPEN", "VERIFIED")).toBe(false);
    expect(canTransition("DONE", "VERIFIED")).toBe(true);
    expect(canTransition("VERIFIED", "OPEN")).toBe(false);
  });
  it("Rechte: alle dürfen melden, nur berechtigte sehen das Verbandbuch", () => {
    expect(can({ isPlatformAdmin: false, role: "EMPLOYEE" }, "incidents.report")).toBe(true);
    expect(can({ isPlatformAdmin: false, role: "EMPLOYEE" }, "incidents.view")).toBe(false);
    expect(can({ isPlatformAdmin: false, role: "MANAGER" }, "firstaid.view")).toBe(false);
    expect(can({ isPlatformAdmin: false, role: "SAFETY_OFFICER" }, "firstaid.view")).toBe(true);
  });
});

describe("Unfälle, Verbandbuch, Maßnahmen", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("Nummern je Jahr fortlaufend, je Unternehmen getrennt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const base = { type: "NEAR_MISS" as const, description: "Fast gestolpert" };
    const a1 = await reportIncident(actor, orgA, { ...base, occurredAt: d("2026-02-01") });
    const a2 = await reportIncident(actor, orgA, { ...base, occurredAt: d("2026-03-01") });
    const b1 = await reportIncident(actor, orgB, { ...base, occurredAt: d("2026-03-01") });
    const a3 = await reportIncident(actor, orgA, { ...base, occurredAt: d("2025-12-01") });
    expect([a1.number, a2.number, b1.number, a3.number]).toEqual(["2026-001", "2026-002", "2026-001", "2025-001"]);
  });

  it("Abschluss erst mit Ursache, Unfallanzeige und erledigten Maßnahmen; Frist im Kalender", async () => {
    const { actor, orgA } = await twoOrgs();
    const emp = await saveEmployee(actor, orgA, null, { firstName: "Tom", lastName: "D" });
    const now = d("2026-11-09");
    const inc = await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2026-11-05"), employeeId: emp.id, description: "Schnitt", injury: "Schnittwunde", lostDays: 5 }, now);
    const dl = await getDeadlines(orgA, {}, now);
    expect(dl.map((x) => x.source)).toContain("bg_report");

    const base = { type: "ACCIDENT" as const, occurredAt: inc.occurredAt, employeeId: emp.id, description: "Schnitt", lostDays: 5 };
    await expect(updateIncident(actor, orgA, inc.id, { ...base, status: "CLOSED" }, now)).rejects.toThrow("Ursache");
    await expect(updateIncident(actor, orgA, inc.id, { ...base, status: "CLOSED", rootCause: "Schutzhaube fehlte" }, now)).rejects.toThrow("Unfallanzeige");

    const act = await createAction(actor, orgA, { title: "Schutzhaube montieren", dueDate: d("2026-11-20"), responsibleId: emp.id, level: "TECHNICAL" }, { incidentId: inc.id });
    expect(act.sourceType).toBe("INCIDENT");
    const closing = { ...base, status: "CLOSED" as const, rootCause: "Schutzhaube fehlte", causeCategory: "TECHNICAL" as const, reportedToBgAt: d("2026-11-07") };
    await expect(updateIncident(actor, orgA, inc.id, closing, now)).rejects.toThrow("offene Maßnahmen");

    await updateActionStatus(actor, orgA, act.id, "DONE", null, now);
    await expect(updateActionStatus(actor, orgA, act.id, "VERIFIED", null, now)).rejects.toThrow("Wirksamkeit");
    await updateActionStatus(actor, orgA, act.id, "VERIFIED", "Haube montiert, Kontrolle i. O.", now);
    const closed = await updateIncident(actor, orgA, inc.id, closing, now);
    expect(closed.status).toBe("CLOSED");
    expect((await getDeadlines(orgA, {}, now)).filter((x) => x.source === "bg_report" || x.source === "action")).toHaveLength(0);
  });

  it("Maßnahme: fremde Meldung oder fremde Verantwortliche werden abgelehnt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const incB = await reportIncident(actor, orgB, { type: "NEAR_MISS", occurredAt: d("2026-01-01"), description: "x" });
    const empB = await saveEmployee(actor, orgB, null, { firstName: "A", lastName: "B" });
    await expect(createAction(actor, orgA, { title: "t", dueDate: d("2026-12-01") }, { incidentId: incB.id })).rejects.toThrow("nicht gefunden");
    await expect(createAction(actor, orgA, { title: "t", dueDate: d("2026-12-01"), responsibleId: empB.id })).rejects.toThrow("nicht gefunden");
  });

  it("Verbandbuch: Eintrag, Umwandlung in Unfallmeldung, Löschung nach 5 Jahren", async () => {
    const { actor, orgA } = await twoOrgs();
    const now = d("2026-11-09");
    await expect(addFirstAidEntry(actor, orgA, { occurredAt: d("2026-11-01"), description: "x", injury: "y", measures: "z", firstAider: "EH" })).rejects.toThrow("verletzte Person");
    const e = await addFirstAidEntry(actor, orgA, { occurredAt: d("2026-11-01"), personName: "Max", description: "Splitter", injury: "Splitter im Finger", measures: "entfernt, Pflaster", firstAider: "Lisa" }, now);
    const inc = await convertFirstAidEntry(actor, orgA, e.id, now);
    expect(inc.injury).toBe("Splitter im Finger");
    expect((await convertFirstAidEntry(actor, orgA, e.id, now)).id).toBe(inc.id);

    await addFirstAidEntry(actor, orgA, { occurredAt: d("2021-10-01"), personName: "Alt", description: "a", injury: "b", measures: "c", firstAider: "d" }, now);
    await addFirstAidEntry(actor, orgA, { occurredAt: d("2021-12-01"), personName: "Jünger", description: "a", injury: "b", measures: "c", firstAider: "d" }, now);
    expect(await purgeFirstAidEntries(orgA, now)).toBe(1);
    expect(await db.firstAidEntry.count({ where: { organizationId: orgA } })).toBe(2);
    const log = await db.auditLog.findFirst({ where: { action: "firstaid.created" } });
    expect(log?.details).toBeNull();
  });

  it("Kennzahlen", async () => {
    const { actor, orgA } = await twoOrgs();
    for (let i = 0; i < 4; i++) await saveEmployee(actor, orgA, null, { firstName: `P${i}`, lastName: "N" });
    const now = d("2026-11-09");
    await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2026-03-02"), description: "a", lostDays: 10 }, now);
    await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2026-03-05"), description: "b", lostDays: 1 }, now);
    await reportIncident(actor, orgA, { type: "NEAR_MISS", occurredAt: d("2026-05-01"), description: "c" }, now);
    await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2025-05-01"), description: "alt", lostDays: 20 }, now);
    const s = await incidentStats(orgA, 2026);
    expect(s).toMatchObject({ accidents: 2, reportable: 1, nearMisses: 1, lostDays: 11, employees: 4, thousandRate: 250 });
    expect(s.byMonth[2]).toEqual({ month: 3, accidents: 2, nearMisses: 0 });
  });
});
