"use server";

import type { ActionLevel, ActionPriority, ActionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { ACTION_STATUS_LABELS, createAction, LEVEL_LABELS, PRIORITY_LABELS, updateAction, updateActionStatus } from "@/lib/measures";
import { str, type FormState } from "@/lib/form";

function input(fd: FormData) {
  const level = str(fd, "level");
  const prio = str(fd, "priority");
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    level: level in LEVEL_LABELS ? (level as ActionLevel) : null,
    priority: (prio in PRIORITY_LABELS ? prio : "MEDIUM") as ActionPriority,
    responsibleId: str(fd, "responsibleId"),
    dueDate: parseDate(str(fd, "dueDate")),
  };
}

/** Maßnahme anlegen – Quelle über versteckte Felder (sourceType, incidentId …) */
export async function addAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("actions.manage");
  const i = input(fd);
  return run(async () => {
    if (!i.dueDate) return { error: "Bitte eine Frist angeben." };
    const source: Record<string, string> = {};
    for (const k of ["sourceType", "incidentId", "riskAssessmentId", "hazardId", "walkthroughId", "asaMeetingId", "legalRequirementId", "drillId"]) {
      const v = str(fd, k);
      if (v) source[k] = v;
    }
    await createAction(actorOf(ctx), ctx.organization.id, { ...i, dueDate: i.dueDate }, source);
    revalidatePath(str(fd, "back") || "/actions");
  }, "Maßnahme angelegt.");
}

export async function editAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("actions.manage");
  const i = input(fd);
  const id = str(fd, "id");
  return run(async () => {
    if (!i.dueDate) return { error: "Bitte eine Frist angeben." };
    await updateAction(actorOf(ctx), ctx.organization.id, id, { ...i, dueDate: i.dueDate });
    revalidatePath(`/actions/${id}`);
  });
}

export async function setStatus(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("actions.manage");
  const id = str(fd, "id");
  const status = str(fd, "status");
  return run(async () => {
    if (!(status in ACTION_STATUS_LABELS)) return { error: "Ungültiger Status." };
    await updateActionStatus(actorOf(ctx), ctx.organization.id, id, status as ActionStatus, str(fd, "note"));
    revalidatePath(`/actions/${id}`);
    revalidatePath("/actions");
  }, "Status geändert.");
}
