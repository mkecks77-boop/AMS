"use server";

import type { InstructionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { ALL_PICTOGRAMS } from "@/lib/pictograms";
import {
  createInstruction,
  newVersion as makeVersion,
  releaseInstruction,
  returnToDraft,
  submitForReview,
  TYPE_LABELS,
  updateInstruction,
  withdrawInstruction,
  type InstructionContent,
} from "@/lib/instructions";
import { str, type FormState } from "@/lib/form";

function content(fd: FormData): InstructionContent {
  const type = str(fd, "type");
  return {
    type: (type in TYPE_LABELS ? type : "ACTIVITY") as InstructionType,
    title: str(fd, "title"),
    scope: str(fd, "scope"),
    hazards: str(fd, "hazards"),
    protectiveMeasures: str(fd, "protectiveMeasures"),
    malfunctions: str(fd, "malfunctions"),
    firstAid: str(fd, "firstAid"),
    maintenance: str(fd, "maintenance"),
    pictograms: fd.getAll("pictograms").map(String).filter((p) => ALL_PICTOGRAMS.includes(p)),
    emergencyPhone: str(fd, "emergencyPhone"),
    postings: str(fd, "postings"),
  };
}

const links = (fd: FormData) => ({ substanceId: str(fd, "substanceId") || null, equipmentId: str(fd, "equipmentId") || null });

export async function saveInstruction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("instructions.edit");
  const id = str(fd, "id") || null;
  let newId = "";
  const res = await run(async () => {
    if (id) await updateInstruction(actorOf(ctx), ctx.organization.id, id, content(fd), links(fd));
    else newId = (await createInstruction(actorOf(ctx), ctx.organization.id, content(fd), links(fd))).id;
    revalidatePath("/instructions");
    if (id) revalidatePath(`/instructions/${id}`);
  });
  if (!res.error && !id) redirect(`/instructions/${newId}`);
  return res;
}

export async function workflow(_: FormState, fd: FormData): Promise<FormState> {
  const step = str(fd, "step");
  const id = str(fd, "id");
  const ctx = await requireOrg(step === "release" || step === "return" || step === "withdraw" ? "instructions.release" : "instructions.edit");
  const a = actorOf(ctx);
  const org = ctx.organization.id;
  let target = id;
  const res = await run(async () => {
    if (step === "submit") await submitForReview(a, org, id);
    else if (step === "release") await releaseInstruction(a, org, id);
    else if (step === "return") await returnToDraft(a, org, id, str(fd, "note"));
    else if (step === "withdraw") await withdrawInstruction(a, org, id);
    else if (step === "version") target = (await makeVersion(a, org, id)).id;
    else return { error: "Unbekannter Schritt." };
    revalidatePath("/instructions");
    revalidatePath(`/instructions/${id}`);
  });
  if (!res.error && target !== id) redirect(`/instructions/${target}`);
  return res;
}
