import type { RiskAssessmentKind } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

/** Gefährdungsfaktoren nach GDA-Leitlinie „Gefährdungsbeurteilung und Dokumentation“ */
export const HAZARD_FACTORS: Record<string, string> = {
  "1": "Mechanische Gefährdungen",
  "2": "Elektrische Gefährdungen",
  "3": "Gefahrstoffe",
  "4": "Biologische Arbeitsstoffe",
  "5": "Brand- und Explosionsgefährdungen",
  "6": "Thermische Gefährdungen",
  "7": "Spezielle physikalische Einwirkungen (Lärm, Vibration, Strahlung)",
  "8": "Arbeitsumgebungsbedingungen (Klima, Beleuchtung)",
  "9": "Physische Belastung / Arbeitsschwere",
  "10": "Psychische Faktoren",
  "11": "Sonstige Gefährdungen",
};

export const KIND_LABELS: Record<RiskAssessmentKind, string> = {
  GENERAL: "Arbeitsplatz / Tätigkeit",
  PSYCHOLOGICAL: "Psychische Belastung",
  MATERNITY: "Mutterschutz",
};

export const PROBABILITY_LABELS = ["", "sehr unwahrscheinlich", "unwahrscheinlich", "möglich", "wahrscheinlich", "sehr wahrscheinlich"];
export const SEVERITY_LABELS = ["", "unbedeutend", "gering", "mittel", "schwer", "katastrophal"];

export type RiskLevel = "low" | "medium" | "high" | "very_high";

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "gering",
  medium: "mittel",
  high: "hoch",
  very_high: "sehr hoch",
};

/** 5×5-Matrix: Risiko = Wahrscheinlichkeit × Schwere */
export function riskScore(p: number, s: number) {
  return p * s;
}

export function riskLevel(p: number, s: number): RiskLevel {
  const r = riskScore(p, s);
  if (r >= 20) return "very_high";
  if (r >= 10) return "high";
  if (r >= 5) return "medium";
  return "low";
}

function checkScale(v: number | null | undefined, label: string) {
  if (v == null) return;
  if (!Number.isInteger(v) || v < 1 || v > 5) throw new UserError(`${label} muss zwischen 1 und 5 liegen.`);
}

export interface AssessmentInput {
  title: string;
  kind: RiskAssessmentKind;
  siteId?: string | null;
  departmentId?: string | null;
  scope?: string | null;
  participants?: string | null;
  responsibleId?: string | null;
  reviewIntervalMonths?: number;
}

export async function saveAssessment(actor: Actor, organizationId: string, id: string | null, input: AssessmentInput) {
  if (!input.title) throw new UserError("Bitte einen Titel angeben.");
  const interval = input.reviewIntervalMonths ?? 24;
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) throw new UserError("Das Überprüfungsintervall muss zwischen 1 und 60 Monaten liegen.");
  await assertOwned(organizationId, { siteId: input.siteId, departmentId: input.departmentId, employeeId: input.responsibleId });
  const data = {
    title: input.title,
    kind: input.kind,
    siteId: input.siteId || null,
    departmentId: input.departmentId || null,
    scope: input.scope || null,
    participants: input.participants || null,
    responsibleId: input.responsibleId || null,
    reviewIntervalMonths: interval,
  };
  let ra;
  if (id) {
    const existing = await db.riskAssessment.findFirst({ where: { id, organizationId } });
    if (!existing) throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
    if (existing.status === "ARCHIVED") throw new UserError("Archivierte Gefährdungsbeurteilungen können nicht geändert werden.");
    ra = await db.riskAssessment.update({ where: { id }, data: { ...data, status: "DRAFT" } });
  } else {
    ra = await db.riskAssessment.create({ data: { ...data, organizationId } });
  }
  await audit({ organizationId, userId: actor.userId, action: id ? "risk.updated" : "risk.created", entity: "RiskAssessment", entityId: ra.id, details: { title: ra.title } });
  return ra;
}

export interface HazardInput {
  factor: string;
  description: string;
  probability: number;
  severity: number;
  measures?: string;
  residualProbability?: number | null;
  residualSeverity?: number | null;
}

function cleanHazard(h: HazardInput) {
  if (!(h.factor in HAZARD_FACTORS)) throw new UserError("Bitte einen Gefährdungsfaktor wählen.");
  if (!h.description) throw new UserError("Bitte die Gefährdung beschreiben.");
  checkScale(h.probability, "Die Wahrscheinlichkeit");
  checkScale(h.severity, "Die Schwere");
  checkScale(h.residualProbability, "Die Rest-Wahrscheinlichkeit");
  checkScale(h.residualSeverity, "Die Rest-Schwere");
  return { ...h, measures: h.measures ?? "", residualProbability: h.residualProbability ?? null, residualSeverity: h.residualSeverity ?? null };
}

async function editableAssessment(organizationId: string, id: string) {
  const ra = await db.riskAssessment.findFirst({ where: { id, organizationId } });
  if (!ra) throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
  if (ra.status === "ARCHIVED") throw new UserError("Archivierte Gefährdungsbeurteilungen können nicht geändert werden.");
  return ra;
}

export async function saveHazard(actor: Actor, organizationId: string, assessmentId: string, hazardId: string | null, input: HazardInput) {
  await editableAssessment(organizationId, assessmentId);
  const data = cleanHazard(input);
  let h;
  if (hazardId) {
    const r = await db.hazard.updateMany({ where: { id: hazardId, assessmentId }, data });
    if (!r.count) throw new UserError("Gefährdung nicht gefunden.");
    h = await db.hazard.findUniqueOrThrow({ where: { id: hazardId } });
  } else {
    const n = await db.hazard.count({ where: { assessmentId } });
    h = await db.hazard.create({ data: { ...data, assessmentId, sortOrder: n } });
  }
  // jede inhaltliche Änderung macht eine Freigabe hinfällig
  await db.riskAssessment.update({ where: { id: assessmentId }, data: { status: "DRAFT" } });
  await audit({ organizationId, userId: actor.userId, action: "risk.hazard_saved", entity: "Hazard", entityId: h.id, details: { factor: h.factor } });
  return h;
}

export async function deleteHazard(actor: Actor, organizationId: string, assessmentId: string, hazardId: string) {
  await editableAssessment(organizationId, assessmentId);
  const r = await db.hazard.deleteMany({ where: { id: hazardId, assessmentId } });
  if (!r.count) throw new UserError("Gefährdung nicht gefunden.");
  await db.riskAssessment.update({ where: { id: assessmentId }, data: { status: "DRAFT" } });
  await audit({ organizationId, userId: actor.userId, action: "risk.hazard_deleted", entity: "Hazard", entityId: hazardId });
}

/** Freigabe: jede Gefährdung braucht Maßnahmen und eine Bewertung des Restrisikos. */
export function releaseProblems(hazards: { description: string; measures: string; residualProbability: number | null; residualSeverity: number | null; probability: number; severity: number }[]): string[] {
  const problems: string[] = [];
  if (hazards.length === 0) problems.push("Es ist noch keine Gefährdung erfasst.");
  for (const h of hazards) {
    if (!h.measures.trim()) problems.push(`„${h.description}“: Schutzmaßnahmen fehlen.`);
    if (h.residualProbability == null || h.residualSeverity == null) problems.push(`„${h.description}“: Restrisiko nicht bewertet.`);
    else if (riskLevel(h.residualProbability, h.residualSeverity) === "very_high") problems.push(`„${h.description}“: Restrisiko ist sehr hoch – weitere Maßnahmen erforderlich.`);
  }
  return problems;
}

export async function releaseAssessment(actor: Actor, organizationId: string, id: string, now = new Date()) {
  const ra = await db.riskAssessment.findFirst({ where: { id, organizationId }, include: { hazards: true } });
  if (!ra) throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
  if (ra.status !== "DRAFT") throw new UserError("Nur Entwürfe können freigegeben werden.");
  const problems = releaseProblems(ra.hazards);
  if (problems.length) throw new UserError(problems.join(" "));
  await db.riskAssessment.update({
    where: { id },
    data: { status: "RELEASED", releasedAt: now, releasedById: actor.userId, reviewDue: addMonths(now, ra.reviewIntervalMonths) },
  });
  await audit({ organizationId, userId: actor.userId, action: "risk.released", entity: "RiskAssessment", entityId: id, details: { title: ra.title } });
}

/** Kopie als Vorlage (z. B. für einen gleichartigen Arbeitsplatz) */
export async function copyAssessment(actor: Actor, organizationId: string, id: string) {
  const ra = await db.riskAssessment.findFirst({ where: { id, organizationId }, include: { hazards: { orderBy: { sortOrder: "asc" } } } });
  if (!ra) throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
  const copy = await db.riskAssessment.create({
    data: {
      organizationId,
      title: `${ra.title} (Kopie)`,
      kind: ra.kind,
      siteId: ra.siteId,
      departmentId: ra.departmentId,
      scope: ra.scope,
      responsibleId: ra.responsibleId,
      reviewIntervalMonths: ra.reviewIntervalMonths,
      hazards: { create: ra.hazards.map(({ factor, description, probability, severity, measures, residualProbability, residualSeverity, sortOrder }) => ({ factor, description, probability, severity, measures, residualProbability, residualSeverity, sortOrder })) },
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "risk.copied", entity: "RiskAssessment", entityId: copy.id, details: { from: ra.id } });
  return copy;
}

export async function archiveAssessment(actor: Actor, organizationId: string, id: string) {
  const r = await db.riskAssessment.updateMany({ where: { id, organizationId, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
  if (!r.count) throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "risk.archived", entity: "RiskAssessment", entityId: id });
}
