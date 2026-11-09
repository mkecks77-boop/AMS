"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { addPpeItem, confirmReceipt, issuePpe, returnPpe } from "@/lib/ppe";
import { bool, int, str, type FormState } from "@/lib/form";

export async function issue(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("ppe.manage");
  const issuedAt = parseDate(str(fd, "issuedAt"));
  return run(async () => {
    if (!issuedAt) return { error: "Bitte das Ausgabedatum angeben." };
    await issuePpe(actorOf(ctx), ctx.organization.id, { itemId: str(fd, "itemId"), employeeId: str(fd, "employeeId"), size: str(fd, "size"), quantity: int(fd, "quantity") ?? 1, issuedAt, receiptSigned: bool(fd, "receiptSigned") });
    revalidatePath("/ppe");
  }, "Ausgabe erfasst.");
}

export async function addItem(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("ppe.manage");
  const months = int(fd, "replaceMonths");
  return run(async () => {
    if (Number.isNaN(months)) return { error: "Ungültige Gebrauchsdauer." };
    await addPpeItem(actorOf(ctx), ctx.organization.id, { name: str(fd, "name"), category: str(fd, "category"), standard: str(fd, "standard"), replaceMonths: months, inspectionRequired: bool(fd, "inspectionRequired") });
    revalidatePath("/ppe");
  }, "PSA angelegt.");
}

export async function ppeStep(fd: FormData) {
  const ctx = await requireOrg("ppe.manage");
  const id = str(fd, "id");
  if (str(fd, "step") === "return") await returnPpe(actorOf(ctx), ctx.organization.id, id);
  else await confirmReceipt(actorOf(ctx), ctx.organization.id, id);
  revalidatePath("/ppe");
}
