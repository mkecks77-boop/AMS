import type { PermitType } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const BRIEFING_MONTHS = 12;

export const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  HOT_WORK: "Heißarbeiten (Schweißen, Schneiden, Trennschleifen)",
  CONFINED_SPACE: "Arbeiten in Behältern und engen Räumen",
  HEIGHT: "Arbeiten mit Absturzgefahr",
  ELECTRICAL: "Arbeiten an elektrischen Anlagen",
  EXCAVATION: "Erdarbeiten / Grabungen",
  OTHER: "Sonstige gefährliche Arbeiten",
};

export const PERMIT_STATUS_LABELS = { REQUESTED: "beantragt", APPROVED: "genehmigt", ACTIVE: "freigegeben (läuft)", CLOSED: "abgeschlossen", REJECTED: "abgelehnt" } as const;

/** Checklisten je Art – vor Arbeitsbeginn vor Ort zu bestätigen */
export const PERMIT_CHECKS: Record<PermitType, string[]> = {
  HOT_WORK: [
    "Brennbare Stoffe im Umkreis von 10 m entfernt oder abgedeckt",
    "Öffnungen, Fugen und Durchbrüche abgedichtet",
    "Geeignete Feuerlöscher bereitgestellt",
    "Brandwache gestellt, Brandmeldeanlage berücksichtigt",
    "Explosionsgefährdete Bereiche ausgeschlossen bzw. freigemessen",
  ],
  CONFINED_SPACE: [
    "Behälter entleert, gereinigt und gegen Zufluss gesichert",
    "Freimessung (O₂, Ex, toxische Gase) durchgeführt",
    "Lüftung sichergestellt",
    "Sicherungsposten außerhalb des Behälters",
    "Rettungsausrüstung und Rettungsplan vorhanden",
  ],
  HEIGHT: [
    "Kollektiver Absturzschutz (Geländer, Netz) geprüft",
    "PSA gegen Absturz geprüft und Anschlagpunkte festgelegt",
    "Bereich unterhalb abgesperrt",
    "Rettungskonzept vorhanden",
  ],
  ELECTRICAL: [
    "Freigeschaltet",
    "Gegen Wiedereinschalten gesichert",
    "Spannungsfreiheit allpolig festgestellt",
    "Geerdet und kurzgeschlossen",
    "Benachbarte, unter Spannung stehende Teile abgedeckt",
  ],
  EXCAVATION: [
    "Leitungspläne eingeholt (Strom, Gas, Wasser, Telekommunikation)",
    "Verbau / Böschung gemäß DIN 4124",
    "Absperrung und Beleuchtung",
  ],
  OTHER: ["Gefährdungsbeurteilung für die Arbeit liegt vor", "Beteiligte sind unterwiesen"],
};

export async function saveContractor(
  actor: Actor,
  organizationId: string,
  id: string | null,
  input: { name: string; contactName?: string | null; phone?: string | null; email?: string | null; insuranceUntil?: Date | null; notes?: string | null },
) {
  if (!input.name) throw new UserError("Bitte den Firmennamen angeben.");
  const data = { name: input.name, contactName: input.contactName || null, phone: input.phone || null, email: input.email || null, insuranceUntil: input.insuranceUntil ?? null, notes: input.notes || null };
  let c;
  if (id) {
    if (!(await db.contractor.count({ where: { id, organizationId } }))) throw new UserError("Fremdfirma nicht gefunden.");
    c = await db.contractor.update({ where: { id }, data });
  } else {
    if (await db.contractor.findFirst({ where: { organizationId, name: input.name } })) throw new UserError("Diese Fremdfirma gibt es bereits.");
    c = await db.contractor.create({ data: { ...data, organizationId } });
  }
  await audit({ organizationId, userId: actor.userId, action: id ? "contractor.updated" : "contractor.created", entity: "Contractor", entityId: c.id, details: { name: c.name } });
  return c;
}

export async function setContractorBlocked(actor: Actor, organizationId: string, id: string, blocked: boolean, reason?: string | null) {
  if (blocked && !reason) throw new UserError("Bitte die Sperre begründen.");
  const r = await db.contractor.updateMany({ where: { id, organizationId }, data: { blocked, blockReason: blocked ? reason : null } });
  if (!r.count) throw new UserError("Fremdfirma nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: blocked ? "contractor.blocked" : "contractor.unblocked", entity: "Contractor", entityId: id, details: { reason: reason || null } });
}

export async function addWorker(actor: Actor, organizationId: string, input: { contractorId: string; name: string; briefedAt?: Date | null }) {
  if (!input.name) throw new UserError("Bitte den Namen angeben.");
  if (!(await db.contractor.count({ where: { id: input.contractorId, organizationId } }))) throw new UserError("Fremdfirma nicht gefunden.");
  const w = await db.contractorWorker.create({
    data: { contractorId: input.contractorId, name: input.name, briefedAt: input.briefedAt ?? null, briefedUntil: input.briefedAt ? addMonths(input.briefedAt, BRIEFING_MONTHS) : null },
  });
  await audit({ organizationId, userId: actor.userId, action: "contractor.worker_added", entity: "ContractorWorker", entityId: w.id });
  return w;
}

export async function briefWorker(actor: Actor, organizationId: string, workerId: string, date: Date, now = new Date()) {
  if (date > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  const r = await db.contractorWorker.updateMany({ where: { id: workerId, contractor: { organizationId } }, data: { briefedAt: date, briefedUntil: addMonths(date, BRIEFING_MONTHS) } });
  if (!r.count) throw new UserError("Person nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "contractor.briefed", entity: "ContractorWorker", entityId: workerId });
}

/** Hinderungsgründe für die Arbeit einer Fremdfirma zum Zeitpunkt `at` */
export function contractorProblems(
  c: { name: string; blocked: boolean; blockReason: string | null; insuranceUntil: Date | null },
  workers: { name: string; briefedUntil: Date | null }[],
  at: Date,
): string[] {
  const p: string[] = [];
  if (c.blocked) p.push(`${c.name} ist gesperrt${c.blockReason ? `: ${c.blockReason}` : ""}.`);
  if (!c.insuranceUntil || c.insuranceUntil < at) p.push(`${c.name}: kein gültiger Haftpflichtnachweis.`);
  for (const w of workers) if (!w.briefedUntil || w.briefedUntil < at) p.push(`${w.name}: Fremdfirmeneinweisung fehlt oder ist abgelaufen.`);
  return p;
}

async function nextPermitNumber(organizationId: string, date: Date) {
  const y = date.getUTCFullYear();
  const last = await db.permit.findFirst({ where: { organizationId, number: { startsWith: `E${y}-` } }, orderBy: { number: "desc" } });
  return `E${y}-${String(last ? Number(last.number.split("-")[1]) + 1 : 1).padStart(3, "0")}`;
}

export async function requestPermit(
  actor: Actor,
  organizationId: string,
  input: { type: PermitType; siteId?: string | null; location: string; description: string; contractorId?: string | null; workerIds?: string[]; validFrom: Date; validTo: Date },
) {
  if (!input.location || !input.description) throw new UserError("Bitte Ort und Arbeiten beschreiben.");
  if (input.validTo <= input.validFrom) throw new UserError("Das Ende muss nach dem Beginn liegen.");
  if (input.validTo.getTime() - input.validFrom.getTime() > 24 * 3600 * 1000) throw new UserError("Erlaubnisscheine gelten höchstens eine Schicht (24 Stunden).");
  await assertOwned(organizationId, { siteId: input.siteId });
  const workerIds = [...new Set(input.workerIds ?? [])];
  if (input.contractorId) {
    if (!(await db.contractor.count({ where: { id: input.contractorId, organizationId } }))) throw new UserError("Fremdfirma nicht gefunden.");
    if (workerIds.length && (await db.contractorWorker.count({ where: { id: { in: workerIds }, contractorId: input.contractorId } })) !== workerIds.length) {
      throw new UserError("Ausführende gehören nicht zu dieser Fremdfirma.");
    }
  } else if (workerIds.length) throw new UserError("Ausführende können nur zusammen mit einer Fremdfirma angegeben werden.");
  const p = await db.permit.create({
    data: {
      organizationId, number: await nextPermitNumber(organizationId, input.validFrom), type: input.type, siteId: input.siteId || null, location: input.location,
      description: input.description, contractorId: input.contractorId || null, validFrom: input.validFrom, validTo: input.validTo, requestedById: actor.userId,
      workers: { create: workerIds.map((workerId) => ({ workerId })) },
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "permit.requested", entity: "Permit", entityId: p.id, details: { number: p.number } });
  return p;
}

async function loadPermit(organizationId: string, id: string) {
  const p = await db.permit.findFirst({ where: { id, organizationId }, include: { contractor: true, workers: { include: { worker: true } } } });
  if (!p) throw new UserError("Erlaubnisschein nicht gefunden.");
  return p;
}

/** Genehmigung im Vier-Augen-Prinzip; Fremdfirma muss einsatzbereit sein */
export async function decidePermit(actor: Actor, organizationId: string, id: string, approve: boolean, note?: string | null, now = new Date()) {
  const p = await loadPermit(organizationId, id);
  if (p.status !== "REQUESTED") throw new UserError("Über diesen Erlaubnisschein wurde bereits entschieden.");
  if (p.requestedById === actor.userId) throw new UserError("Vier-Augen-Prinzip: Wer beantragt hat, darf nicht selbst genehmigen.");
  if (!approve && !note) throw new UserError("Bitte die Ablehnung begründen.");
  if (approve && p.contractor) {
    const probs = contractorProblems(p.contractor, p.workers.map((w) => w.worker), p.validFrom);
    if (probs.length) throw new UserError(probs.join(" "));
  }
  await db.permit.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", approvedById: actor.userId, approvedAt: now, note: note || p.note } });
  await audit({ organizationId, userId: actor.userId, action: approve ? "permit.approved" : "permit.rejected", entity: "Permit", entityId: id, details: { note: note || null } });
}

/** Freigabe vor Ort: alle Sicherheitsmaßnahmen bestätigt, innerhalb des Gültigkeitszeitraums */
export async function activatePermit(actor: Actor, organizationId: string, id: string, checks: string[], now = new Date()) {
  const p = await loadPermit(organizationId, id);
  if (p.status !== "APPROVED") throw new UserError("Nur genehmigte Erlaubnisscheine können freigegeben werden.");
  if (now > p.validTo) throw new UserError("Der Gültigkeitszeitraum ist abgelaufen.");
  if (now.getTime() < p.validFrom.getTime() - 60 * 60 * 1000) throw new UserError("Die Freigabe vor Ort ist frühestens eine Stunde vor Beginn möglich.");
  const required = PERMIT_CHECKS[p.type];
  const missing = required.filter((c) => !checks.includes(c));
  if (missing.length) throw new UserError(`Noch nicht bestätigt: ${missing.join("; ")}.`);
  if (p.contractor) {
    const probs = contractorProblems(p.contractor, p.workers.map((w) => w.worker), now);
    if (probs.length) throw new UserError(probs.join(" "));
  }
  await db.permit.update({ where: { id }, data: { status: "ACTIVE", checks: required, activatedAt: now } });
  await audit({ organizationId, userId: actor.userId, action: "permit.activated", entity: "Permit", entityId: id });
}

/** Abschluss; bei Heißarbeiten mit Brandwache (mind. 30 Minuten nach Arbeitsende, DGUV R 100-500) */
export async function closePermit(actor: Actor, organizationId: string, id: string, fireWatchUntil?: Date | null, now = new Date()) {
  const p = await loadPermit(organizationId, id);
  if (p.status !== "ACTIVE") throw new UserError("Nur laufende Erlaubnisscheine können abgeschlossen werden.");
  if (p.type === "HOT_WORK") {
    if (!fireWatchUntil) throw new UserError("Bei Heißarbeiten bitte das Ende der Brandwache angeben.");
    if (p.activatedAt && fireWatchUntil.getTime() < p.activatedAt.getTime() + 30 * 60 * 1000) {
      throw new UserError("Die Brandwache muss mindestens 30 Minuten nach Arbeitsende andauern.");
    }
  }
  await db.permit.update({ where: { id }, data: { status: "CLOSED", closedAt: now, fireWatchUntil: fireWatchUntil ?? null } });
  await audit({ organizationId, userId: actor.userId, action: "permit.closed", entity: "Permit", entityId: id });
}
