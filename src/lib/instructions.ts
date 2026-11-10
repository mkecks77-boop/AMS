import type { HazardousSubstance, InstructionStatus, InstructionType, OperatingInstruction } from "@prisma/client";
import { createId } from "./id";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { cmrCategory, formatStatement, statementText } from "./ghs";
import { UserError, type Actor } from "./users";

export const TYPE_LABELS: Record<InstructionType, string> = {
  HAZARDOUS_SUBSTANCE: "Gefahrstoff",
  MACHINE: "Maschine / Arbeitsmittel",
  ACTIVITY: "Tätigkeit",
  BIOLOGICAL: "Biostoffe",
  PPE: "PSA",
};

/** Farbe der Balken im Standardlayout */
export const TYPE_COLORS: Record<InstructionType, string> = {
  HAZARDOUS_SUBSTANCE: "#e8712a",
  MACHINE: "#1d5fa8",
  ACTIVITY: "#1d5fa8",
  BIOLOGICAL: "#2e8b3d",
  PPE: "#1d5fa8",
};

export const TYPE_LEGAL: Record<InstructionType, string> = {
  HAZARDOUS_SUBSTANCE: "gemäß § 14 GefStoffV / TRGS 555",
  MACHINE: "gemäß § 12 BetrSichV",
  ACTIVITY: "gemäß § 12 ArbSchG / DGUV Vorschrift 1",
  BIOLOGICAL: "gemäß § 14 BioStoffV",
  PPE: "gemäß § 3 PSA-BV",
};

export const STATUS_LABELS: Record<InstructionStatus, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "zur Freigabe",
  RELEASED: "freigegeben",
  ARCHIVED: "archiviert",
};

export const SECTION_LABELS = {
  hazards: "Gefahren für Mensch und Umwelt",
  protectiveMeasures: "Schutzmaßnahmen und Verhaltensregeln",
  malfunctions: "Verhalten im Gefahrfall / bei Störungen",
  firstAid: "Erste Hilfe",
  maintenance: "Sachgerechte Entsorgung / Instandhaltung",
} as const;

export const REVIEW_MONTHS = 24;

export type InstructionContent = {
  type: InstructionType;
  title: string;
  scope?: string | null;
  hazards: string;
  protectiveMeasures: string;
  malfunctions: string;
  firstAid: string;
  maintenance: string;
  pictograms: string[];
  emergencyPhone?: string | null;
  postings?: string | null;
};

const lines = (codes: string[]) => codes.map((c) => `• ${statementText(c) || c.replace(/_/g, " + ")}`).join("\n");

/** Erzeugt einen BA-Entwurf aus den Daten eines Gefahrstoffs (Ausgangspunkt, von der Sifa zu prüfen). */
export function draftFromSubstance(s: Pick<HazardousSubstance, "name" | "usage" | "pictograms" | "hStatements" | "pStatements" | "ppe" | "storageClass">): InstructionContent {
  const p = s.pStatements;
  const pick = (re: RegExp) => p.filter((c) => re.test(c));
  const cmr = cmrCategory(s.hStatements);

  const hazards = [
    s.hStatements.map(formatStatement).map((t) => `• ${t}`).join("\n"),
    cmr ? `• Achtung: CMR-Stoff (Kategorie ${cmr}) – besondere Schutzmaßnahmen nach § 10 GefStoffV beachten.` : "",
  ].filter(Boolean).join("\n");

  const protective = [
    lines(pick(/^P2/)),
    s.ppe ? `• Persönliche Schutzausrüstung: ${s.ppe}` : "",
    "• Behälter nach Gebrauch verschließen, nur gekennzeichnete Behälter verwenden.",
    "• Am Arbeitsplatz nicht essen, trinken oder rauchen.",
  ].filter(Boolean).join("\n");

  const malfunctions = [
    lines(pick(/^P3[7-9]/)),
    "• Gefahrenbereich räumen und absichern, Vorgesetzte informieren.",
    "• Verschüttete Mengen mit geeignetem Bindemittel aufnehmen und entsorgen.",
  ].filter(Boolean).join("\n");

  const firstAid = [
    lines(pick(/^P3[0-3]/)),
    "• Ersthelfer heranziehen, bei Bedarf Notruf 112.",
    "• Verletzte Person aus dem Gefahrenbereich bringen, Eigenschutz beachten.",
  ].filter(Boolean).join("\n");

  const maintenance = [
    lines(pick(/^P(4|5)/)),
    s.storageClass ? `• Lagerung gemäß Lagerklasse ${s.storageClass} (TRGS 510).` : "",
    "• Reste und Verpackungen nicht in den Ausguss oder Hausmüll geben.",
  ].filter(Boolean).join("\n");

  const picto = new Set<string>(s.pictograms);
  if (p.some((c) => c.startsWith("P280"))) { picto.add("M009"); picto.add("M004"); }
  if (p.some((c) => c.startsWith("P284"))) picto.add("M017");
  if (p.some((c) => c.startsWith("P210"))) picto.add("P003");

  return {
    type: "HAZARDOUS_SUBSTANCE",
    title: s.name,
    scope: s.usage ?? null,
    hazards,
    protectiveMeasures: protective,
    malfunctions,
    firstAid,
    maintenance,
    pictograms: [...picto],
    emergencyPhone: "112",
  };
}

/** Vier-Augen-Prinzip: Wer zuletzt bearbeitet hat, darf nicht selbst freigeben. */
export function canRelease(instr: Pick<OperatingInstruction, "status" | "lastEditorId">, actorId: string) {
  if (instr.status !== "IN_REVIEW") return { ok: false, reason: "Nur vorgelegte Betriebsanweisungen können freigegeben werden." };
  if (instr.lastEditorId === actorId) {
    return { ok: false, reason: "Vier-Augen-Prinzip: Die Freigabe muss eine andere Person erteilen als die, die zuletzt bearbeitet hat." };
  }
  return { ok: true as const, reason: "" };
}

function validate(c: InstructionContent) {
  if (!c.title.trim()) throw new UserError("Bitte einen Titel angeben.");
}

async function load(organizationId: string, id: string) {
  const i = await db.operatingInstruction.findFirst({ where: { id, organizationId } });
  if (!i) throw new UserError("Betriebsanweisung nicht gefunden.");
  return i;
}

async function assertLinks(organizationId: string, links: { substanceId?: string | null; equipmentId?: string | null }) {
  if (links.substanceId && !(await db.hazardousSubstance.count({ where: { id: links.substanceId, organizationId } }))) {
    throw new UserError("Gefahrstoff nicht gefunden.");
  }
  if (links.equipmentId && !(await db.equipment.count({ where: { id: links.equipmentId, organizationId } }))) {
    throw new UserError("Anlage nicht gefunden.");
  }
}

export async function createInstruction(
  actor: Actor,
  organizationId: string,
  content: InstructionContent,
  links: { substanceId?: string | null; equipmentId?: string | null } = {},
) {
  validate(content);
  await assertLinks(organizationId, links);
  const seriesId = createId();
  const i = await db.operatingInstruction.create({
    data: {
      ...content,
      organizationId,
      seriesId,
      version: 1,
      authorId: actor.userId,
      lastEditorId: actor.userId,
      substanceId: links.substanceId || null,
      equipmentId: links.equipmentId || null,
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "instruction.created", entity: "OperatingInstruction", entityId: i.id, details: { title: i.title } });
  return i;
}

export async function updateInstruction(
  actor: Actor,
  organizationId: string,
  id: string,
  content: InstructionContent,
  links: { substanceId?: string | null; equipmentId?: string | null } = {},
) {
  validate(content);
  const i = await load(organizationId, id);
  if (i.status !== "DRAFT" && i.status !== "IN_REVIEW") {
    throw new UserError("Freigegebene Betriebsanweisungen werden nicht geändert – bitte eine neue Version anlegen.");
  }
  await assertLinks(organizationId, links);
  const updated = await db.operatingInstruction.update({
    where: { id },
    // Änderung während der Prüfung → zurück in den Entwurf
    data: { ...content, status: "DRAFT", lastEditorId: actor.userId, substanceId: links.substanceId || null, equipmentId: links.equipmentId || null },
  });
  await audit({ organizationId, userId: actor.userId, action: "instruction.updated", entity: "OperatingInstruction", entityId: id });
  return updated;
}

export async function submitForReview(actor: Actor, organizationId: string, id: string) {
  const i = await load(organizationId, id);
  if (i.status !== "DRAFT") throw new UserError("Nur Entwürfe können zur Freigabe vorgelegt werden.");
  const missing = (Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).filter((k) => !i[k].trim());
  if (missing.length) throw new UserError(`Bitte noch ausfüllen: ${missing.map((k) => SECTION_LABELS[k]).join(", ")}.`);
  await db.operatingInstruction.update({ where: { id }, data: { status: "IN_REVIEW" } });
  await audit({ organizationId, userId: actor.userId, action: "instruction.submitted", entity: "OperatingInstruction", entityId: id });
}

export async function releaseInstruction(actor: Actor, organizationId: string, id: string, now = new Date()) {
  const i = await load(organizationId, id);
  const check = canRelease(i, actor.userId);
  if (!check.ok) throw new UserError(check.reason);
  await db.$transaction([
    db.operatingInstruction.updateMany({
      where: { seriesId: i.seriesId, status: "RELEASED" },
      data: { status: "ARCHIVED" },
    }),
    db.operatingInstruction.update({
      where: { id },
      data: { status: "RELEASED", releasedById: actor.userId, releasedAt: now, reviewDue: addMonths(now, REVIEW_MONTHS) },
    }),
  ]);
  await audit({ organizationId, userId: actor.userId, action: "instruction.released", entity: "OperatingInstruction", entityId: id, details: { title: i.title, version: i.version } });
}

export async function returnToDraft(actor: Actor, organizationId: string, id: string, note?: string) {
  const i = await load(organizationId, id);
  if (i.status !== "IN_REVIEW") throw new UserError("Nur vorgelegte Betriebsanweisungen können zurückgegeben werden.");
  await db.operatingInstruction.update({ where: { id }, data: { status: "DRAFT" } });
  await audit({ organizationId, userId: actor.userId, action: "instruction.returned", entity: "OperatingInstruction", entityId: id, details: { note: note || null } });
}

/** Neue Version aus einer freigegebenen BA (z. B. bei Überprüfung oder neuem SDB). */
export async function newVersion(actor: Actor, organizationId: string, id: string) {
  const i = await load(organizationId, id);
  if (i.status !== "RELEASED") throw new UserError("Neue Versionen werden aus der freigegebenen Fassung erstellt.");
  const open = await db.operatingInstruction.findFirst({
    where: { seriesId: i.seriesId, status: { in: ["DRAFT", "IN_REVIEW"] } },
  });
  if (open) throw new UserError(`Es gibt bereits eine offene Version (V${open.version}).`);
  const last = await db.operatingInstruction.aggregate({ where: { seriesId: i.seriesId }, _max: { version: true } });
  const copy = await db.operatingInstruction.create({
    data: {
      organizationId,
      seriesId: i.seriesId,
      version: (last._max.version ?? i.version) + 1,
      type: i.type,
      title: i.title,
      scope: i.scope,
      hazards: i.hazards,
      protectiveMeasures: i.protectiveMeasures,
      malfunctions: i.malfunctions,
      firstAid: i.firstAid,
      maintenance: i.maintenance,
      pictograms: i.pictograms,
      emergencyPhone: i.emergencyPhone,
      postings: i.postings,
      substanceId: i.substanceId,
      equipmentId: i.equipmentId,
      authorId: actor.userId,
      lastEditorId: actor.userId,
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "instruction.new_version", entity: "OperatingInstruction", entityId: copy.id, details: { version: copy.version } });
  return copy;
}

export async function withdrawInstruction(actor: Actor, organizationId: string, id: string) {
  const i = await load(organizationId, id);
  if (i.status !== "RELEASED") throw new UserError("Nur freigegebene Betriebsanweisungen können zurückgezogen werden.");
  await db.operatingInstruction.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ organizationId, userId: actor.userId, action: "instruction.withdrawn", entity: "OperatingInstruction", entityId: id });
}
