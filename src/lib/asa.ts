import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { UserError, type Actor } from "./users";

/** § 11 ASiG: Der Arbeitsschutzausschuss tritt mindestens einmal vierteljährlich zusammen. */
export const ASA_INTERVAL_MONTHS = 3;

export function nextAsaDue(lastDone: Date | null, now = new Date()): Date {
  return lastDone ? addMonths(lastDone, ASA_INTERVAL_MONTHS) : now;
}

/** Tagesordnung mit aktuellen Kennzahlen vorbereiten */
export async function suggestedAgenda(organizationId: string, now = new Date()) {
  const last = await db.asaMeeting.findFirst({ where: { organizationId, status: "DONE" }, orderBy: { date: "desc" } });
  const since = last?.date ?? addMonths(now, -3);
  const [accidents, nearMisses, openActions, overdueActions, newSubstances] = await Promise.all([
    db.incident.count({ where: { organizationId, type: "ACCIDENT", occurredAt: { gte: since } } }),
    db.incident.count({ where: { organizationId, type: "NEAR_MISS", occurredAt: { gte: since } } }),
    db.action.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.action.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
    db.hazardousSubstance.count({ where: { organizationId, createdAt: { gte: since } } }),
  ]);
  return [
    "1. Begrüßung, Feststellung der Teilnehmenden, Genehmigung des letzten Protokolls",
    "2. Stand der Maßnahmen aus der letzten Sitzung",
    `3. Unfallgeschehen seit der letzten Sitzung: ${accidents} Arbeitsunfälle, ${nearMisses} Beinaheunfälle`,
    `4. Offene Maßnahmen: ${openActions}, davon überfällig: ${overdueActions}`,
    "5. Bericht der Fachkraft für Arbeitssicherheit (Begehungen, Gefährdungsbeurteilungen)",
    "6. Bericht der Betriebsärztin / des Betriebsarztes",
    `7. Gefahrstoffe: ${newSubstances} neu beantragt`,
    "8. Unterweisungen und Qualifikationen",
    "9. Verschiedenes, nächster Termin",
  ].join("\n");
}

export async function saveMeeting(
  actor: Actor,
  organizationId: string,
  id: string | null,
  input: { date: Date; location?: string | null; participants?: string | null; agenda?: string; minutes?: string; done?: boolean },
  now = new Date(),
) {
  if (input.done) {
    if (input.date > now) throw new UserError("Eine Sitzung in der Zukunft kann nicht abgeschlossen werden.");
    if (!input.minutes?.trim()) throw new UserError("Bitte vor dem Abschluss das Protokoll erfassen.");
    if (!input.participants?.trim()) throw new UserError("Bitte die Teilnehmenden angeben.");
  }
  const data = {
    date: input.date,
    location: input.location || null,
    participants: input.participants || null,
    agenda: input.agenda ?? "",
    minutes: input.minutes ?? "",
    status: input.done ? ("DONE" as const) : ("PLANNED" as const),
  };
  let m;
  if (id) {
    const ex = await db.asaMeeting.findFirst({ where: { id, organizationId } });
    if (!ex) throw new UserError("Sitzung nicht gefunden.");
    if (ex.status === "DONE") throw new UserError("Abgeschlossene Sitzungen können nicht mehr geändert werden.");
    m = await db.asaMeeting.update({ where: { id }, data });
  } else {
    m = await db.asaMeeting.create({ data: { ...data, organizationId, agenda: data.agenda || (await suggestedAgenda(organizationId, now)) } });
  }
  await audit({ organizationId, userId: actor.userId, action: input.done ? "asa.completed" : id ? "asa.updated" : "asa.planned", entity: "AsaMeeting", entityId: m.id });
  return m;
}
