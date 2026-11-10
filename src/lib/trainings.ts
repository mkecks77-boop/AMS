import type { TrainingKind } from "@prisma/client";
import { db, transaction } from "./db";
import { audit } from "./audit";
import { addMonths, classifyDue, type DueStatus } from "./dates";
import { SECTION_LABELS } from "./instructions";
import { UserError, type Actor } from "./users";

export const KIND_LABELS: Record<TrainingKind, string> = {
  INSTRUCTION: "Unterweisung",
  COURSE: "Schulung / Lehrgang",
};

/** JArbSchG § 29: Jugendliche mindestens halbjährlich unterweisen (hier: Kennzeichen „Auszubildende/r“). */
export const APPRENTICE_INTERVAL = 6;

export function effectiveInterval(kind: TrainingKind, intervalMonths: number, apprentice: boolean): number {
  if (intervalMonths === 0) return 0;
  if (apprentice && kind === "INSTRUCTION") return Math.min(intervalMonths, APPRENTICE_INTERVAL);
  return intervalMonths;
}

export function validUntilFor(completedAt: Date, kind: TrainingKind, intervalMonths: number, apprentice: boolean): Date | null {
  const m = effectiveInterval(kind, intervalMonths, apprentice);
  return m === 0 ? null : addMonths(completedAt, m);
}

export type TrainingStatus = DueStatus | "missing";

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  missing: "fehlt",
  overdue: "abgelaufen",
  due30: "läuft ≤ 30 Tage ab",
  due90: "läuft ≤ 90 Tage ab",
  ok: "gültig",
};

/** Status einer Unterweisung: kein Nachweis → fehlt; ohne Ablauf → gültig; sonst Ampel. */
export function trainingStatus(record: { validUntil: Date | null } | null | undefined, now = new Date()): TrainingStatus {
  if (!record) return "missing";
  if (!record.validUntil) return "ok";
  return classifyDue(record.validUntil, now);
}

/** Erforderliche Personenzahl für eine Quote (aufgerundet, mindestens 1 bei ≥ 2 Beschäftigten). */
export function requiredCount(employees: number, ratePercent: number): number {
  if (employees === 0) return 0;
  // DGUV V1 § 26: bei 2–20 Versicherten 1 Ersthelfer
  return Math.max(1, Math.ceil((employees * ratePercent) / 100));
}

type Req = { departmentId: string | null; apprenticesOnly: boolean };

/** Gilt ein Thema für diese Person? */
export function isRequired(reqs: Req[], e: { departmentId: string | null; apprentice: boolean }): boolean {
  return reqs.some((r) => (!r.departmentId || r.departmentId === e.departmentId) && (!r.apprenticesOnly || e.apprentice));
}

// ───────── Dienste ─────────

export interface TopicInput {
  title: string;
  kind: TrainingKind;
  description?: string | null;
  content?: string | null;
  legalBasis?: string | null;
  intervalMonths: number;
  beforeStart?: boolean;
}

export async function saveTopic(actor: Actor, organizationId: string, id: string | null, input: TopicInput, instructionId?: string | null) {
  if (!input.title) throw new UserError("Bitte einen Titel angeben.");
  if (!Number.isInteger(input.intervalMonths) || input.intervalMonths < 0 || input.intervalMonths > 120) {
    throw new UserError("Das Intervall muss zwischen 0 (einmalig) und 120 Monaten liegen.");
  }
  const data = {
    title: input.title,
    kind: input.kind,
    description: input.description || null,
    content: input.content ?? "",
    legalBasis: input.legalBasis || null,
    intervalMonths: input.intervalMonths,
    beforeStart: input.beforeStart ?? true,
  };
  let t;
  if (id) {
    if (!(await db.trainingTopic.count({ where: { id, organizationId } }))) throw new UserError("Thema nicht gefunden.");
    t = await db.trainingTopic.update({ where: { id }, data });
  } else {
    t = await db.trainingTopic.create({ data: { ...data, organizationId, instructionId: instructionId ?? null } });
  }
  await audit({ organizationId, userId: actor.userId, action: id ? "training.updated" : "training.created", entity: "TrainingTopic", entityId: t.id, details: { title: t.title } });
  return t;
}

/** Unterweisungsthema aus einer freigegebenen Betriebsanweisung (Inhalt = BA-Abschnitte). */
export async function topicFromInstruction(actor: Actor, organizationId: string, instructionId: string) {
  const i = await db.operatingInstruction.findFirst({ where: { id: instructionId, organizationId } });
  if (!i) throw new UserError("Betriebsanweisung nicht gefunden.");
  if (i.status !== "RELEASED") throw new UserError("Nur freigegebene Betriebsanweisungen können Grundlage einer Unterweisung sein.");
  const existing = await db.trainingTopic.findFirst({ where: { organizationId, instructionId: i.id } });
  if (existing) return existing;
  const content = (Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[])
    .map((k) => `${SECTION_LABELS[k]}\n${i[k]}`)
    .join("\n\n");
  return saveTopic(actor, organizationId, null, {
    title: `Unterweisung: ${i.title}`,
    kind: "INSTRUCTION",
    description: `Auf Grundlage der Betriebsanweisung „${i.title}“ (V${i.version})`,
    content,
    legalBasis: i.type === "HAZARDOUS_SUBSTANCE" ? "§ 14 Abs. 2 GefStoffV" : "§ 12 BetrSichV, § 12 ArbSchG",
    intervalMonths: 12,
  }, i.id);
}

export async function setRequirements(
  actor: Actor,
  organizationId: string,
  topicId: string,
  input: { allEmployees: boolean; departmentIds: string[]; apprenticesOnly: boolean },
) {
  const topic = await db.trainingTopic.findFirst({ where: { id: topicId, organizationId } });
  if (!topic) throw new UserError("Thema nicht gefunden.");
  const deps = input.allEmployees ? [] : input.departmentIds;
  if (deps.length && (await db.department.count({ where: { id: { in: deps }, organizationId } })) !== deps.length) {
    throw new UserError("Abteilung nicht gefunden.");
  }
  const rows = input.allEmployees
    ? [{ departmentId: null, apprenticesOnly: input.apprenticesOnly }]
    : deps.map((d) => ({ departmentId: d, apprenticesOnly: input.apprenticesOnly }));
  await transaction(async (tx) => {
    await tx.trainingRequirement.deleteMany({ where: { topicId } });
    for (const r of rows) await tx.trainingRequirement.create({ data: { topicId, ...r } });
  });
  await audit({ organizationId, userId: actor.userId, action: "training.requirements", entity: "TrainingTopic", entityId: topicId, details: input });
}

/** Durchgeführte Unterweisung/Schulung mit Teilnehmenden erfassen. */
export async function recordSession(
  actor: Actor,
  organizationId: string,
  input: { topicId: string; date: Date; trainer: string; location?: string | null; notes?: string | null; employeeIds: string[] },
  now = new Date(),
) {
  if (!input.trainer) throw new UserError("Bitte angeben, wer unterwiesen hat.");
  if (input.date > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  const ids = [...new Set(input.employeeIds)];
  if (ids.length === 0) throw new UserError("Bitte mindestens eine teilnehmende Person auswählen.");
  const topic = await db.trainingTopic.findFirst({ where: { id: input.topicId, organizationId } });
  if (!topic) throw new UserError("Thema nicht gefunden.");
  const employees = await db.employee.findMany({ where: { id: { in: ids }, organizationId } });
  if (employees.length !== ids.length) throw new UserError("Mitarbeiter/in nicht gefunden.");

  const session = await transaction(async (tx) => {
    const s = await tx.trainingSession.create({
      data: { topicId: topic.id, date: input.date, trainer: input.trainer, location: input.location || null, notes: input.notes || null, userId: actor.userId },
    });
    await tx.trainingRecord.createMany({
      data: employees.map((e) => ({
        topicId: topic.id,
        employeeId: e.id,
        sessionId: s.id,
        completedAt: input.date,
        validUntil: validUntilFor(input.date, topic.kind, topic.intervalMonths, e.apprentice),
      })),
    });
    return s;
  });
  await audit({ organizationId, userId: actor.userId, action: "training.session_recorded", entity: "TrainingSession", entityId: session.id, details: { topic: topic.title, participants: ids.length } });
  return session;
}

/** Schulungsmatrix: aktive Beschäftigte × aktive Themen mit Pflicht. */
export async function getMatrix(organizationId: string, filter: { siteId?: string | null; departmentId?: string | null } = {}, now = new Date()) {
  const [employees, topics] = await Promise.all([
    db.employee.findMany({
      where: { organizationId, active: true, ...(filter.siteId ? { siteId: filter.siteId } : {}), ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
      include: { trainingRecords: { orderBy: { completedAt: "desc" } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.trainingTopic.findMany({ where: { organizationId, active: true, requirements: { some: {} } }, include: { requirements: true }, orderBy: { title: "asc" } }),
  ]);
  const rows = employees.map((e) => ({
    employee: e,
    cells: topics.map((t) => {
      if (!isRequired(t.requirements, e)) return { topicId: t.id, required: false as const, status: null, record: null };
      const record = e.trainingRecords.find((r) => r.topicId === t.id) ?? null;
      return { topicId: t.id, required: true as const, status: trainingStatus(record, now), record };
    }),
  }));
  const required = rows.flatMap((r) => r.cells.filter((c) => c.required));
  const fulfilled = required.filter((c) => c.status !== "missing" && c.status !== "overdue").length;
  return { topics, rows, rate: required.length ? Math.round((fulfilled / required.length) * 100) : 100 };
}

// ───────── Qualifikationen ─────────

export const QUAL_CATEGORY_LABELS = { FIRST_AID: "Ersthelfer/in", FIRE_WARDEN: "Brandschutzhelfer/in", OTHER: "Sonstige" } as const;

export const DEFAULT_QUALIFICATION_TYPES: { name: string; category: keyof typeof QUAL_CATEGORY_LABELS; validityMonths: number | null; legalBasis: string }[] = [
  { name: "Ersthelfer/in", category: "FIRST_AID", validityMonths: 24, legalBasis: "DGUV V1 § 26" },
  { name: "Brandschutzhelfer/in", category: "FIRE_WARDEN", validityMonths: 36, legalBasis: "ASR A2.2, DGUV I 205-023" },
  { name: "Fahrausweis Flurförderzeuge (Stapler)", category: "OTHER", validityMonths: null, legalBasis: "DGUV G 308-001, DGUV V68 § 7" },
  { name: "Kranführer/in", category: "OTHER", validityMonths: null, legalBasis: "DGUV G 309-003, DGUV V52 § 29" },
  { name: "Bediener/in Hubarbeitsbühne", category: "OTHER", validityMonths: null, legalBasis: "DGUV G 308-008" },
  { name: "Elektrofachkraft", category: "OTHER", validityMonths: null, legalBasis: "DGUV V3, DIN VDE 1000-10" },
  { name: "Elektrotechnisch unterwiesene Person (EuP)", category: "OTHER", validityMonths: 12, legalBasis: "DGUV V3" },
  { name: "Atemschutzgeräteträger/in", category: "OTHER", validityMonths: 12, legalBasis: "DGUV R 112-190" },
  { name: "Befähigte Person Leitern und Tritte", category: "OTHER", validityMonths: null, legalBasis: "TRBS 1203" },
  { name: "Sicherheitsbeauftragte/r", category: "OTHER", validityMonths: null, legalBasis: "§ 22 SGB VII, DGUV V1 § 20" },
];

export async function ensureDefaultQualificationTypes(organizationId: string) {
  if (await db.qualificationType.count({ where: { organizationId } })) return;
  await db.qualificationType.createMany({
    data: DEFAULT_QUALIFICATION_TYPES.map((t) => ({ ...t, organizationId })),
    skipDuplicates: true,
  });
}

export async function addQualification(
  actor: Actor,
  organizationId: string,
  input: { employeeId: string; typeId: string; acquiredAt: Date; validUntil?: Date | null; issuer?: string | null; notes?: string | null },
  now = new Date(),
) {
  if (input.acquiredAt > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  const [type, employee] = await Promise.all([
    db.qualificationType.findFirst({ where: { id: input.typeId, organizationId } }),
    db.employee.findFirst({ where: { id: input.employeeId, organizationId } }),
  ]);
  if (!type) throw new UserError("Qualifikationsart nicht gefunden.");
  if (!employee) throw new UserError("Mitarbeiter/in nicht gefunden.");
  const validUntil = input.validUntil ?? (type.validityMonths ? addMonths(input.acquiredAt, type.validityMonths) : null);
  const q = await db.qualification.create({
    data: { typeId: type.id, employeeId: employee.id, acquiredAt: input.acquiredAt, validUntil, issuer: input.issuer || null, notes: input.notes || null },
  });
  await audit({ organizationId, userId: actor.userId, action: "qualification.added", entity: "Qualification", entityId: q.id, details: { type: type.name, employee: `${employee.firstName} ${employee.lastName}` } });
  return q;
}

export async function removeQualification(actor: Actor, organizationId: string, id: string) {
  const r = await db.qualification.deleteMany({ where: { id, employee: { organizationId } } });
  if (!r.count) throw new UserError("Qualifikation nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "qualification.removed", entity: "Qualification", entityId: id });
}

export async function saveQualificationType(
  actor: Actor,
  organizationId: string,
  input: { name: string; category: keyof typeof QUAL_CATEGORY_LABELS; validityMonths: number | null; legalBasis?: string | null },
) {
  if (!input.name) throw new UserError("Bitte einen Namen angeben.");
  if (input.validityMonths != null && (!Number.isInteger(input.validityMonths) || input.validityMonths < 1)) throw new UserError("Ungültige Gültigkeit.");
  const exists = await db.qualificationType.findFirst({ where: { organizationId, name: input.name } });
  if (exists) throw new UserError("Diese Qualifikationsart gibt es bereits.");
  const t = await db.qualificationType.create({ data: { ...input, legalBasis: input.legalBasis || null, organizationId } });
  await audit({ organizationId, userId: actor.userId, action: "qualification_type.created", entity: "QualificationType", entityId: t.id, details: { name: t.name } });
  return t;
}

/** Ersthelfer-/Brandschutzhelferquote je Standort (Beschäftigte ohne Standort unter „ohne Standort“). */
export async function quotaReport(organizationId: string, now = new Date()) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const employees = await db.employee.findMany({
    where: { organizationId, active: true },
    include: { site: true, qualifications: { include: { type: true } } },
  });
  const valid = (q: { validUntil: Date | null }) => !q.validUntil || q.validUntil >= now;
  const groups = new Map<string, { site: string; employees: number; firstAid: number; fireWarden: number }>();
  for (const e of employees) {
    const key = e.siteId ?? "-";
    const g = groups.get(key) ?? { site: e.site?.name ?? "ohne Standort", employees: 0, firstAid: 0, fireWarden: 0 };
    g.employees++;
    if (e.qualifications.some((q) => q.type.category === "FIRST_AID" && valid(q))) g.firstAid++;
    if (e.qualifications.some((q) => q.type.category === "FIRE_WARDEN" && valid(q))) g.fireWarden++;
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.site.localeCompare(b.site))
    .map((g) => ({
      ...g,
      firstAidRequired: requiredCount(g.employees, org.firstAidRate),
      fireWardenRequired: requiredCount(g.employees, org.fireWardenRate),
    }));
}
