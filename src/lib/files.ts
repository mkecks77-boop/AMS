import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { audit } from "./audit";
import type { Permission } from "./roles";
import { getStorage } from "./storage";
import { UserError, type Actor } from "./users";

export const MAX_FILE_SIZE = 15 * 1024 * 1024;

/** Erlaubte Dateitypen mit Signaturprüfung (Magic Bytes) */
const TYPES: Record<string, { ext: string[]; magic?: (b: Buffer) => boolean }> = {
  "application/pdf": { ext: ["pdf"], magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  "image/jpeg": { ext: ["jpg", "jpeg"], magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: ["png"], magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: ["webp"], magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  // Office-Dateien sind ZIP-Container
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ["docx"], magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: ["xlsx"], magic: (b) => b[0] === 0x50 && b[1] === 0x4b },
};

export const ACCEPT = Object.values(TYPES).flatMap((t) => t.ext.map((e) => `.${e}`)).join(",");

/** Ermittelt den Typ aus Endung UND Inhalt; Abweichungen werden abgelehnt. */
export function detectType(fileName: string, data: Buffer): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const entry = Object.entries(TYPES).find(([, t]) => t.ext.includes(ext));
  if (!entry) throw new UserError("Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, WEBP, DOCX und XLSX.");
  if (entry[1].magic && !entry[1].magic(data)) throw new UserError("Der Inhalt der Datei passt nicht zur Dateiendung.");
  return entry[0];
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "datei";
  const clean = base.normalize("NFC").replace(/[\u0000-\u001f"<>|:*?]/g, "_").trim();
  return (clean || "datei").slice(0, 150);
}

/** Datensatzarten, an die Dateien angehängt werden können, mit Rechten und Eigentumsprüfung */
export const ENTITY_TYPES: Record<string, { label: string; view: Permission; edit: Permission; exists: (orgId: string, id: string) => Promise<boolean>; href: (id: string) => string }> = {
  SUBSTANCE: { label: "Gefahrstoff", view: "substances.view", edit: "substances.edit", exists: async (o, id) => !!(await db.hazardousSubstance.count({ where: { id, organizationId: o } })), href: (id) => `/substances/${id}` },
  EQUIPMENT: { label: "Anlage", view: "equipment.view", edit: "equipment.manage", exists: async (o, id) => !!(await db.equipment.count({ where: { id, organizationId: o } })), href: (id) => `/equipment/${id}` },
  INCIDENT: { label: "Unfall/Ereignis", view: "incidents.view", edit: "incidents.manage", exists: async (o, id) => !!(await db.incident.count({ where: { id, organizationId: o } })), href: (id) => `/incidents/${id}` },
  WALKTHROUGH: { label: "Begehung", view: "walkthroughs.view", edit: "walkthroughs.manage", exists: async (o, id) => !!(await db.walkthrough.count({ where: { id, organizationId: o } })), href: (id) => `/walkthroughs/${id}` },
  RISK: { label: "Gefährdungsbeurteilung", view: "risk.view", edit: "risk.manage", exists: async (o, id) => !!(await db.riskAssessment.count({ where: { id, organizationId: o } })), href: (id) => `/risk/${id}` },
  CONTRACTOR: { label: "Fremdfirma", view: "contractors.view", edit: "contractors.manage", exists: async (o, id) => !!(await db.contractor.count({ where: { id, organizationId: o } })), href: (id) => `/contractors/${id}` },
  EMPLOYEE: { label: "Mitarbeiter/in (Zertifikate)", view: "trainings.view", edit: "trainings.manage", exists: async (o, id) => !!(await db.employee.count({ where: { id, organizationId: o } })), href: (id) => `/employees/${id}` },
  ACTION: { label: "Maßnahme (Nachweis)", view: "actions.view", edit: "actions.manage", exists: async (o, id) => !!(await db.action.count({ where: { id, organizationId: o } })), href: (id) => `/actions/${id}` },
};

export async function uploadAttachment(
  actor: Actor,
  organizationId: string,
  input: { entityType: string; entityId: string; fileName: string; data: Buffer },
) {
  const def = ENTITY_TYPES[input.entityType];
  if (!def) throw new UserError("Unbekannte Zuordnung.");
  if (!(await def.exists(organizationId, input.entityId))) throw new UserError(`${def.label} nicht gefunden.`);
  if (input.data.length === 0) throw new UserError("Die Datei ist leer.");
  if (input.data.length > MAX_FILE_SIZE) throw new UserError("Die Datei ist größer als 15 MB.");
  const fileName = safeFileName(input.fileName);
  const mimeType = detectType(fileName, input.data);
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  // Schlüssel ohne Originalnamen: Mandant/Zufall
  const storageKey = `${organizationId}/${randomBytes(16).toString("hex")}`;
  await getStorage().put(storageKey, input.data, mimeType);
  try {
    const a = await db.attachment.create({
      data: { organizationId, entityType: input.entityType, entityId: input.entityId, fileName, mimeType, size: input.data.length, storageKey, sha256, uploadedById: actor.userId },
    });
    await audit({ organizationId, userId: actor.userId, action: "file.uploaded", entity: "Attachment", entityId: a.id, details: { entityType: a.entityType, fileName } });
    return a;
  } catch (e) {
    await getStorage().remove(storageKey);
    throw e;
  }
}

export async function deleteAttachment(actor: Actor, organizationId: string, id: string, can: (p: Permission) => boolean) {
  const a = await db.attachment.findFirst({ where: { id, organizationId } });
  if (!a) throw new UserError("Datei nicht gefunden.");
  const def = ENTITY_TYPES[a.entityType];
  if (!def || !can(def.edit)) throw new UserError("Keine Berechtigung.");
  await db.attachment.delete({ where: { id } });
  await getStorage().remove(a.storageKey);
  await audit({ organizationId, userId: actor.userId, action: "file.deleted", entity: "Attachment", entityId: id, details: { fileName: a.fileName } });
}

/** Datei für den Download laden – nur im eigenen Unternehmen und mit Leserecht auf den Datensatz */
export async function readAttachment(organizationId: string, id: string, can: (p: Permission) => boolean) {
  const a = await db.attachment.findFirst({ where: { id, organizationId } });
  if (!a) return null;
  const def = ENTITY_TYPES[a.entityType];
  if (!def || !can(def.view)) return null;
  return { attachment: a, data: await getStorage().get(a.storageKey) };
}

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
