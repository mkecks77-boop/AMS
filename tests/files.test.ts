import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deleteAttachment, detectType, readAttachment, safeFileName, uploadAttachment } from "@/lib/files";
import { setStorage, type Storage } from "@/lib/storage";
import { can } from "@/lib/roles";
import { saveSubstance } from "@/lib/substances";
import { reportIncident } from "@/lib/incidents";
import { resetDb, twoOrgs } from "./helpers";

const mem = new Map<string, Buffer>();
const memory: Storage = {
  put: async (k, d) => void mem.set(k, d),
  get: async (k) => mem.get(k)!,
  remove: async (k) => void mem.delete(k),
};
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const sifa = (p: Parameters<typeof can>[1]) => can({ isPlatformAdmin: false, role: "SAFETY_OFFICER" }, p);
const employee = (p: Parameters<typeof can>[1]) => can({ isPlatformAdmin: false, role: "EMPLOYEE" }, p);

beforeAll(() => setStorage(memory));
beforeEach(async () => {
  await resetDb();
  mem.clear();
});
afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("Dateiprüfung", () => {
  it("Typ aus Endung und Inhalt", () => {
    expect(detectType("sdb.pdf", PDF)).toBe("application/pdf");
    expect(detectType("Foto.PNG", PNG)).toBe("image/png");
    expect(() => detectType("virus.exe", PDF)).toThrow("nicht erlaubt");
    expect(() => detectType("getarnt.pdf", Buffer.from("MZ\x90\x00"))).toThrow("passt nicht");
    expect(() => detectType("bild.html", PDF)).toThrow("nicht erlaubt");
  });
  it("Dateinamen bereinigen", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Temp\\SDB <Aceton>.pdf")).toBe("SDB _Aceton_.pdf");
    expect(safeFileName("")).toBe("datei");
  });
});

describe("Anhänge", () => {
  it("Upload, Download nur mit Recht und im eigenen Unternehmen, Löschen entfernt Datei", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const s = await saveSubstance(actor, orgA, null, { name: "Aceton", pictograms: [], signalWord: "NONE", hStatements: [], pStatements: [] });
    const a = await uploadAttachment(actor, orgA, { entityType: "SUBSTANCE", entityId: s.id, fileName: "SDB Aceton.pdf", data: PDF });
    expect(a.mimeType).toBe("application/pdf");
    expect(a.storageKey.startsWith(`${orgA}/`)).toBe(true);
    expect(a.storageKey).not.toContain("Aceton");

    expect((await readAttachment(orgA, a.id, sifa))?.data.equals(PDF)).toBe(true);
    expect(await readAttachment(orgB, a.id, sifa)).toBeNull();

    const inc = await reportIncident(actor, orgA, { type: "ACCIDENT", occurredAt: new Date("2026-01-01T00:00:00Z"), description: "x" });
    const photo = await uploadAttachment(actor, orgA, { entityType: "INCIDENT", entityId: inc.id, fileName: "unfallstelle.png", data: PNG });
    expect(await readAttachment(orgA, photo.id, employee)).toBeNull();
    expect(await readAttachment(orgA, a.id, employee)).not.toBeNull();

    await expect(deleteAttachment(actor, orgA, a.id, employee)).rejects.toThrow("Berechtigung");
    await deleteAttachment(actor, orgA, a.id, sifa);
    expect(mem.has(a.storageKey)).toBe(false);
    expect(await db.attachment.count({ where: { id: a.id } })).toBe(0);
  });

  it("Datensatz eines anderen Unternehmens, leere und zu große Dateien werden abgelehnt", async () => {
    const { actor, orgA, orgB } = await twoOrgs();
    const s = await saveSubstance(actor, orgB, null, { name: "X", pictograms: [], signalWord: "NONE", hStatements: [], pStatements: [] });
    await expect(uploadAttachment(actor, orgA, { entityType: "SUBSTANCE", entityId: s.id, fileName: "a.pdf", data: PDF })).rejects.toThrow("nicht gefunden");
    await expect(uploadAttachment(actor, orgB, { entityType: "SUBSTANCE", entityId: s.id, fileName: "a.pdf", data: Buffer.alloc(0) })).rejects.toThrow("leer");
    await expect(uploadAttachment(actor, orgB, { entityType: "SUBSTANCE", entityId: s.id, fileName: "a.pdf", data: Buffer.concat([PDF, Buffer.alloc(16 * 1024 * 1024)]) })).rejects.toThrow("15 MB");
    await expect(uploadAttachment(actor, orgB, { entityType: "NONSENSE", entityId: s.id, fileName: "a.pdf", data: PDF })).rejects.toThrow("Unbekannte");
    expect(mem.size).toBe(0);
  });
});
