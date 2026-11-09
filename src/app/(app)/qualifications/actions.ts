"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { addQualification, QUAL_CATEGORY_LABELS, removeQualification, saveQualificationType } from "@/lib/trainings";
import { int, str, type FormState } from "@/lib/form";

export async function addQual(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  const acquiredAt = parseDate(str(fd, "acquiredAt"));
  return run(async () => {
    if (!acquiredAt) return { error: "Bitte das Datum angeben." };
    await addQualification(actorOf(ctx), ctx.organization.id, {
      employeeId: str(fd, "employeeId"),
      typeId: str(fd, "typeId"),
      acquiredAt,
      validUntil: parseDate(str(fd, "validUntil")),
      issuer: str(fd, "issuer"),
    });
    revalidatePath("/qualifications");
  }, "Qualifikation erfasst.");
}

export async function addType(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  const cat = str(fd, "category");
  const months = int(fd, "validityMonths");
  return run(async () => {
    if (Number.isNaN(months)) return { error: "Ungültige Gültigkeit." };
    await saveQualificationType(actorOf(ctx), ctx.organization.id, {
      name: str(fd, "name"),
      category: (cat in QUAL_CATEGORY_LABELS ? cat : "OTHER") as keyof typeof QUAL_CATEGORY_LABELS,
      validityMonths: months,
      legalBasis: str(fd, "legalBasis"),
    });
    revalidatePath("/qualifications");
  }, "Qualifikationsart angelegt.");
}

export async function removeQual(fd: FormData) {
  const ctx = await requireOrg("trainings.manage");
  await removeQualification(actorOf(ctx), ctx.organization.id, str(fd, "id"));
  revalidatePath("/qualifications");
}

export async function saveRates(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("masterdata.manage");
  const firstAidRate = int(fd, "firstAidRate");
  const fireWardenRate = int(fd, "fireWardenRate");
  if (![5, 10].includes(firstAidRate ?? 0)) return { error: "Ersthelferquote: 5 % oder 10 %." };
  if (!fireWardenRate || fireWardenRate < 1 || fireWardenRate > 50) return { error: "Ungültige Brandschutzhelferquote." };
  await db.organization.update({ where: { id: ctx.organization.id }, data: { firstAidRate: firstAidRate!, fireWardenRate } });
  await audit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "organization.rates", entity: "Organization", entityId: ctx.organization.id, details: { firstAidRate, fireWardenRate } });
  revalidatePath("/qualifications");
  return { message: "Gespeichert." };
}
