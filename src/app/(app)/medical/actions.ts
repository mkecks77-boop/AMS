"use server";

import type { MedicalOutcome } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { MEDICAL_KIND_LABELS, recordMedical, setMedicalRequirements } from "@/lib/medical";
import { bool, int, str, type FormState } from "@/lib/form";
import type { MedicalKind } from "@prisma/client";

export async function record(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("medical.manage");
  const date = parseDate(str(fd, "date"));
  return run(async () => {
    if (!date) return { error: "Bitte das Datum angeben." };
    await recordMedical(actorOf(ctx), ctx.organization.id, { typeId: str(fd, "typeId"), employeeId: str(fd, "employeeId"), date, outcome: (str(fd, "outcome") === "DECLINED" ? "DECLINED" : "DONE") as MedicalOutcome });
    revalidatePath("/medical");
  }, "Erfasst.");
}

export async function requirements(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("medical.manage");
  return run(async () => {
    await setMedicalRequirements(actorOf(ctx), ctx.organization.id, str(fd, "typeId"), { allEmployees: bool(fd, "allEmployees"), departmentIds: fd.getAll("departmentIds").map(String) });
    revalidatePath("/medical");
  });
}

export async function addType(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("medical.manage");
  const kind = str(fd, "kind");
  const interval = int(fd, "intervalMonths");
  if (!str(fd, "name")) return { error: "Bitte einen Namen angeben." };
  if (!interval || interval < 1) return { error: "Ungültiges Intervall." };
  if (await db.medicalCheckType.findFirst({ where: { organizationId: ctx.organization.id, name: str(fd, "name") } })) return { error: "Diesen Anlass gibt es bereits." };
  const t = await db.medicalCheckType.create({ data: { organizationId: ctx.organization.id, name: str(fd, "name"), kind: (kind in MEDICAL_KIND_LABELS ? kind : "OFFER") as MedicalKind, reason: str(fd, "reason") || null, intervalMonths: interval } });
  await audit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "medical.type_created", entity: "MedicalCheckType", entityId: t.id });
  revalidatePath("/medical");
  return { message: "Angelegt." };
}
