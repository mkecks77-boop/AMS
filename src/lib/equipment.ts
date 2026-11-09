import { Prisma, type EquipmentStatus, type InspectionResult, type InspectorType } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { assertOwned } from "./masterdata";
import { UserError, type Actor } from "./users";

export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: "in Betrieb",
  LOCKED: "gesperrt",
  REPAIR: "in Reparatur",
  DECOMMISSIONED: "stillgelegt",
  SCRAPPED: "verschrottet",
};

export const RESULT_LABELS: Record<InspectionResult, string> = {
  PASSED: "ohne Mängel",
  DEFECTS: "Mängel – Weiterbetrieb zulässig",
  FAILED: "nicht bestanden – Sperre",
};

/** Bei diesen Status ruhen die Prüffristen (keine Fälligkeit im Kalender). */
export const INACTIVE_STATUSES: EquipmentStatus[] = ["DECOMMISSIONED", "SCRAPPED"];

export interface EquipmentInput {
  inventoryNumber: string;
  name: string;
  category: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  yearBuilt?: number | null;
  ceMarked?: boolean;
  hasDeclarationOfConformity?: boolean;
  hasOperatingManual?: boolean;
  commissionedAt?: Date | null;
  siteId?: string | null;
  location?: string | null;
  responsibleId?: string | null;
  notes?: string | null;
}

function clean(i: EquipmentInput) {
  if (!i.inventoryNumber || !i.name || !i.category) {
    throw new UserError("Inventarnummer, Bezeichnung und Kategorie sind Pflichtfelder.");
  }
  const year = new Date().getUTCFullYear();
  if (i.yearBuilt != null && (i.yearBuilt < 1900 || i.yearBuilt > year)) {
    throw new UserError("Bitte ein gültiges Baujahr angeben.");
  }
  return {
    inventoryNumber: i.inventoryNumber,
    name: i.name,
    category: i.category,
    manufacturer: i.manufacturer || null,
    model: i.model || null,
    serialNumber: i.serialNumber || null,
    yearBuilt: i.yearBuilt ?? null,
    ceMarked: !!i.ceMarked,
    hasDeclarationOfConformity: !!i.hasDeclarationOfConformity,
    hasOperatingManual: !!i.hasOperatingManual,
    commissionedAt: i.commissionedAt ?? null,
    siteId: i.siteId || null,
    location: i.location || null,
    responsibleId: i.responsibleId || null,
    notes: i.notes || null,
  };
}

export async function saveEquipment(actor: Actor, organizationId: string, id: string | null, input: EquipmentInput) {
  const data = clean(input);
  await assertOwned(organizationId, { siteId: data.siteId, employeeId: data.responsibleId });
  const dup = (e: unknown): never => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new UserError("Diese Inventarnummer ist bereits vergeben.");
    }
    throw e;
  };
  let eq;
  if (id) {
    if (!(await db.equipment.count({ where: { id, organizationId } }))) throw new UserError("Anlage nicht gefunden.");
    eq = await db.equipment.update({ where: { id }, data }).catch(dup);
  } else {
    eq = await db.equipment.create({ data: { ...data, organizationId } }).catch(dup);
  }
  await audit({
    organizationId,
    userId: actor.userId,
    action: id ? "equipment.updated" : "equipment.created",
    entity: "Equipment",
    entityId: eq.id,
    details: { inventoryNumber: eq.inventoryNumber, name: eq.name },
  });
  return eq;
}

export async function changeEquipmentStatus(
  actor: Actor,
  organizationId: string,
  equipmentId: string,
  to: EquipmentStatus,
  reason?: string | null,
) {
  const eq = await db.equipment.findFirst({ where: { id: equipmentId, organizationId } });
  if (!eq) throw new UserError("Anlage nicht gefunden.");
  if (eq.status === to) return eq;
  if (eq.status === "SCRAPPED") throw new UserError("Verschrottete Anlagen können nicht mehr geändert werden.");
  if (eq.status === "LOCKED" && to === "ACTIVE" && !reason) {
    throw new UserError("Bitte begründen, warum die Sperre aufgehoben wird (z. B. Mangel behoben, Nachprüfung bestanden).");
  }
  const [updated] = await db.$transaction([
    db.equipment.update({ where: { id: eq.id }, data: { status: to } }),
    db.equipmentStatusChange.create({
      data: { equipmentId: eq.id, from: eq.status, to, reason: reason || null, userId: actor.userId },
    }),
  ]);
  await audit({
    organizationId,
    userId: actor.userId,
    action: "equipment.status_changed",
    entity: "Equipment",
    entityId: eq.id,
    details: { from: eq.status, to, reason: reason || null },
  });
  return updated;
}

export async function addObligation(
  actor: Actor,
  organizationId: string,
  input: {
    equipmentId: string;
    title: string;
    legalBasis?: string | null;
    intervalMonths: number;
    inspectorType: InspectorType;
    /** erste Fälligkeit; Standard: heute + Intervall */
    firstDueAt?: Date | null;
  },
) {
  if (!input.title) throw new UserError("Bitte die Prüfart angeben.");
  if (!Number.isInteger(input.intervalMonths) || input.intervalMonths < 1 || input.intervalMonths > 120) {
    throw new UserError("Das Intervall muss zwischen 1 und 120 Monaten liegen.");
  }
  const eq = await db.equipment.findFirst({ where: { id: input.equipmentId, organizationId } });
  if (!eq) throw new UserError("Anlage nicht gefunden.");
  const ob = await db.inspectionObligation.create({
    data: {
      organizationId,
      equipmentId: eq.id,
      title: input.title,
      legalBasis: input.legalBasis || null,
      intervalMonths: input.intervalMonths,
      inspectorType: input.inspectorType,
      nextDueAt: input.firstDueAt ?? addMonths(new Date(), input.intervalMonths),
    },
  });
  await audit({
    organizationId,
    userId: actor.userId,
    action: "obligation.created",
    entity: "InspectionObligation",
    entityId: ob.id,
    details: { equipment: eq.inventoryNumber, title: ob.title, intervalMonths: ob.intervalMonths },
  });
  return ob;
}

export async function setObligationActive(actor: Actor, organizationId: string, id: string, active: boolean) {
  const r = await db.inspectionObligation.updateMany({ where: { id, organizationId }, data: { active } });
  if (r.count === 0) throw new UserError("Prüfpflicht nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "obligation.updated", entity: "InspectionObligation", entityId: id, details: { active } });
}

/**
 * Prüfung erfassen. Nächste Fälligkeit = Prüfdatum + Intervall.
 * „Nicht bestanden“ sperrt die Anlage automatisch.
 */
export async function recordInspection(
  actor: Actor,
  organizationId: string,
  input: {
    obligationId: string;
    performedAt: Date;
    inspectorName: string;
    result: InspectionResult;
    notes?: string | null;
  },
  now = new Date(),
) {
  if (!input.inspectorName) throw new UserError("Bitte den Prüfer / die Prüferin angeben.");
  if (input.performedAt > now) throw new UserError("Das Prüfdatum darf nicht in der Zukunft liegen.");
  if (input.result !== "PASSED" && !input.notes) throw new UserError("Bitte die Mängel beschreiben.");

  const ob = await db.inspectionObligation.findFirst({
    where: { id: input.obligationId, organizationId },
    include: { equipment: true },
  });
  if (!ob) throw new UserError("Prüfpflicht nicht gefunden.");
  if (ob.equipment.status === "SCRAPPED") throw new UserError("Die Anlage ist verschrottet.");

  const nextDueAt = addMonths(input.performedAt, ob.intervalMonths);
  const newer = ob.lastInspectedAt && ob.lastInspectedAt > input.performedAt;

  const inspection = await db.$transaction(async (tx) => {
    const created = await tx.inspection.create({
      data: {
        obligationId: ob.id,
        performedAt: input.performedAt,
        inspectorName: input.inspectorName,
        result: input.result,
        notes: input.notes || null,
        nextDueAt,
        userId: actor.userId,
      },
    });
    // Nachträglich erfasste ältere Prüfungen verschieben die Fälligkeit nicht
    if (!newer) {
      await tx.inspectionObligation.update({
        where: { id: ob.id },
        data: { lastInspectedAt: input.performedAt, nextDueAt },
      });
    }
    if (input.result === "FAILED" && ob.equipment.status !== "LOCKED") {
      await tx.equipment.update({ where: { id: ob.equipmentId }, data: { status: "LOCKED" } });
      await tx.equipmentStatusChange.create({
        data: {
          equipmentId: ob.equipmentId,
          from: ob.equipment.status,
          to: "LOCKED",
          reason: `Prüfung „${ob.title}“ nicht bestanden`,
          userId: actor.userId,
        },
      });
    }
    return created;
  });

  await audit({
    organizationId,
    userId: actor.userId,
    action: "inspection.recorded",
    entity: "Inspection",
    entityId: inspection.id,
    details: { equipment: ob.equipment.inventoryNumber, title: ob.title, result: input.result },
  });
  return inspection;
}
