import type { SignalWord } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { GHS_PICTOGRAMS, STORAGE_CLASSES, WATER_HAZARD_CLASSES } from "./ghs";
import { createInstruction, draftFromSubstance } from "./instructions";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const SUBSTANCE_STATUS_LABELS = {
  REQUESTED: "beantragt",
  APPROVED: "freigegeben",
  REJECTED: "abgelehnt",
  PHASED_OUT: "nicht mehr im Einsatz",
} as const;

/** Standard-Wiedervorlage für die Aktualität des Sicherheitsdatenblatts */
export const SDS_REVIEW_MONTHS = 12;

export interface SubstanceInput {
  name: string;
  manufacturer?: string | null;
  casNumber?: string | null;
  usage?: string | null;
  pictograms: string[];
  signalWord: SignalWord;
  hStatements: string[];
  pStatements: string[];
  storageClass?: string | null;
  waterHazardClass?: string | null;
  sdsDate?: Date | null;
  sdsReviewDue?: Date | null;
  ppe?: string | null;
  substitutionChecked?: boolean;
  substitutionNotes?: string | null;
}

function clean(i: SubstanceInput, now: Date) {
  if (!i.name) throw new UserError("Bitte die Produktbezeichnung angeben.");
  const bad = i.pictograms.filter((p) => !(p in GHS_PICTOGRAMS));
  if (bad.length) throw new UserError(`Unbekannte Piktogramme: ${bad.join(", ")}`);
  if (i.storageClass && !(i.storageClass in STORAGE_CLASSES)) throw new UserError("Unbekannte Lagerklasse.");
  if (i.waterHazardClass && !WATER_HAZARD_CLASSES.includes(i.waterHazardClass)) throw new UserError("Unbekannte Wassergefährdungsklasse.");
  if (i.casNumber && !/^\d{2,7}-\d{2}-\d$/.test(i.casNumber)) throw new UserError("Die CAS-Nummer hat das Format 1234-56-7.");
  if (i.sdsDate && i.sdsDate > now) throw new UserError("Das Datum des Sicherheitsdatenblatts liegt in der Zukunft.");
  return {
    name: i.name,
    manufacturer: i.manufacturer || null,
    casNumber: i.casNumber || null,
    usage: i.usage || null,
    pictograms: i.pictograms,
    signalWord: i.signalWord,
    hStatements: i.hStatements,
    pStatements: i.pStatements,
    storageClass: i.storageClass || null,
    waterHazardClass: i.waterHazardClass || null,
    sdsDate: i.sdsDate ?? null,
    sdsReviewDue: i.sdsReviewDue ?? (i.sdsDate ? addMonths(now, SDS_REVIEW_MONTHS) : null),
    ppe: i.ppe || null,
    substitutionChecked: !!i.substitutionChecked,
    substitutionNotes: i.substitutionNotes || null,
  };
}

/** Neuer Gefahrstoff = Antrag. Die Freigabe erfolgt gesondert durch die Sifa. */
export async function saveSubstance(actor: Actor, organizationId: string, id: string | null, input: SubstanceInput, now = new Date()) {
  const data = clean(input, now);
  let s;
  if (id) {
    const existing = await db.hazardousSubstance.findFirst({ where: { id, organizationId } });
    if (!existing) throw new UserError("Gefahrstoff nicht gefunden.");
    // neues SDB-Datum → Wiedervorlage neu berechnen, sofern nicht explizit gesetzt
    if (!input.sdsReviewDue && input.sdsDate && existing.sdsDate?.getTime() !== input.sdsDate.getTime()) {
      data.sdsReviewDue = addMonths(now, SDS_REVIEW_MONTHS);
    }
    s = await db.hazardousSubstance.update({ where: { id }, data });
  } else {
    s = await db.hazardousSubstance.create({ data: { ...data, organizationId, requestedById: actor.userId } });
  }
  await audit({
    organizationId,
    userId: actor.userId,
    action: id ? "substance.updated" : "substance.requested",
    entity: "HazardousSubstance",
    entityId: s.id,
    details: { name: s.name },
  });
  return s;
}

/**
 * Freigabe oder Ablehnung. Bei Freigabe muss die Substitutionsprüfung (§ 6 Abs. 1 GefStoffV)
 * dokumentiert sein; ein BA-Entwurf wird automatisch angelegt, falls noch keiner existiert.
 */
export async function decideSubstance(
  actor: Actor,
  organizationId: string,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string | null,
  now = new Date(),
) {
  const s = await db.hazardousSubstance.findFirst({ where: { id, organizationId } });
  if (!s) throw new UserError("Gefahrstoff nicht gefunden.");
  if (s.status !== "REQUESTED") throw new UserError("Über diesen Gefahrstoff wurde bereits entschieden.");
  if (decision === "REJECTED" && !note) throw new UserError("Bitte die Ablehnung begründen.");
  if (decision === "APPROVED") {
    if (!s.substitutionChecked) throw new UserError("Vor der Freigabe die Substitutionsprüfung dokumentieren (§ 6 Abs. 1 GefStoffV).");
    if (!s.sdsDate) throw new UserError("Vor der Freigabe das Datum des Sicherheitsdatenblatts erfassen.");
  }
  await db.hazardousSubstance.update({
    where: { id },
    data: { status: decision, decidedById: actor.userId, decidedAt: now, decisionNote: note || null },
  });
  await audit({ organizationId, userId: actor.userId, action: decision === "APPROVED" ? "substance.approved" : "substance.rejected", entity: "HazardousSubstance", entityId: id, details: { name: s.name, note: note || null } });

  if (decision === "APPROVED" && !(await db.operatingInstruction.count({ where: { substanceId: id } }))) {
    return createInstruction(actor, organizationId, draftFromSubstance(s), { substanceId: id });
  }
  return null;
}

export async function phaseOutSubstance(actor: Actor, organizationId: string, id: string) {
  const r = await db.hazardousSubstance.updateMany({ where: { id, organizationId, status: "APPROVED" }, data: { status: "PHASED_OUT" } });
  if (r.count === 0) throw new UserError("Nur freigegebene Gefahrstoffe können außer Betrieb genommen werden.");
  await audit({ organizationId, userId: actor.userId, action: "substance.phased_out", entity: "HazardousSubstance", entityId: id });
}

export async function addSubstanceUse(
  actor: Actor,
  organizationId: string,
  input: { substanceId: string; siteId?: string | null; workArea: string; quantity?: number | null; unit?: string | null },
) {
  if (!input.workArea) throw new UserError("Bitte den Arbeitsbereich angeben.");
  if (input.quantity != null && (Number.isNaN(input.quantity) || input.quantity < 0)) throw new UserError("Ungültige Menge.");
  if (!(await db.hazardousSubstance.count({ where: { id: input.substanceId, organizationId } }))) {
    throw new UserError("Gefahrstoff nicht gefunden.");
  }
  await assertOwned(organizationId, { siteId: input.siteId });
  const use = await db.substanceUse.create({
    data: { substanceId: input.substanceId, siteId: input.siteId || null, workArea: input.workArea, quantity: input.quantity ?? null, unit: input.unit || null },
  });
  await audit({ organizationId, userId: actor.userId, action: "substance.use_added", entity: "SubstanceUse", entityId: use.id, details: { workArea: use.workArea } });
  return use;
}

export async function removeSubstanceUse(actor: Actor, organizationId: string, useId: string) {
  const r = await db.substanceUse.deleteMany({ where: { id: useId, substance: { organizationId } } });
  if (r.count === 0) throw new UserError("Eintrag nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "substance.use_removed", entity: "SubstanceUse", entityId: useId });
}
