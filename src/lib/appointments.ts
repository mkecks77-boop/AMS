import { db } from "./db";
import { audit } from "./audit";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

/** Beauftragte und Pflichtenübertragungen mit Rechtsgrundlage */
export const APPOINTMENT_ROLES: Record<string, { label: string; legal: string; text: string }> = {
  DUTY_TRANSFER: {
    label: "Pflichtenübertragung (Unternehmerpflichten)",
    legal: "§ 13 DGUV Vorschrift 1, § 13 Abs. 2 ArbSchG",
    text: "die dem Unternehmer hinsichtlich des Arbeitsschutzes und der Unfallverhütung obliegenden Pflichten in eigener Verantwortung wahrzunehmen",
  },
  SAFETY_REP: { label: "Sicherheitsbeauftragte/r", legal: "§ 22 SGB VII, § 20 DGUV Vorschrift 1", text: "den Unternehmer bei der Durchführung der Maßnahmen zur Verhütung von Arbeitsunfällen und Berufskrankheiten zu unterstützen" },
  FIRE_OFFICER: { label: "Brandschutzbeauftragte/r", legal: "DGUV Information 205-003", text: "den Unternehmer in allen Fragen des betrieblichen Brandschutzes zu beraten und zu unterstützen" },
  HAZMAT_TRANSPORT: { label: "Gefahrgutbeauftragte/r", legal: "GbV", text: "die Einhaltung der Vorschriften für die Beförderung gefährlicher Güter zu überwachen" },
  WASTE: { label: "Abfallbeauftragte/r", legal: "§ 59 KrWG, AbfBeauftrV", text: "die Wege des Abfalls und die Einhaltung der abfallrechtlichen Vorschriften zu überwachen" },
  LASER: { label: "Laserschutzbeauftragte/r", legal: "§ 5 OStrV, TROS Laserstrahlung", text: "den Arbeitgeber bei der Durchführung der notwendigen Schutzmaßnahmen beim Betrieb von Lasereinrichtungen zu unterstützen" },
  RADIATION: { label: "Strahlenschutzbeauftragte/r", legal: "§ 70 StrlSchG", text: "die Einhaltung der Strahlenschutzvorschriften zu gewährleisten" },
  ELECTRICAL: { label: "Verantwortliche Elektrofachkraft", legal: "DIN VDE 1000-10, DGUV V3", text: "die Fach- und Aufsichtsverantwortung für die elektrotechnischen Arbeiten wahrzunehmen" },
  OTHER: { label: "Sonstige Beauftragung", legal: "", text: "" },
};

export async function appoint(
  actor: Actor,
  organizationId: string,
  input: { employeeId: string; role: string; siteId?: string | null; scope?: string | null; appointedAt: Date; validUntil?: Date | null; signed?: boolean },
) {
  if (!(input.role in APPOINTMENT_ROLES)) throw new UserError("Unbekannte Beauftragung.");
  if (input.role === "DUTY_TRANSFER" && !input.scope) throw new UserError("Bei der Pflichtenübertragung bitte den Verantwortungsbereich angeben.");
  if (input.validUntil && input.validUntil <= input.appointedAt) throw new UserError("Das Ende muss nach dem Beginn liegen.");
  await assertOwned(organizationId, { employeeId: input.employeeId, siteId: input.siteId });
  if (!input.employeeId) throw new UserError("Bitte eine Person wählen.");
  const a = await db.appointment.create({
    data: { organizationId, employeeId: input.employeeId, role: input.role, siteId: input.siteId || null, scope: input.scope || null, appointedAt: input.appointedAt, validUntil: input.validUntil ?? null, signed: !!input.signed },
  });
  await audit({ organizationId, userId: actor.userId, action: "appointment.created", entity: "Appointment", entityId: a.id, details: { role: a.role } });
  return a;
}

export async function endAppointment(actor: Actor, organizationId: string, id: string, now = new Date()) {
  const r = await db.appointment.updateMany({ where: { id, organizationId, endedAt: null }, data: { endedAt: now } });
  if (!r.count) throw new UserError("Beauftragung nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "appointment.ended", entity: "Appointment", entityId: id });
}

export async function markSigned(actor: Actor, organizationId: string, id: string) {
  const r = await db.appointment.updateMany({ where: { id, organizationId }, data: { signed: true } });
  if (!r.count) throw new UserError("Beauftragung nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "appointment.signed", entity: "Appointment", entityId: id });
}
