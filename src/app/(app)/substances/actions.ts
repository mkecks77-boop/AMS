"use server";

import type { SignalWord } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { GHS_PICTOGRAMS, parseStatements, SIGNAL_WORD_LABELS } from "@/lib/ghs";
import {
  addSubstanceUse,
  decideSubstance,
  phaseOutSubstance,
  removeSubstanceUse,
  saveSubstance as save,
} from "@/lib/substances";
import { bool, str, type FormState } from "@/lib/form";

export async function saveSubstance(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("substances.edit");
  const id = str(fd, "id") || null;
  const signal = str(fd, "signalWord");
  let newId = "";
  const res = await run(async () => {
    const s = await save(actorOf(ctx), ctx.organization.id, id, {
      name: str(fd, "name"),
      manufacturer: str(fd, "manufacturer"),
      casNumber: str(fd, "casNumber"),
      usage: str(fd, "usage"),
      pictograms: fd.getAll("pictograms").map(String).filter((p) => p in GHS_PICTOGRAMS),
      signalWord: (signal in SIGNAL_WORD_LABELS ? signal : "NONE") as SignalWord,
      hStatements: parseStatements(str(fd, "hStatements"), "H"),
      pStatements: parseStatements(str(fd, "pStatements"), "P"),
      storageClass: str(fd, "storageClass"),
      waterHazardClass: str(fd, "waterHazardClass"),
      sdsDate: parseDate(str(fd, "sdsDate")),
      sdsReviewDue: parseDate(str(fd, "sdsReviewDue")),
      ppe: str(fd, "ppe"),
      substitutionChecked: bool(fd, "substitutionChecked"),
      substitutionNotes: str(fd, "substitutionNotes"),
    });
    newId = s.id;
    revalidatePath("/substances");
    if (id) revalidatePath(`/substances/${id}`);
  });
  if (!res.error && !id) redirect(`/substances/${newId}`);
  return res;
}

export async function decide(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("substances.approve");
  const id = str(fd, "id");
  const decision = str(fd, "decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  let draftId: string | null = null;
  const res = await run(async () => {
    const draft = await decideSubstance(actorOf(ctx), ctx.organization.id, id, decision, str(fd, "note"));
    draftId = draft?.id ?? null;
    revalidatePath(`/substances/${id}`);
  }, decision === "APPROVED" ? "Freigegeben." : "Abgelehnt.");
  if (!res.error && draftId) redirect(`/instructions/${draftId}?neu=1`);
  return res;
}

export async function addUse(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("substances.edit");
  const id = str(fd, "substanceId");
  const q = str(fd, "quantity").replace(",", ".");
  return run(async () => {
    await addSubstanceUse(actorOf(ctx), ctx.organization.id, {
      substanceId: id,
      siteId: str(fd, "siteId"),
      workArea: str(fd, "workArea"),
      quantity: q ? Number(q) : null,
      unit: str(fd, "unit"),
    });
    revalidatePath(`/substances/${id}`);
  }, "Einsatzort hinzugefügt.");
}

export async function removeUse(fd: FormData) {
  const ctx = await requireOrg("substances.edit");
  await removeSubstanceUse(actorOf(ctx), ctx.organization.id, str(fd, "useId"));
  revalidatePath(`/substances/${str(fd, "substanceId")}`);
}

export async function phaseOut(fd: FormData) {
  const ctx = await requireOrg("substances.approve");
  await phaseOutSubstance(actorOf(ctx), ctx.organization.id, str(fd, "id"));
  revalidatePath(`/substances/${str(fd, "id")}`);
}
