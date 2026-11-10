import { db } from "./db";
import { audit } from "./audit";
import { UserError, type Actor } from "./users";

/** Aufgabenfelder der Fachkraft für Arbeitssicherheit (DGUV Vorschrift 2, Anlage 2/3) */
export const TIME_CATEGORIES: Record<string, string> = {
  RISK: "Gefährdungsbeurteilung",
  WALK: "Begehungen / Arbeitsplatzbesichtigungen",
  ADVICE: "Beratung Unternehmer / Führungskräfte",
  DESIGN: "Gestaltung Arbeitsplätze und Abläufe",
  INCIDENT: "Unfalluntersuchung",
  TRAINING: "Unterweisungen / Schulungen",
  ASA: "Arbeitsschutzausschuss",
  SUBSTANCES: "Gefahrstoffe",
  DOCS: "Dokumentation, Berichte",
  SPECIFIC: "Betriebsspezifische Betreuung (Anlässe, Projekte)",
  OWN_TRAINING: "Eigene Fortbildung",
  OTHER: "Sonstiges",
};

export async function logTime(actor: Actor, organizationId: string, input: { date: Date; minutes: number; category: string; description?: string | null }, now = new Date()) {
  if (!(input.category in TIME_CATEGORIES)) throw new UserError("Bitte ein Aufgabenfeld wählen.");
  if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 24 * 60) throw new UserError("Die Dauer muss zwischen 5 Minuten und 24 Stunden liegen.");
  if (input.date > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  const e = await db.timeEntry.create({ data: { organizationId, userId: actor.userId, date: input.date, minutes: input.minutes, category: input.category, description: input.description || null } });
  await audit({ organizationId, userId: actor.userId, action: "time.logged", entity: "TimeEntry", entityId: e.id, details: { minutes: e.minutes, category: e.category } });
  return e;
}

export async function deleteTime(actor: Actor, organizationId: string, id: string) {
  // nur eigene Einträge
  const r = await db.timeEntry.deleteMany({ where: { id, organizationId, userId: actor.userId } });
  if (!r.count) throw new UserError("Eintrag nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "time.deleted", entity: "TimeEntry", entityId: id });
}

/** Summen je Aufgabenfeld für ein Jahr (alle Sifa des Unternehmens) */
export async function timeSummary(organizationId: string, year: number) {
  const entries = await db.timeEntry.findMany({
    where: { organizationId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
  });
  const byCategory = Object.keys(TIME_CATEGORIES).map((k) => ({ category: k, minutes: entries.filter((e) => e.category === k).reduce((s, e) => s + e.minutes, 0) })).filter((c) => c.minutes > 0);
  const total = entries.reduce((s, e) => s + e.minutes, 0);
  return { total, byCategory };
}

export function formatHours(minutes: number) {
  return `${(minutes / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 })} h`;
}
