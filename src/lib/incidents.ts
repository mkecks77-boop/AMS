import type { CauseCategory, IncidentStatus, IncidentType } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ACCIDENT: "Arbeitsunfall",
  COMMUTING: "Wegeunfall",
  NEAR_MISS: "Beinaheunfall",
  UNSAFE_CONDITION: "Unsicherer Zustand / Handlung",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "gemeldet",
  INVESTIGATING: "in Untersuchung",
  CLOSED: "abgeschlossen",
};

export const CAUSE_LABELS: Record<CauseCategory, string> = {
  TECHNICAL: "technisch",
  ORGANIZATIONAL: "organisatorisch",
  PERSONAL: "personenbezogen / verhaltensbedingt",
};

/** Unfallanzeige an die BG: Tod oder Arbeitsunfähigkeit von mehr als 3 Kalendertagen (§ 193 SGB VII). */
export function isReportable(i: { type: IncidentType; lostDays: number; fatal: boolean }): boolean {
  if (i.type !== "ACCIDENT" && i.type !== "COMMUTING") return false;
  return i.fatal || i.lostDays > 3;
}

/** Frist für die Unfallanzeige: 3 Tage nach Kenntnis (hier: ab Erfassung bzw. Unfalltag, der spätere Wert). */
export function reportDueDate(i: { occurredAt: Date; createdAt: Date }): Date {
  const base = i.createdAt > i.occurredAt ? i.createdAt : i.occurredAt;
  return new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);
}

/** 1000-Mann-Quote: meldepflichtige Unfälle je 1000 Vollarbeiter (Näherung: aktive Beschäftigte). */
export function thousandRate(reportable: number, employees: number): number | null {
  if (employees <= 0) return null;
  return Math.round((reportable / employees) * 1000 * 10) / 10;
}

export function formatNumber(year: number, seq: number) {
  return `${year}-${String(seq).padStart(3, "0")}`;
}

async function nextNumber(organizationId: string, occurredAt: Date) {
  const year = occurredAt.getUTCFullYear();
  const last = await db.incident.findFirst({
    where: { organizationId, number: { startsWith: `${year}-` } },
    orderBy: { number: "desc" },
  });
  const seq = last ? Number(last.number.split("-")[1]) + 1 : 1;
  return formatNumber(year, seq);
}

export interface IncidentInput {
  type: IncidentType;
  occurredAt: Date;
  siteId?: string | null;
  location?: string | null;
  employeeId?: string | null;
  personName?: string | null;
  activity?: string | null;
  description: string;
  injury?: string | null;
  bodyPart?: string | null;
  witnesses?: string | null;
  firstAider?: string | null;
  doctorVisit?: boolean;
  lostDays?: number;
  fatal?: boolean;
}

function clean(i: IncidentInput, now: Date) {
  if (!i.description) throw new UserError("Bitte den Hergang beschreiben.");
  if (i.occurredAt > now) throw new UserError("Der Zeitpunkt darf nicht in der Zukunft liegen.");
  if (i.lostDays != null && (!Number.isInteger(i.lostDays) || i.lostDays < 0)) throw new UserError("Ungültige Ausfalltage.");
  return {
    type: i.type,
    occurredAt: i.occurredAt,
    siteId: i.siteId || null,
    location: i.location || null,
    employeeId: i.employeeId || null,
    personName: i.personName || null,
    activity: i.activity || null,
    description: i.description,
    injury: i.injury || null,
    bodyPart: i.bodyPart || null,
    witnesses: i.witnesses || null,
    firstAider: i.firstAider || null,
    doctorVisit: !!i.doctorVisit,
    lostDays: i.lostDays ?? 0,
    fatal: !!i.fatal,
  };
}

export async function reportIncident(actor: Actor, organizationId: string, input: IncidentInput, now = new Date(), firstAidEntryId?: string) {
  const data = clean(input, now);
  await assertOwned(organizationId, { siteId: data.siteId, employeeId: data.employeeId });
  // Nummer vergeben; bei gleichzeitiger Meldung einmal neu versuchen
  for (let attempt = 0; ; attempt++) {
    try {
      const inc = await db.incident.create({
        data: { ...data, organizationId, number: await nextNumber(organizationId, data.occurredAt), reporterId: actor.userId, firstAidEntryId: firstAidEntryId ?? null },
      });
      await audit({ organizationId, userId: actor.userId, action: "incident.reported", entity: "Incident", entityId: inc.id, details: { number: inc.number, type: inc.type } });
      return inc;
    } catch (e) {
      if (attempt < 2 && (e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
}

export async function updateIncident(
  actor: Actor,
  organizationId: string,
  id: string,
  input: IncidentInput & { status?: IncidentStatus; causeCategory?: CauseCategory | null; rootCause?: string | null; reportedToBgAt?: Date | null },
  now = new Date(),
) {
  const inc = await db.incident.findFirst({ where: { id, organizationId }, include: { actions: true } });
  if (!inc) throw new UserError("Meldung nicht gefunden.");
  const data = clean(input, now);
  await assertOwned(organizationId, { siteId: data.siteId, employeeId: data.employeeId });
  const status = input.status ?? inc.status;
  if (status === "CLOSED") {
    if ((input.type === "ACCIDENT" || input.type === "NEAR_MISS") && !(input.rootCause ?? inc.rootCause)) {
      throw new UserError("Vor dem Abschluss die Ursache dokumentieren.");
    }
    if (isReportable(data) && !(input.reportedToBgAt ?? inc.reportedToBgAt)) {
      throw new UserError("Meldepflichtiger Unfall: Vor dem Abschluss das Datum der Unfallanzeige eintragen.");
    }
    if (inc.actions.some((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")) {
      throw new UserError("Es gibt noch offene Maßnahmen zu dieser Meldung.");
    }
  }
  const updated = await db.incident.update({
    where: { id },
    data: { ...data, status, causeCategory: input.causeCategory ?? null, rootCause: input.rootCause || null, reportedToBgAt: input.reportedToBgAt ?? null },
  });
  await audit({ organizationId, userId: actor.userId, action: "incident.updated", entity: "Incident", entityId: id, details: { number: inc.number, status } });
  return updated;
}

// ───────── Verbandbuch ─────────

export const FIRST_AID_RETENTION_YEARS = 5;

export async function addFirstAidEntry(
  actor: Actor,
  organizationId: string,
  input: { occurredAt: Date; siteId?: string | null; location?: string | null; employeeId?: string | null; personName?: string | null; description: string; injury: string; measures: string; firstAider: string; witnesses?: string | null },
  now = new Date(),
) {
  if (!input.description || !input.injury || !input.measures || !input.firstAider) {
    throw new UserError("Bitte Hergang, Verletzung, Erste-Hilfe-Maßnahmen und Ersthelfer/in angeben.");
  }
  if (!input.employeeId && !input.personName) throw new UserError("Bitte die verletzte Person angeben.");
  if (input.occurredAt > now) throw new UserError("Der Zeitpunkt darf nicht in der Zukunft liegen.");
  await assertOwned(organizationId, { siteId: input.siteId, employeeId: input.employeeId });
  const e = await db.firstAidEntry.create({
    data: {
      organizationId,
      occurredAt: input.occurredAt,
      siteId: input.siteId || null,
      location: input.location || null,
      employeeId: input.employeeId || null,
      personName: input.personName || null,
      description: input.description,
      injury: input.injury,
      measures: input.measures,
      firstAider: input.firstAider,
      witnesses: input.witnesses || null,
      reporterId: actor.userId,
    },
  });
  // keine Gesundheitsdaten ins Protokoll
  await audit({ organizationId, userId: actor.userId, action: "firstaid.created", entity: "FirstAidEntry", entityId: e.id });
  return e;
}

/** Eintrag wird zur Unfallmeldung (z. B. wenn doch Arbeitsunfähigkeit eintritt). */
export async function convertFirstAidEntry(actor: Actor, organizationId: string, id: string, now = new Date()) {
  const e = await db.firstAidEntry.findFirst({ where: { id, organizationId }, include: { incident: true } });
  if (!e) throw new UserError("Eintrag nicht gefunden.");
  if (e.incident) return e.incident;
  return reportIncident(actor, organizationId, {
    type: "ACCIDENT",
    occurredAt: e.occurredAt,
    siteId: e.siteId,
    location: e.location,
    employeeId: e.employeeId,
    personName: e.personName,
    description: e.description,
    injury: e.injury,
    firstAider: e.firstAider,
    witnesses: e.witnesses,
  }, now, e.id);
}

/** Löscht Verbandbucheinträge, deren Aufbewahrungsfrist (5 Jahre) abgelaufen ist. */
export async function purgeFirstAidEntries(organizationId: string, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - FIRST_AID_RETENTION_YEARS);
  const r = await db.firstAidEntry.deleteMany({ where: { organizationId, occurredAt: { lt: cutoff }, incident: null } });
  if (r.count) await audit({ organizationId, action: "firstaid.purged", entity: "FirstAidEntry", details: { count: r.count } });
  return r.count;
}

/** Kennzahlen für ein Jahr */
export async function incidentStats(organizationId: string, year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const [incidents, employees, firstAid] = await Promise.all([
    db.incident.findMany({ where: { organizationId, occurredAt: { gte: from, lt: to } }, include: { site: true } }),
    db.employee.count({ where: { organizationId, active: true } }),
    db.firstAidEntry.count({ where: { organizationId, occurredAt: { gte: from, lt: to } } }),
  ]);
  const accidents = incidents.filter((i) => i.type === "ACCIDENT");
  const reportable = accidents.filter(isReportable).length;
  const byMonth = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    accidents: accidents.filter((i) => i.occurredAt.getUTCMonth() === m).length,
    nearMisses: incidents.filter((i) => i.type === "NEAR_MISS" && i.occurredAt.getUTCMonth() === m).length,
  }));
  return {
    year,
    employees,
    accidents: accidents.length,
    reportable,
    commuting: incidents.filter((i) => i.type === "COMMUTING").length,
    nearMisses: incidents.filter((i) => i.type === "NEAR_MISS").length,
    unsafe: incidents.filter((i) => i.type === "UNSAFE_CONDITION").length,
    lostDays: accidents.reduce((s, i) => s + i.lostDays, 0),
    fatal: incidents.filter((i) => i.fatal).length,
    firstAid,
    thousandRate: thousandRate(reportable, employees),
    byMonth,
  };
}
