import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { UserError, type Actor } from "./users";

export const PPE_CATEGORIES = ["Kopfschutz", "Augen- und Gesichtsschutz", "Gehörschutz", "Atemschutz", "Handschutz", "Fußschutz", "Schutzkleidung", "PSA gegen Absturz", "Warnkleidung", "Sonstiges"];

export const DEFAULT_PPE: { name: string; category: string; standard?: string; replaceMonths?: number; inspectionRequired?: boolean }[] = [
  { name: "Sicherheitsschuhe S3", category: "Fußschutz", standard: "DIN EN ISO 20345", replaceMonths: 12 },
  { name: "Schutzbrille", category: "Augen- und Gesichtsschutz", standard: "DIN EN 166" },
  { name: "Gehörschutzstöpsel", category: "Gehörschutz", standard: "DIN EN 352-2" },
  { name: "Kapselgehörschutz", category: "Gehörschutz", standard: "DIN EN 352-1", replaceMonths: 24 },
  { name: "Schnittschutzhandschuhe", category: "Handschutz", standard: "DIN EN 388" },
  { name: "Chemikalienschutzhandschuhe (Nitril)", category: "Handschutz", standard: "DIN EN ISO 374" },
  { name: "Industrieschutzhelm", category: "Kopfschutz", standard: "DIN EN 397", replaceMonths: 48 },
  { name: "Auffanggurt mit Verbindungsmittel", category: "PSA gegen Absturz", standard: "DIN EN 361 / 355", inspectionRequired: true },
  { name: "Warnweste", category: "Warnkleidung", standard: "DIN EN ISO 20471" },
];

export async function ensureDefaultPpe(organizationId: string) {
  if (await db.ppeItem.count({ where: { organizationId } })) return;
  await db.ppeItem.createMany({ data: DEFAULT_PPE.map((p) => ({ ...p, organizationId })), skipDuplicates: true });
}

export async function addPpeItem(actor: Actor, organizationId: string, input: { name: string; category: string; standard?: string | null; replaceMonths?: number | null; inspectionRequired?: boolean }) {
  if (!input.name) throw new UserError("Bitte eine Bezeichnung angeben.");
  if (!PPE_CATEGORIES.includes(input.category)) throw new UserError("Unbekannte Kategorie.");
  if (input.replaceMonths != null && (!Number.isInteger(input.replaceMonths) || input.replaceMonths < 1)) throw new UserError("Ungültige Gebrauchsdauer.");
  if (await db.ppeItem.findFirst({ where: { organizationId, name: input.name } })) throw new UserError("Diese PSA gibt es bereits.");
  const p = await db.ppeItem.create({ data: { ...input, standard: input.standard || null, replaceMonths: input.replaceMonths ?? null, inspectionRequired: !!input.inspectionRequired, organizationId } });
  await audit({ organizationId, userId: actor.userId, action: "ppe.item_created", entity: "PpeItem", entityId: p.id, details: { name: p.name } });
  return p;
}

export async function issuePpe(
  actor: Actor,
  organizationId: string,
  input: { itemId: string; employeeId: string; size?: string | null; quantity?: number; issuedAt: Date; receiptSigned?: boolean },
  now = new Date(),
) {
  if (input.issuedAt > now) throw new UserError("Das Ausgabedatum darf nicht in der Zukunft liegen.");
  const q = input.quantity ?? 1;
  if (!Number.isInteger(q) || q < 1) throw new UserError("Ungültige Menge.");
  const [item, employee] = await Promise.all([
    db.ppeItem.findFirst({ where: { id: input.itemId, organizationId } }),
    db.employee.findFirst({ where: { id: input.employeeId, organizationId } }),
  ]);
  if (!item) throw new UserError("PSA nicht gefunden.");
  if (!employee) throw new UserError("Mitarbeiter/in nicht gefunden.");
  const issue = await db.ppeIssue.create({
    data: {
      itemId: item.id,
      employeeId: employee.id,
      size: input.size || null,
      quantity: q,
      issuedAt: input.issuedAt,
      replaceDue: item.replaceMonths ? addMonths(input.issuedAt, item.replaceMonths) : null,
      receiptSigned: !!input.receiptSigned,
    },
  });
  await audit({ organizationId, userId: actor.userId, action: "ppe.issued", entity: "PpeIssue", entityId: issue.id, details: { item: item.name, employee: `${employee.firstName} ${employee.lastName}` } });
  return issue;
}

export async function returnPpe(actor: Actor, organizationId: string, issueId: string, now = new Date()) {
  const r = await db.ppeIssue.updateMany({ where: { id: issueId, returnedAt: null, item: { organizationId } }, data: { returnedAt: now } });
  if (!r.count) throw new UserError("Ausgabe nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "ppe.returned", entity: "PpeIssue", entityId: issueId });
}

export async function confirmReceipt(actor: Actor, organizationId: string, issueId: string) {
  const r = await db.ppeIssue.updateMany({ where: { id: issueId, item: { organizationId } }, data: { receiptSigned: true } });
  if (!r.count) throw new UserError("Ausgabe nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "ppe.receipt", entity: "PpeIssue", entityId: issueId });
}
