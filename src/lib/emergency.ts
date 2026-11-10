import type { DrillKind } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  EVACUATION: "Räumungsübung",
  FIRE: "Brandschutzübung (Löschübung)",
  FIRST_AID: "Erste-Hilfe-Übung",
  OTHER: "Sonstige Notfallübung",
};

/** ASR A2.3: Räumungsübungen in angemessenen Zeitabständen – üblich ist mindestens jährlich */
export const DRILL_INTERVAL_MONTHS = 12;
export const PLAN_REVIEW_MONTHS = 12;

export interface PlanInput {
  internalEmergency?: string | null;
  fireBrigade?: string | null;
  poisonCenter?: string | null;
  doctorOnDuty?: string | null;
  dArzt?: string | null;
  assemblyPoint: string;
  evacuationHelpers?: string | null;
  firstAidRooms?: string | null;
  aedLocations?: string | null;
  alarmSignal?: string | null;
  notes?: string | null;
}

export async function savePlan(actor: Actor, organizationId: string, siteId: string, input: PlanInput, now = new Date()) {
  if (!input.assemblyPoint) throw new UserError("Bitte den Sammelplatz angeben.");
  await assertOwned(organizationId, { siteId });
  if (!siteId) throw new UserError("Bitte einen Standort wählen.");
  const data = {
    internalEmergency: input.internalEmergency || null,
    fireBrigade: input.fireBrigade || "112",
    poisonCenter: input.poisonCenter || null,
    doctorOnDuty: input.doctorOnDuty || null,
    dArzt: input.dArzt || null,
    assemblyPoint: input.assemblyPoint,
    evacuationHelpers: input.evacuationHelpers || null,
    firstAidRooms: input.firstAidRooms || null,
    aedLocations: input.aedLocations || null,
    alarmSignal: input.alarmSignal || null,
    notes: input.notes || null,
    reviewedAt: now,
    reviewDue: addMonths(now, PLAN_REVIEW_MONTHS),
  };
  const plan = await db.emergencyPlan.upsert({ where: { siteId }, create: { ...data, organizationId, siteId }, update: data });
  await audit({ organizationId, userId: actor.userId, action: "emergency.plan_saved", entity: "EmergencyPlan", entityId: plan.id });
  return plan;
}

export async function planDrill(actor: Actor, organizationId: string, input: { siteId: string; kind: DrillKind; plannedAt: Date; scenario?: string | null; announced?: boolean }) {
  if (!input.siteId) throw new UserError("Bitte einen Standort wählen.");
  await assertOwned(organizationId, { siteId: input.siteId });
  const d = await db.drill.create({ data: { organizationId, siteId: input.siteId, kind: input.kind, plannedAt: input.plannedAt, scenario: input.scenario || null, announced: input.announced ?? true } });
  await audit({ organizationId, userId: actor.userId, action: "emergency.drill_planned", entity: "Drill", entityId: d.id });
  return d;
}

export async function completeDrill(
  actor: Actor,
  organizationId: string,
  id: string,
  input: { performedAt: Date; participants?: number | null; evacuationMinutes?: number | null; observations: string },
  now = new Date(),
) {
  const d = await db.drill.findFirst({ where: { id, organizationId } });
  if (!d) throw new UserError("Übung nicht gefunden.");
  if (d.performedAt) throw new UserError("Die Übung ist bereits ausgewertet.");
  if (input.performedAt > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  if (!input.observations) throw new UserError("Bitte die Beobachtungen festhalten (Ablauf, Probleme, Verbesserungen).");
  for (const [v, l] of [[input.participants, "Teilnehmerzahl"], [input.evacuationMinutes, "Räumungszeit"]] as const) {
    if (v != null && (!Number.isInteger(v) || v < 0)) throw new UserError(`Ungültige ${l}.`);
  }
  await db.drill.update({ where: { id }, data: { performedAt: input.performedAt, participants: input.participants ?? null, evacuationMinutes: input.evacuationMinutes ?? null, observations: input.observations } });
  await audit({ organizationId, userId: actor.userId, action: "emergency.drill_done", entity: "Drill", entityId: id });
}

/** Nächste fällige Übung je Standort: geplanter Termin oder letzte durchgeführte + 12 Monate */
export async function drillStatus(organizationId: string, now = new Date()) {
  const sites = await db.site.findMany({ where: { organizationId, active: true }, include: { drills: { orderBy: { plannedAt: "desc" } }, emergencyPlan: true }, orderBy: { name: "asc" } });
  return sites.map((s) => {
    const planned = s.drills.filter((d) => !d.performedAt).sort((a, b) => a.plannedAt.getTime() - b.plannedAt.getTime())[0] ?? null;
    const last = s.drills.filter((d) => d.performedAt && d.kind === "EVACUATION").sort((a, b) => b.performedAt!.getTime() - a.performedAt!.getTime())[0] ?? null;
    const nextDue = planned?.plannedAt ?? (last ? addMonths(last.performedAt!, DRILL_INTERVAL_MONTHS) : now);
    return { site: s, plan: s.emergencyPlan, planned, last, nextDue };
  });
}
