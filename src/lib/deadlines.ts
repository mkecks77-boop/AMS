import { db } from "./db";
import { classifyDue, type DueStatus } from "./dates";
import { INACTIVE_STATUSES } from "./equipment";
import { isRequired } from "./trainings";
import { INCIDENT_TYPE_LABELS, reportDueDate } from "./incidents";
import { APPOINTMENT_ROLES } from "./appointments";

/**
 * Einheitliche Frist aus beliebigem Modul (Standortfilter: Prüfungen über die Anlage,
 * SDB über die Einsatzorte, Betriebsanweisungen über die verknüpfte Anlage). Weitere Module (Unterweisungen, Qualifikationen,
 * Gefährdungsbeurteilungen, SDB …) liefern später ebenfalls Deadline-Objekte.
 */
export interface Deadline {
  id: string;
  source: "inspection" | "sds" | "instruction" | "training" | "qualification" | "action" | "bg_report" | "risk" | "walkthrough" | "ppe" | "appointment";
  sourceLabel: string;
  title: string;
  subject: string;
  dueAt: Date;
  status: DueStatus;
  siteId: string | null;
  siteName: string | null;
  href: string;
  /** z. B. Prüfer-Typ */
  info?: string;
}

export interface DeadlineFilter {
  siteId?: string | null;
  /** nur Fristen bis zu diesem Datum */
  until?: Date | null;
  status?: DueStatus | null;
}

async function inspectionDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const obs = await db.inspectionObligation.findMany({
    where: {
      organizationId,
      active: true,
      equipment: {
        status: { notIn: INACTIVE_STATUSES },
        ...(f.siteId ? { siteId: f.siteId } : {}),
      },
      ...(f.until ? { nextDueAt: { lte: f.until } } : {}),
    },
    include: { equipment: { include: { site: true } } },
  });
  return obs.map((o) => ({
    id: o.id,
    source: "inspection",
    sourceLabel: "Prüfung",
    title: o.title,
    subject: `${o.equipment.inventoryNumber} · ${o.equipment.name}`,
    dueAt: o.nextDueAt,
    status: classifyDue(o.nextDueAt, now),
    siteId: o.equipment.siteId,
    siteName: o.equipment.site?.name ?? null,
    href: `/equipment/${o.equipmentId}`,
    info: o.equipment.status === "LOCKED" ? "Anlage gesperrt" : undefined,
  }));
}

/** Wiedervorlage Sicherheitsdatenblatt (freigegebene Gefahrstoffe) */
async function sdsDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.hazardousSubstance.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      sdsReviewDue: { not: null, ...(f.until ? { lte: f.until } : {}) },
      ...(f.siteId ? { uses: { some: { siteId: f.siteId } } } : {}),
    },
    include: { uses: { include: { site: true } } },
  });
  return list.map((s) => {
    const sites = [...new Set(s.uses.map((u) => u.site?.name).filter(Boolean))];
    return {
      id: s.id,
      source: "sds",
      sourceLabel: "Sicherheitsdatenblatt",
      title: "Aktualität des SDB prüfen",
      subject: s.name + (s.manufacturer ? ` (${s.manufacturer})` : ""),
      dueAt: s.sdsReviewDue!,
      status: classifyDue(s.sdsReviewDue!, now),
      siteId: null,
      siteName: sites.join(", ") || null,
      href: `/substances/${s.id}`,
    };
  });
}

/** Überprüfung freigegebener Betriebsanweisungen */
async function instructionDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.operatingInstruction.findMany({
    where: {
      organizationId,
      status: "RELEASED",
      reviewDue: { not: null, ...(f.until ? { lte: f.until } : {}) },
      ...(f.siteId ? { equipment: { siteId: f.siteId } } : {}),
    },
    include: { equipment: { include: { site: true } } },
  });
  return list.map((i) => ({
    id: i.id,
    source: "instruction",
    sourceLabel: "Betriebsanweisung",
    title: "Betriebsanweisung überprüfen",
    subject: `${i.title} (V${i.version})`,
    dueAt: i.reviewDue!,
    status: classifyDue(i.reviewDue!, now),
    siteId: i.equipment?.siteId ?? null,
    siteName: i.equipment?.site?.name ?? null,
    href: `/instructions/${i.id}`,
  }));
}

/** Wiederholung von Unterweisungen: jeweils letzter Nachweis je Person und Pflichtthema */
async function trainingDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const records = await db.trainingRecord.findMany({
    where: {
      validUntil: { not: null },
      topic: { organizationId, active: true, requirements: { some: {} } },
      employee: { active: true, ...(f.siteId ? { siteId: f.siteId } : {}) },
    },
    include: { topic: { include: { requirements: true } }, employee: { include: { site: true } } },
    orderBy: { completedAt: "desc" },
  });
  const seen = new Set<string>();
  const out: Deadline[] = [];
  for (const r of records) {
    const key = `${r.employeeId}:${r.topicId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isRequired(r.topic.requirements, r.employee)) continue;
    if (f.until && r.validUntil! > f.until) continue;
    out.push({
      id: r.id,
      source: "training",
      sourceLabel: "Unterweisung",
      title: r.topic.title,
      subject: `${r.employee.lastName}, ${r.employee.firstName}`,
      dueAt: r.validUntil!,
      status: classifyDue(r.validUntil!, now),
      siteId: r.employee.siteId,
      siteName: r.employee.site?.name ?? null,
      href: `/trainings/${r.topicId}`,
    });
  }
  return out;
}

/** Ablauf von Qualifikationen (jeweils die neueste je Person und Art) */
async function qualificationDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const quals = await db.qualification.findMany({
    where: {
      validUntil: { not: null },
      employee: { organizationId, active: true, ...(f.siteId ? { siteId: f.siteId } : {}) },
    },
    include: { type: true, employee: { include: { site: true } } },
    orderBy: { acquiredAt: "desc" },
  });
  const seen = new Set<string>();
  const out: Deadline[] = [];
  for (const q of quals) {
    const key = `${q.employeeId}:${q.typeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (f.until && q.validUntil! > f.until) continue;
    out.push({
      id: q.id,
      source: "qualification",
      sourceLabel: "Qualifikation",
      title: `${q.type.name} läuft ab`,
      subject: `${q.employee.lastName}, ${q.employee.firstName}`,
      dueAt: q.validUntil!,
      status: classifyDue(q.validUntil!, now),
      siteId: q.employee.siteId,
      siteName: q.employee.site?.name ?? null,
      href: `/qualifications`,
    });
  }
  return out;
}

/** Offene Maßnahmen (Standort über die verknüpfte Meldung) */
async function actionDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.action.findMany({
    where: {
      organizationId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      ...(f.until ? { dueDate: { lte: f.until } } : {}),
      ...(f.siteId ? { OR: [{ incident: { siteId: f.siteId } }, { responsible: { siteId: f.siteId } }] } : {}),
    },
    include: { responsible: true, incident: { include: { site: true } } },
  });
  return list.map((a) => ({
    id: a.id,
    source: "action",
    sourceLabel: "Maßnahme",
    title: a.title,
    subject: a.responsible ? `verantwortlich: ${a.responsible.firstName} ${a.responsible.lastName}` : "ohne Verantwortliche/n",
    dueAt: a.dueDate,
    status: classifyDue(a.dueDate, now),
    siteId: a.incident?.siteId ?? null,
    siteName: a.incident?.site?.name ?? null,
    href: `/actions/${a.id}`,
  }));
}

/** Unfallanzeige an die BG (3-Tage-Frist), solange nicht erstattet */
async function bgReportDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.incident.findMany({
    where: {
      organizationId,
      type: { in: ["ACCIDENT", "COMMUTING"] },
      reportedToBgAt: null,
      OR: [{ lostDays: { gt: 3 } }, { fatal: true }],
      ...(f.siteId ? { siteId: f.siteId } : {}),
    },
    include: { site: true },
  });
  return list
    .map((i) => ({ i, due: reportDueDate(i) }))
    .filter(({ due }) => !f.until || due <= f.until)
    .map(({ i, due }) => ({
      id: i.id,
      source: "bg_report" as const,
      sourceLabel: "Unfallanzeige",
      title: `Unfallanzeige an die BG (Nr. ${i.number})`,
      subject: i.injury ?? INCIDENT_TYPE_LABELS[i.type],
      dueAt: due,
      status: classifyDue(due, now),
      siteId: i.siteId,
      siteName: i.site?.name ?? null,
      href: `/incidents/${i.id}`,
    }));
}

/** Überprüfung freigegebener Gefährdungsbeurteilungen */
async function riskDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.riskAssessment.findMany({
    where: { organizationId, status: "RELEASED", reviewDue: { not: null, ...(f.until ? { lte: f.until } : {}) }, ...(f.siteId ? { siteId: f.siteId } : {}) },
    include: { site: true },
  });
  return list.map((r) => ({
    id: r.id, source: "risk", sourceLabel: "Gefährdungsbeurteilung", title: "Gefährdungsbeurteilung überprüfen", subject: r.title,
    dueAt: r.reviewDue!, status: classifyDue(r.reviewDue!, now), siteId: r.siteId, siteName: r.site?.name ?? null, href: `/risk/${r.id}`,
  }));
}

/** Geplante Begehungen */
async function walkthroughDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.walkthrough.findMany({
    where: { organizationId, status: "PLANNED", ...(f.until ? { plannedAt: { lte: f.until } } : {}), ...(f.siteId ? { siteId: f.siteId } : {}) },
    include: { site: true, template: true },
  });
  return list.map((w) => ({
    id: w.id, source: "walkthrough", sourceLabel: "Begehung", title: w.template.title, subject: [w.area, w.auditor].filter(Boolean).join(" · "),
    dueAt: w.plannedAt, status: classifyDue(w.plannedAt, now), siteId: w.siteId, siteName: w.site?.name ?? null, href: `/walkthroughs/${w.id}`,
  }));
}

/** Austausch ausgegebener PSA */
async function ppeDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.ppeIssue.findMany({
    where: { returnedAt: null, replaceDue: { not: null, ...(f.until ? { lte: f.until } : {}) }, item: { organizationId }, employee: { active: true, ...(f.siteId ? { siteId: f.siteId } : {}) } },
    include: { item: true, employee: { include: { site: true } } },
  });
  return list.map((p) => ({
    id: p.id, source: "ppe", sourceLabel: "PSA", title: `${p.item.name} austauschen`, subject: `${p.employee.lastName}, ${p.employee.firstName}`,
    dueAt: p.replaceDue!, status: classifyDue(p.replaceDue!, now), siteId: p.employee.siteId, siteName: p.employee.site?.name ?? null, href: `/ppe`,
  }));
}

/** Befristete Beauftragungen */
async function appointmentDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.appointment.findMany({
    where: { organizationId, endedAt: null, validUntil: { not: null, ...(f.until ? { lte: f.until } : {}) }, ...(f.siteId ? { siteId: f.siteId } : {}) },
    include: { employee: true, site: true },
  });
  return list.map((a) => ({
    id: a.id, source: "appointment", sourceLabel: "Beauftragung", title: `${APPOINTMENT_ROLES[a.role]?.label ?? a.role} endet`, subject: `${a.employee.lastName}, ${a.employee.firstName}`,
    dueAt: a.validUntil!, status: classifyDue(a.validUntil!, now), siteId: a.siteId, siteName: a.site?.name ?? null, href: `/appointments`,
  }));
}

export async function getDeadlines(organizationId: string, f: DeadlineFilter = {}, now = new Date()) {
  const parts = await Promise.all([
    inspectionDeadlines(organizationId, f, now),
    sdsDeadlines(organizationId, f, now),
    instructionDeadlines(organizationId, f, now),
    trainingDeadlines(organizationId, f, now),
    qualificationDeadlines(organizationId, f, now),
    actionDeadlines(organizationId, f, now),
    bgReportDeadlines(organizationId, f, now),
    riskDeadlines(organizationId, f, now),
    walkthroughDeadlines(organizationId, f, now),
    ppeDeadlines(organizationId, f, now),
    appointmentDeadlines(organizationId, f, now),
  ]);
  const all = parts.flat();
  return all
    .filter((d) => !f.status || d.status === f.status)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function countByStatus(items: { status: DueStatus }[]): Record<DueStatus, number> {
  const c: Record<DueStatus, number> = { overdue: 0, due30: 0, due90: 0, ok: 0 };
  for (const i of items) c[i.status]++;
  return c;
}

/** Gruppiert nach Monat, z. B. "2026-11" → Fristen */
export function groupByMonth<T extends { dueAt: Date }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = i.dueAt.toISOString().slice(0, 7);
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()];
}
