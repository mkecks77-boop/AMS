import type { ActionLevel, ActionPriority, ActionStatus } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  OPEN: "offen",
  IN_PROGRESS: "in Bearbeitung",
  DONE: "erledigt",
  VERIFIED: "wirksam",
  CANCELLED: "verworfen",
};

export const PRIORITY_LABELS: Record<ActionPriority, string> = { LOW: "niedrig", MEDIUM: "mittel", HIGH: "hoch" };

export const LEVEL_LABELS: Record<ActionLevel, string> = {
  SUBSTITUTION: "S – Substitution",
  TECHNICAL: "T – technisch",
  ORGANIZATIONAL: "O – organisatorisch",
  PERSONAL: "P – personenbezogen",
};

export const SOURCE_LABELS: Record<string, string> = {
  INCIDENT: "Unfall / Ereignis",
  AUDIT: "Begehung",
  RISK: "Gefährdungsbeurteilung",
  INSPECTION: "Prüfung",
  ASA: "ASA-Sitzung",
  LEGAL: "Rechtskataster",
  OTHER: "Sonstiges",
};

/** Erlaubte Statuswechsel */
const TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "DONE", "CANCELLED"],
  DONE: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: [],
  CANCELLED: ["OPEN"],
};

export function canTransition(from: ActionStatus, to: ActionStatus) {
  return from === to || TRANSITIONS[from].includes(to);
}

export const OPEN_STATUSES: ActionStatus[] = ["OPEN", "IN_PROGRESS"];

export interface ActionInput {
  title: string;
  description?: string | null;
  level?: ActionLevel | null;
  priority?: ActionPriority;
  responsibleId?: string | null;
  dueDate: Date;
}

/** Verknüpfungen zu Quellen (weitere kommen mit späteren Modulen hinzu) */
export interface ActionSource {
  sourceType?: string;
  incidentId?: string | null;
  riskAssessmentId?: string | null;
  hazardId?: string | null;
  walkthroughId?: string | null;
  asaMeetingId?: string | null;
  legalRequirementId?: string | null;
}

export async function createAction(actor: Actor, organizationId: string, input: ActionInput, source: ActionSource = {}) {
  if (!input.title) throw new UserError("Bitte die Maßnahme beschreiben.");
  await assertOwned(organizationId, { employeeId: input.responsibleId });
  if (source.incidentId && !(await db.incident.count({ where: { id: source.incidentId, organizationId } }))) {
    throw new UserError("Meldung nicht gefunden.");
  }
  if (source.riskAssessmentId && !(await db.riskAssessment.count({ where: { id: source.riskAssessmentId, organizationId } }))) {
    throw new UserError("Gefährdungsbeurteilung nicht gefunden.");
  }
  if (source.hazardId && !(await db.hazard.count({ where: { id: source.hazardId, assessment: { organizationId } } }))) {
    throw new UserError("Gefährdung nicht gefunden.");
  }
  if (source.walkthroughId && !(await db.walkthrough.count({ where: { id: source.walkthroughId, organizationId } }))) {
    throw new UserError("Begehung nicht gefunden.");
  }
  if (source.legalRequirementId && !(await db.legalRequirement.count({ where: { id: source.legalRequirementId, organizationId } }))) {
    throw new UserError("Anforderung nicht gefunden.");
  }
  if (source.asaMeetingId && !(await db.asaMeeting.count({ where: { id: source.asaMeetingId, organizationId } }))) {
    throw new UserError("Sitzung nicht gefunden.");
  }
  const a = await db.action.create({
    data: {
      organizationId,
      title: input.title,
      description: input.description || null,
      level: input.level ?? null,
      priority: input.priority ?? "MEDIUM",
      responsibleId: input.responsibleId || null,
      dueDate: input.dueDate,
      createdById: actor.userId,
      ...source,
      sourceType: source.sourceType ?? (source.incidentId ? "INCIDENT" : source.riskAssessmentId ? "RISK" : source.walkthroughId ? "AUDIT" : source.asaMeetingId ? "ASA" : source.legalRequirementId ? "LEGAL" : "OTHER"),
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "action.created", entity: "Action", entityId: a.id, details: { title: a.title } });
  return a;
}

export async function updateActionStatus(
  actor: Actor,
  organizationId: string,
  id: string,
  to: ActionStatus,
  note?: string | null,
  now = new Date(),
) {
  const a = await db.action.findFirst({ where: { id, organizationId } });
  if (!a) throw new UserError("Maßnahme nicht gefunden.");
  if (!canTransition(a.status, to)) throw new UserError(`Von „${ACTION_STATUS_LABELS[a.status]}“ nach „${ACTION_STATUS_LABELS[to]}“ ist nicht möglich.`);
  if (to === "VERIFIED" && !note) throw new UserError("Bitte die Wirksamkeitsprüfung beschreiben.");
  if (to === "CANCELLED" && !note) throw new UserError("Bitte begründen, warum die Maßnahme verworfen wird.");
  const updated = await db.action.update({
    where: { id },
    data: {
      status: to,
      completedAt: to === "DONE" ? now : to === "OPEN" || to === "IN_PROGRESS" ? null : a.completedAt,
      verifiedAt: to === "VERIFIED" ? now : null,
      effectivenessNote: to === "VERIFIED" || to === "CANCELLED" ? note : a.effectivenessNote,
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "action.status", entity: "Action", entityId: id, details: { from: a.status, to, note: note || null } });
  return updated;
}

export async function updateAction(actor: Actor, organizationId: string, id: string, input: ActionInput) {
  const a = await db.action.findFirst({ where: { id, organizationId } });
  if (!a) throw new UserError("Maßnahme nicht gefunden.");
  if (!input.title) throw new UserError("Bitte die Maßnahme beschreiben.");
  await assertOwned(organizationId, { employeeId: input.responsibleId });
  await db.action.update({
    where: { id },
    data: { title: input.title, description: input.description || null, level: input.level ?? null, priority: input.priority ?? a.priority, responsibleId: input.responsibleId || null, dueDate: input.dueDate },
  });
  await audit({ organizationId, userId: actor.userId, action: "action.updated", entity: "Action", entityId: id });
}
