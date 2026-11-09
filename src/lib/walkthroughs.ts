import type { AnswerResult } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const RESULT_LABELS: Record<AnswerResult, string> = { OK: "in Ordnung", DEFECT: "Mangel", NA: "nicht zutreffend" };

/** Erfüllungsgrad in Prozent: i. O. / (i. O. + Mängel) */
export function complianceRate(answers: { result: AnswerResult }[]): number | null {
  const ok = answers.filter((a) => a.result === "OK").length;
  const defects = answers.filter((a) => a.result === "DEFECT").length;
  return ok + defects === 0 ? null : Math.round((ok / (ok + defects)) * 100);
}

/** Standard-Checklisten, die jedem Unternehmen beim ersten Aufruf angelegt werden */
export const DEFAULT_TEMPLATES: { title: string; description: string; items: [string, string][] }[] = [
  {
    title: "Allgemeine Betriebsbegehung",
    description: "Grundcheckliste für Produktion und Werkstatt",
    items: [
      ["Verkehrs- und Fluchtwege", "Verkehrswege frei, ausreichend breit und gekennzeichnet"],
      ["Verkehrs- und Fluchtwege", "Fluchtwege und Notausgänge frei, Türen leicht zu öffnen"],
      ["Verkehrs- und Fluchtwege", "Flucht- und Rettungsplan aktuell und ausgehängt"],
      ["Brandschutz", "Feuerlöscher vorhanden, zugänglich und geprüft"],
      ["Brandschutz", "Brandschutztüren nicht verkeilt, schließen selbsttätig"],
      ["Erste Hilfe", "Verbandkasten vollständig, Ersthelfer bekannt (Aushang)"],
      ["Erste Hilfe", "Augenspülflasche / Notdusche vorhanden, wo erforderlich"],
      ["Arbeitsmittel", "Schutzeinrichtungen an Maschinen vorhanden und wirksam"],
      ["Arbeitsmittel", "Prüfplaketten aktuell (Leitern, elektrische Betriebsmittel)"],
      ["Arbeitsmittel", "Betriebsanweisungen an den Maschinen ausgehängt"],
      ["Gefahrstoffe", "Gebinde gekennzeichnet, keine Lebensmittelbehälter"],
      ["Gefahrstoffe", "Lagerung nach Lagerklassen, Auffangwannen vorhanden"],
      ["Elektrik", "Keine beschädigten Kabel, Stecker, Verteiler"],
      ["PSA", "Erforderliche PSA vorhanden und wird getragen"],
      ["Ordnung", "Ordnung und Sauberkeit, keine Stolperstellen"],
      ["Lagerung", "Regale standsicher, Belastungsschilder vorhanden, keine Schäden"],
    ],
  },
  {
    title: "Büro- und Bildschirmarbeitsplätze",
    description: "Nach ArbStättV Anhang 6",
    items: [
      ["Bildschirmarbeitsplatz", "Bildschirm blendfrei aufgestellt, Oberkante in Augenhöhe oder darunter"],
      ["Bildschirmarbeitsplatz", "Bürostuhl höhenverstellbar, Rückenlehne einstellbar"],
      ["Bildschirmarbeitsplatz", "Ausreichende Bewegungsfläche, Beinfreiheit"],
      ["Raum", "Beleuchtung ausreichend, Sonnenschutz vorhanden"],
      ["Raum", "Raumtemperatur und Lüftung angemessen"],
      ["Elektrik", "Keine Kabel in Laufwegen, Steckdosenleisten nicht hintereinander gesteckt"],
      ["Organisation", "Angebotsvorsorge Bildschirmarbeit (G37) angeboten"],
    ],
  },
];

export async function ensureDefaultTemplates(organizationId: string) {
  if (await db.checklistTemplate.count({ where: { organizationId } })) return;
  for (const t of DEFAULT_TEMPLATES) {
    await db.checklistTemplate.create({
      data: {
        organizationId,
        title: t.title,
        description: t.description,
        items: { create: t.items.map(([section, text], i) => ({ section, text, sortOrder: i })) },
      },
    });
  }
}

export async function createTemplate(actor: Actor, organizationId: string, input: { title: string; description?: string | null; itemsText: string }) {
  if (!input.title) throw new UserError("Bitte einen Titel angeben.");
  // Format je Zeile: "Abschnitt: Prüfpunkt" (ohne Abschnitt → "Allgemein")
  const items = input.itemsText.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const idx = l.indexOf(":");
    return idx > 0 ? { section: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim(), sortOrder: i } : { section: "Allgemein", text: l, sortOrder: i };
  });
  if (items.length === 0) throw new UserError("Bitte mindestens einen Prüfpunkt angeben.");
  if (await db.checklistTemplate.findFirst({ where: { organizationId, title: input.title } })) throw new UserError("Eine Checkliste mit diesem Titel gibt es bereits.");
  const t = await db.checklistTemplate.create({ data: { organizationId, title: input.title, description: input.description || null, items: { create: items } } });
  await audit({ organizationId, userId: actor.userId, action: "checklist.created", entity: "ChecklistTemplate", entityId: t.id, details: { title: t.title } });
  return t;
}

export async function planWalkthrough(
  actor: Actor,
  organizationId: string,
  input: { templateId: string; siteId?: string | null; area?: string | null; plannedAt: Date; auditor: string; participants?: string | null },
) {
  if (!input.auditor) throw new UserError("Bitte angeben, wer die Begehung durchführt.");
  if (!(await db.checklistTemplate.count({ where: { id: input.templateId, organizationId } }))) throw new UserError("Checkliste nicht gefunden.");
  await assertOwned(organizationId, { siteId: input.siteId });
  const w = await db.walkthrough.create({
    data: { organizationId, templateId: input.templateId, siteId: input.siteId || null, area: input.area || null, plannedAt: input.plannedAt, auditor: input.auditor, participants: input.participants || null },
  });
  await audit({ organizationId, userId: actor.userId, action: "walkthrough.planned", entity: "Walkthrough", entityId: w.id });
  return w;
}

/**
 * Ergebnisse speichern; mit complete=true wird die Begehung abgeschlossen – dann müssen alle Punkte
 * beantwortet und Mängel beschrieben sein.
 */
export async function saveAnswers(
  actor: Actor,
  organizationId: string,
  walkthroughId: string,
  answers: { itemId: string; result: AnswerResult; note?: string | null }[],
  opts: { complete?: boolean; summary?: string | null; performedAt?: Date } = {},
) {
  const w = await db.walkthrough.findFirst({ where: { id: walkthroughId, organizationId }, include: { template: { include: { items: true } } } });
  if (!w) throw new UserError("Begehung nicht gefunden.");
  if (w.status === "DONE") throw new UserError("Die Begehung ist bereits abgeschlossen.");
  const itemIds = new Set(w.template.items.map((i) => i.id));
  if (answers.some((a) => !itemIds.has(a.itemId))) throw new UserError("Unbekannter Prüfpunkt.");
  if (opts.complete) {
    if (answers.length !== itemIds.size) throw new UserError("Bitte alle Prüfpunkte beantworten.");
    const missing = answers.filter((a) => a.result === "DEFECT" && !a.note);
    if (missing.length) throw new UserError("Bitte jeden Mangel kurz beschreiben.");
  }
  await db.$transaction([
    ...answers.map((a) =>
      db.walkthroughAnswer.upsert({
        where: { walkthroughId_itemId: { walkthroughId, itemId: a.itemId } },
        create: { walkthroughId, itemId: a.itemId, result: a.result, note: a.note || null },
        update: { result: a.result, note: a.note || null },
      }),
    ),
    db.walkthrough.update({
      where: { id: walkthroughId },
      data: { summary: opts.summary ?? w.summary, ...(opts.complete ? { status: "DONE", performedAt: opts.performedAt ?? new Date() } : {}) },
    }),
  ]);
  await audit({ organizationId, userId: actor.userId, action: opts.complete ? "walkthrough.completed" : "walkthrough.saved", entity: "Walkthrough", entityId: walkthroughId });
}
