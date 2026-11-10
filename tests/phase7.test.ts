import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { base32Decode, base32Encode, generateSecret, totp, verifyTotp } from "@/lib/totp";
import { nextAsaDue, saveMeeting, suggestedAgenda } from "@/lib/asa";
import { deleteTime, logTime, timeSummary } from "@/lib/timelog";
import { digestText, sendDigests } from "@/lib/digest";
import { sendMail } from "@/lib/mail";
import { annualReport } from "@/lib/annual";
import { getDeadlines } from "@/lib/deadlines";
import { createAction } from "@/lib/measures";
import { reportIncident } from "@/lib/incidents";
import { resetDb, twoOrgs } from "./helpers";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("TOTP (RFC 6238)", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("Base32", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(base32Decode(generateSecret())).toHaveLength(20);
  });
  it("Testvektoren (6 Stellen)", () => {
    expect(totp(secret, 59_000)).toBe("287082");
    expect(totp(secret, 1_111_111_109_000)).toBe("081804");
    expect(totp(secret, 1_234_567_890_000)).toBe("005924");
  });
  it("Prüfung mit Toleranz ±30 s", () => {
    const t = 1_700_000_000_000;
    const code = totp(secret, t);
    expect(verifyTotp(secret, code, t + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, t + 90_000)).toBe(false);
    expect(verifyTotp(secret, "12a456", t)).toBe(false);
  });
});

describe("Phase 7", () => {
  beforeEach(async () => {
    await resetDb();
    await db.emailLog.deleteMany();
  });
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("ASA: Tagesordnung mit Kennzahlen, Abschluss nur mit Protokoll, vierteljährliche Fälligkeit, Maßnahmen", async () => {
    const { actor, orgA } = await twoOrgs();
    const now = d("2026-11-09");
    await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2026-10-01"), description: "x" }, now);
    expect(await suggestedAgenda(orgA, now)).toContain("1 Arbeitsunfälle");
    const m = await saveMeeting(actor, orgA, null, { date: d("2026-09-15") }, now);
    expect(m.agenda).toContain("Unfallgeschehen seit der letzten Sitzung");
    expect((await getDeadlines(orgA, {}, now)).map((x) => [x.source, x.status])).toEqual([["asa", "overdue"]]);
    await expect(saveMeeting(actor, orgA, m.id, { date: d("2026-09-15"), done: true }, now)).rejects.toThrow("Protokoll");
    await saveMeeting(actor, orgA, m.id, { date: d("2026-09-15"), participants: "UN, Sifa, BA, BR, SiBe", minutes: "Protokoll …", done: true }, now);
    const dl = await getDeadlines(orgA, {}, now);
    expect(dl.map((x) => [x.title, x.dueAt])).toEqual([["Nächste ASA-Sitzung planen (§ 11 ASiG)", d("2026-12-15")]]);
    expect(nextAsaDue(null, now)).toEqual(now);
    const a = await createAction(actor, orgA, { title: "Hautschutzplan aktualisieren", dueDate: d("2026-12-01") }, { asaMeetingId: m.id });
    expect(a.sourceType).toBe("ASA");
    await expect(saveMeeting(actor, orgA, m.id, { date: d("2026-09-15") }, now)).rejects.toThrow("Abgeschlossene");
  });

  it("Einsatzzeit: Erfassung, Plausibilität, nur eigene löschen, Summen", async () => {
    const { actor, orgA } = await twoOrgs();
    const other = await db.user.create({ data: { email: "o@x.de", name: "O", passwordHash: "x" } });
    const now = d("2026-11-09");
    const e1 = await logTime(actor, orgA, { date: d("2026-03-01"), minutes: 120, category: "WALK" }, now);
    await logTime(actor, orgA, { date: d("2026-04-01"), minutes: 90, category: "WALK" }, now);
    await logTime(actor, orgA, { date: d("2026-05-01"), minutes: 60, category: "ASA" }, now);
    await expect(logTime(actor, orgA, { date: d("2026-05-01"), minutes: 2, category: "ASA" }, now)).rejects.toThrow("Dauer");
    await expect(logTime(actor, orgA, { date: d("2026-12-01"), minutes: 60, category: "ASA" }, now)).rejects.toThrow("Zukunft");
    await expect(deleteTime({ userId: other.id, isPlatformAdmin: false }, orgA, e1.id)).rejects.toThrow("nicht gefunden");
    const s = await timeSummary(orgA, 2026);
    expect(s.total).toBe(270);
    expect(s.byCategory).toEqual([{ category: "WALK", minutes: 210 }, { category: "ASA", minutes: 60 }]);
  });

  it("E-Mail ohne SMTP wird protokolliert; Fristen-Zusammenfassung nur an berechtigte Rollen mit Opt-in", async () => {
    const { actor, orgA } = await twoOrgs();
    expect(await sendMail("a@b.de", "Test", "x")).toBe(false);
    expect(await db.emailLog.findFirst()).toMatchObject({ sent: false, error: "SMTP nicht konfiguriert" });
    await db.emailLog.deleteMany();

    const sifa = await db.user.create({ data: { email: "sifa2@x.de", name: "S", passwordHash: "x" } });
    const optOut = await db.user.create({ data: { email: "out@x.de", name: "O", passwordHash: "x", emailDigest: false } });
    const emp = await db.user.create({ data: { email: "emp@x.de", name: "E", passwordHash: "x" } });
    await db.membership.createMany({ data: [
      { userId: sifa.id, organizationId: orgA, role: "SAFETY_OFFICER" },
      { userId: optOut.id, organizationId: orgA, role: "ORG_ADMIN" },
      { userId: emp.id, organizationId: orgA, role: "EMPLOYEE" },
    ] });
    await createAction(actor, orgA, { title: "Fluchtweg freiräumen", dueDate: d("2026-11-01") });
    const r = await sendDigests(d("2026-11-09"));
    expect(r).toEqual({ sent: 0, skipped: 1 });
    expect((await db.emailLog.findMany()).map((l) => l.to)).toEqual(["sifa2@x.de"]);
    const text = digestText("Firma A", await getDeadlines(orgA, {}, d("2026-11-09")), "https://ams.example");
    expect(text).toContain("ÜBERFÄLLIG (1)");
    expect(text).toContain("Fluchtweg freiräumen");
  });

  it("Jahresbericht liefert Kennzahlen", async () => {
    const { actor, orgA } = await twoOrgs();
    const now = d("2026-11-09");
    await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: d("2026-02-01"), description: "x", lostDays: 5 }, now);
    await logTime(actor, orgA, { date: d("2026-02-02"), minutes: 60, category: "INCIDENT" }, now);
    const r = await annualReport(orgA, 2026, now);
    expect(r.incidents.reportable).toBe(1);
    expect(r.time.total).toBe(60);
    expect(r.trainingRate).toBe(100);
  });
});
