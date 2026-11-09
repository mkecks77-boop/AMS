"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { appoint, endAppointment, markSigned } from "@/lib/appointments";
import { bool, str, type FormState } from "@/lib/form";

export async function create(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("appointments.manage");
  const appointedAt = parseDate(str(fd, "appointedAt"));
  return run(async () => {
    if (!appointedAt) return { error: "Bitte das Datum angeben." };
    await appoint(actorOf(ctx), ctx.organization.id, {
      employeeId: str(fd, "employeeId"), role: str(fd, "role"), siteId: str(fd, "siteId"), scope: str(fd, "scope"),
      appointedAt, validUntil: parseDate(str(fd, "validUntil")), signed: bool(fd, "signed"),
    });
    revalidatePath("/appointments");
  }, "Beauftragung erfasst.");
}

export async function step(fd: FormData) {
  const ctx = await requireOrg("appointments.manage");
  const id = str(fd, "id");
  if (str(fd, "step") === "end") await endAppointment(actorOf(ctx), ctx.organization.id, id);
  else await markSigned(actorOf(ctx), ctx.organization.id, id);
  revalidatePath("/appointments");
}
