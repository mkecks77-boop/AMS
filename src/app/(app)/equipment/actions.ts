"use server";

import type { EquipmentStatus, InspectionResult, InspectorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { INSPECTOR_TYPE_LABELS } from "@/lib/catalog";
import {
  addObligation as add,
  changeEquipmentStatus,
  recordInspection as record,
  RESULT_LABELS,
  saveEquipment as save,
  setObligationActive,
  STATUS_LABELS,
} from "@/lib/equipment";
import { bool, int, str, type FormState } from "@/lib/form";

const isKey = <T extends string>(map: Record<T, string>, v: string): v is T => v in map;

export async function saveEquipment(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("equipment.manage");
  const id = str(fd, "id") || null;
  const yearBuilt = int(fd, "yearBuilt");
  let newId = "";
  const result = await run(async () => {
    if (Number.isNaN(yearBuilt)) return { error: "Bitte ein gültiges Baujahr angeben." };
    const eq = await save(actorOf(ctx), ctx.organization.id, id, {
      inventoryNumber: str(fd, "inventoryNumber"),
      name: str(fd, "name"),
      category: str(fd, "category"),
      manufacturer: str(fd, "manufacturer"),
      model: str(fd, "model"),
      serialNumber: str(fd, "serialNumber"),
      yearBuilt,
      ceMarked: bool(fd, "ceMarked"),
      hasDeclarationOfConformity: bool(fd, "hasDeclarationOfConformity"),
      hasOperatingManual: bool(fd, "hasOperatingManual"),
      commissionedAt: parseDate(str(fd, "commissionedAt")),
      siteId: str(fd, "siteId"),
      location: str(fd, "location"),
      responsibleId: str(fd, "responsibleId"),
      notes: str(fd, "notes"),
    });
    newId = eq.id;
    revalidatePath("/equipment");
  });
  if (!result.error && !id) redirect(`/equipment/${newId}`);
  return result;
}

export async function addObligation(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("equipment.manage");
  const equipmentId = str(fd, "equipmentId");
  const type = str(fd, "inspectorType");
  const interval = int(fd, "intervalMonths");
  return run(async () => {
    if (!isKey(INSPECTOR_TYPE_LABELS, type)) return { error: "Bitte die Art des Prüfers wählen." };
    await add(actorOf(ctx), ctx.organization.id, {
      equipmentId,
      title: str(fd, "title"),
      legalBasis: str(fd, "legalBasis"),
      intervalMonths: interval ?? NaN,
      inspectorType: type as InspectorType,
      firstDueAt: parseDate(str(fd, "firstDueAt")),
    });
    revalidatePath(`/equipment/${equipmentId}`);
  }, "Prüfpflicht hinzugefügt.");
}

export async function recordInspection(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("inspections.record");
  const result = str(fd, "result");
  const performedAt = parseDate(str(fd, "performedAt"));
  return run(async () => {
    if (!isKey(RESULT_LABELS, result)) return { error: "Bitte ein Ergebnis wählen." };
    if (!performedAt) return { error: "Bitte das Prüfdatum angeben." };
    await record(actorOf(ctx), ctx.organization.id, {
      obligationId: str(fd, "obligationId"),
      performedAt,
      inspectorName: str(fd, "inspectorName"),
      result: result as InspectionResult,
      notes: str(fd, "notes"),
    });
    revalidatePath(`/equipment/${str(fd, "equipmentId")}`);
  }, result === "FAILED" ? "Prüfung erfasst. Die Anlage wurde gesperrt." : "Prüfung erfasst.");
}

export async function changeStatus(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("equipment.manage");
  const status = str(fd, "status");
  const id = str(fd, "equipmentId");
  return run(async () => {
    if (!isKey(STATUS_LABELS, status)) return { error: "Ungültiger Status." };
    await changeEquipmentStatus(actorOf(ctx), ctx.organization.id, id, status as EquipmentStatus, str(fd, "reason"));
    revalidatePath(`/equipment/${id}`);
  }, "Status geändert.");
}

export async function toggleObligation(fd: FormData) {
  const ctx = await requireOrg("equipment.manage");
  await setObligationActive(actorOf(ctx), ctx.organization.id, str(fd, "id"), str(fd, "active") === "true");
  revalidatePath(`/equipment/${str(fd, "equipmentId")}`);
}
