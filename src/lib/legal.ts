import type { ComplianceStatus } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  NOT_EVALUATED: "nicht bewertet",
  FULFILLED: "erfüllt",
  PARTIAL: "teilweise erfüllt",
  NOT_FULFILLED: "nicht erfüllt",
  NOT_RELEVANT: "nicht relevant",
};

export const REVIEW_MONTHS = 12;

/** Grundbestand Arbeitsschutzrecht – vom Unternehmen anzupassen */
export const DEFAULT_LEGAL: [string, string, string, string][] = [
  ["Organisation", "ArbSchG", "§ 3", "Geeignete Organisation des Arbeitsschutzes und Bereitstellung der erforderlichen Mittel"],
  ["Organisation", "ArbSchG", "§§ 5, 6", "Gefährdungsbeurteilung für alle Tätigkeiten durchführen und dokumentieren (inkl. psychischer Belastung)"],
  ["Organisation", "ArbSchG", "§ 12", "Beschäftigte ausreichend und angemessen unterweisen (vor Aufnahme der Tätigkeit, regelmäßig)"],
  ["Organisation", "ASiG / DGUV V2", "§§ 2, 5", "Betriebsarzt und Fachkraft für Arbeitssicherheit schriftlich bestellen"],
  ["Organisation", "ASiG", "§ 11", "Arbeitsschutzausschuss bilden, mindestens vierteljährlich tagen (> 20 Beschäftigte)"],
  ["Organisation", "DGUV Vorschrift 1", "§ 13", "Unternehmerpflichten schriftlich übertragen"],
  ["Organisation", "SGB VII / DGUV V1", "§ 22 / § 20", "Sicherheitsbeauftragte bestellen"],
  ["Erste Hilfe", "DGUV Vorschrift 1", "§§ 24–26", "Ersthelfer in ausreichender Zahl, Erste-Hilfe-Material, Dokumentation (Verbandbuch)"],
  ["Erste Hilfe", "SGB VII", "§ 193", "Meldepflichtige Unfälle binnen 3 Tagen anzeigen"],
  ["Arbeitsstätte", "ArbStättV / ASR A2.3", "§ 4", "Flucht- und Rettungswege freihalten, Flucht- und Rettungsplan"],
  ["Brandschutz", "ArbStättV / ASR A2.2", "Anhang 2.2", "Feuerlöscher, Brandschutzhelfer (5 %), Unterweisung"],
  ["Arbeitsmittel", "BetrSichV", "§§ 3, 14", "Arbeitsmittel beurteilen, Prüfungen festlegen und durchführen lassen"],
  ["Arbeitsmittel", "BetrSichV", "§ 12", "Betriebsanweisungen und Unterweisung für Arbeitsmittel"],
  ["Elektrik", "DGUV Vorschrift 3", "§ 5", "Elektrische Anlagen und Betriebsmittel prüfen"],
  ["Gefahrstoffe", "GefStoffV", "§ 6", "Gefährdungsbeurteilung und Gefahrstoffverzeichnis, Substitutionsprüfung"],
  ["Gefahrstoffe", "GefStoffV", "§ 14", "Betriebsanweisung und Unterweisung für Gefahrstoffe"],
  ["Gefahrstoffe", "TRGS 510", "", "Lagerung von Gefahrstoffen in ortsbeweglichen Behältern"],
  ["Gesundheit", "ArbMedVV", "§§ 3–5", "Arbeitsmedizinische Pflicht- und Angebotsvorsorge veranlassen, Vorsorgekartei führen"],
  ["Gesundheit", "LärmVibrationsArbSchV", "§§ 6–8", "Lärmbereiche kennzeichnen, Gehörschutz bereitstellen"],
  ["Personen", "JArbSchG", "§ 29", "Jugendliche vor Beginn und mindestens halbjährlich unterweisen"],
  ["Personen", "MuSchG", "§ 10", "Anlassunabhängige Gefährdungsbeurteilung für Schwangere/Stillende"],
  ["PSA", "PSA-BV", "§§ 2, 3", "Geeignete PSA bereitstellen, Benutzung unterweisen"],
  ["Fremdfirmen", "ArbSchG / DGUV V1", "§ 8 / § 5", "Zusammenarbeit mit Fremdfirmen abstimmen, Koordinator bei gegenseitiger Gefährdung"],
];

export async function ensureDefaultLegal(organizationId: string) {
  if (await db.legalRequirement.count({ where: { organizationId } })) return;
  await db.legalRequirement.createMany({ data: DEFAULT_LEGAL.map(([area, law, reference, obligation]) => ({ organizationId, area, law, reference: reference || null, obligation })) });
}

export async function addLegal(actor: Actor, organizationId: string, input: { area: string; law: string; reference?: string | null; obligation: string }) {
  if (!input.area || !input.law || !input.obligation) throw new UserError("Bitte Bereich, Vorschrift und Pflicht angeben.");
  const l = await db.legalRequirement.create({ data: { organizationId, area: input.area, law: input.law, reference: input.reference || null, obligation: input.obligation } });
  await audit({ organizationId, userId: actor.userId, action: "legal.created", entity: "LegalRequirement", entityId: l.id, details: { law: l.law } });
  return l;
}

/** Bewertung der Einhaltung; „erfüllt“ braucht einen Nachweis, „nicht/teilweise erfüllt“ eine Maßnahme (separat) */
export async function evaluateLegal(
  actor: Actor,
  organizationId: string,
  id: string,
  input: { status: ComplianceStatus; evidence?: string | null; responsibleId?: string | null },
  now = new Date(),
) {
  const l = await db.legalRequirement.findFirst({ where: { id, organizationId } });
  if (!l) throw new UserError("Anforderung nicht gefunden.");
  if (input.status === "FULFILLED" && !input.evidence) throw new UserError("Bitte den Nachweis angeben (z. B. „GBU Drehmaschine vom …“).");
  await assertOwned(organizationId, { employeeId: input.responsibleId });
  const evaluated = input.status !== "NOT_EVALUATED";
  await db.legalRequirement.update({
    where: { id },
    data: {
      status: input.status,
      evidence: input.evidence || null,
      responsibleId: input.responsibleId || null,
      evaluatedAt: evaluated ? now : null,
      reviewDue: evaluated && input.status !== "NOT_RELEVANT" ? addMonths(now, REVIEW_MONTHS) : null,
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "legal.evaluated", entity: "LegalRequirement", entityId: id, details: { status: input.status } });
}

export function complianceRateOf(items: { status: ComplianceStatus }[]): number | null {
  const relevant = items.filter((i) => i.status !== "NOT_RELEVANT" && i.status !== "NOT_EVALUATED");
  if (!relevant.length) return null;
  const score = relevant.reduce((s, i) => s + (i.status === "FULFILLED" ? 1 : i.status === "PARTIAL" ? 0.5 : 0), 0);
  return Math.round((score / relevant.length) * 100);
}
