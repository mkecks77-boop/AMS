"use server";

import type { TrainingKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { KIND_LABELS, recordSession, saveTopic as save, setRequirements, topicFromInstruction } from "@/lib/trainings";
import { bool, int, str, type FormState } from "@/lib/form";

export async function saveTopic(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  const id = str(fd, "id") || null;
  const kind = str(fd, "kind");
  let newId = "";
  const res = await run(async () => {
    const t = await save(actorOf(ctx), ctx.organization.id, id, {
      title: str(fd, "title"),
      kind: (kind in KIND_LABELS ? kind : "INSTRUCTION") as TrainingKind,
      description: str(fd, "description"),
      content: str(fd, "content"),
      legalBasis: str(fd, "legalBasis"),
      intervalMonths: int(fd, "intervalMonths") ?? NaN,
      beforeStart: bool(fd, "beforeStart"),
    });
    newId = t.id;
    revalidatePath("/trainings");
  });
  if (!res.error && !id) redirect(`/trainings/${newId}`);
  return res;
}

export async function saveRequirements(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  const id = str(fd, "topicId");
  return run(async () => {
    await setRequirements(actorOf(ctx), ctx.organization.id, id, {
      allEmployees: bool(fd, "allEmployees"),
      departmentIds: fd.getAll("departmentIds").map(String),
      apprenticesOnly: bool(fd, "apprenticesOnly"),
    });
    revalidatePath(`/trainings/${id}`);
  });
}

export async function addSession(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  const id = str(fd, "topicId");
  const date = parseDate(str(fd, "date"));
  return run(async () => {
    if (!date) return { error: "Bitte das Datum angeben." };
    await recordSession(actorOf(ctx), ctx.organization.id, {
      topicId: id,
      date,
      trainer: str(fd, "trainer"),
      location: str(fd, "location"),
      notes: str(fd, "notes"),
      employeeIds: fd.getAll("employeeIds").map(String),
    });
    revalidatePath(`/trainings/${id}`);
  }, "Unterweisung erfasst.");
}

export async function fromInstruction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("trainings.manage");
  let id = "";
  const res = await run(async () => {
    id = (await topicFromInstruction(actorOf(ctx), ctx.organization.id, str(fd, "instructionId"))).id;
  });
  if (!res.error) redirect(`/trainings/${id}`);
  return res;
}
