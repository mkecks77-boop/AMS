"use server";

import type { DrillKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { completeDrill, DRILL_KIND_LABELS, planDrill, savePlan } from "@/lib/emergency";
import { bool, int, str, type FormState } from "@/lib/form";

export async function plan(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("emergency.manage");
  return run(async () => {
    await savePlan(actorOf(ctx), ctx.organization.id, str(fd, "siteId"), {
      internalEmergency: str(fd, "internalEmergency"), fireBrigade: str(fd, "fireBrigade"), poisonCenter: str(fd, "poisonCenter"),
      doctorOnDuty: str(fd, "doctorOnDuty"), dArzt: str(fd, "dArzt"), assemblyPoint: str(fd, "assemblyPoint"), evacuationHelpers: str(fd, "evacuationHelpers"),
      firstAidRooms: str(fd, "firstAidRooms"), aedLocations: str(fd, "aedLocations"), alarmSignal: str(fd, "alarmSignal"), notes: str(fd, "notes"),
    });
    revalidatePath("/emergency");
  }, "Alarmplan gespeichert.");
}

export async function drill(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("emergency.manage");
  const date = parseDate(str(fd, "plannedAt"));
  const kind = str(fd, "kind");
  let id = "";
  const res = await run(async () => {
    if (!date) return { error: "Bitte ein Datum angeben." };
    id = (await planDrill(actorOf(ctx), ctx.organization.id, { siteId: str(fd, "siteId"), kind: (kind in DRILL_KIND_LABELS ? kind : "EVACUATION") as DrillKind, plannedAt: date, scenario: str(fd, "scenario"), announced: !bool(fd, "unannounced") })).id;
  });
  if (!res.error) redirect(`/emergency/drills/${id}`);
  return res;
}

export async function evaluate(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("emergency.manage");
  const id = str(fd, "id");
  const date = parseDate(str(fd, "performedAt"));
  return run(async () => {
    if (!date) return { error: "Bitte das Datum angeben." };
    await completeDrill(actorOf(ctx), ctx.organization.id, id, { performedAt: date, participants: int(fd, "participants"), evacuationMinutes: int(fd, "evacuationMinutes"), observations: str(fd, "observations") });
    revalidatePath(`/emergency/drills/${id}`);
  }, "Übung ausgewertet. Legen Sie für erkannte Mängel Maßnahmen an.");
}
