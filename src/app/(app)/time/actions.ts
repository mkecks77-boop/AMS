"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { deleteTime, logTime } from "@/lib/timelog";
import { int, str, type FormState } from "@/lib/form";

export async function add(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("time.log");
  const date = parseDate(str(fd, "date"));
  const hours = Number(str(fd, "hours").replace(",", "."));
  return run(async () => {
    if (!date) return { error: "Bitte das Datum angeben." };
    if (!Number.isFinite(hours)) return { error: "Bitte die Dauer in Stunden angeben (z. B. 1,5)." };
    await logTime(actorOf(ctx), ctx.organization.id, { date, minutes: Math.round(hours * 60), category: str(fd, "category"), description: str(fd, "description") });
    revalidatePath("/time");
  }, "Erfasst.");
}

export async function remove(fd: FormData) {
  const ctx = await requireOrg("time.log");
  await deleteTime(actorOf(ctx), ctx.organization.id, str(fd, "id"));
  revalidatePath("/time");
}

export async function setTarget(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("reports.view");
  const h = int(fd, "target");
  if (h != null && (Number.isNaN(h) || h < 0 || h > 10000)) return { error: "Ungültiger Wert." };
  await db.organization.update({ where: { id: ctx.organization.id }, data: { sifaHoursTarget: h } });
  await audit({ organizationId: ctx.organization.id, userId: ctx.user.id, action: "organization.sifa_target", entity: "Organization", entityId: ctx.organization.id, details: { hours: h } });
  revalidatePath("/time");
  return { message: "Gespeichert." };
}
