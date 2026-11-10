"use server";

import type { AnswerResult } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { db } from "@/lib/db";
import { parseDate } from "@/lib/dates";
import { createTemplate, planWalkthrough, RESULT_LABELS, saveAnswers } from "@/lib/walkthroughs";
import { bool, str, type FormState } from "@/lib/form";

export async function plan(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("walkthroughs.manage");
  const plannedAt = parseDate(str(fd, "plannedAt"));
  let id = "";
  const res = await run(async () => {
    if (!plannedAt) return { error: "Bitte ein Datum angeben." };
    id = (await planWalkthrough(actorOf(ctx), ctx.organization.id, {
      templateId: str(fd, "templateId"), siteId: str(fd, "siteId"), area: str(fd, "area"), plannedAt, auditor: str(fd, "auditor"), participants: str(fd, "participants"),
    })).id;
  });
  if (!res.error) redirect(`/walkthroughs/${id}`);
  return res;
}

export async function addTemplate(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("walkthroughs.manage");
  return run(async () => {
    await createTemplate(actorOf(ctx), ctx.organization.id, { title: str(fd, "title"), description: str(fd, "description"), itemsText: str(fd, "items") });
    revalidatePath("/walkthroughs");
  }, "Checkliste angelegt.");
}

export async function answer(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("walkthroughs.manage");
  const id = str(fd, "id");
  const complete = bool(fd, "complete");
  return run(async () => {
    const w = await db.walkthrough.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { template: { include: { items: true } } } });
    if (!w) return { error: "Begehung nicht gefunden." };
    const answers = w.template.items
      .map((i) => ({ itemId: i.id, result: str(fd, `r_${i.id}`), note: str(fd, `n_${i.id}`) }))
      .filter((a) => a.result in RESULT_LABELS)
      .map((a) => ({ ...a, result: a.result as AnswerResult }));
    await saveAnswers(actorOf(ctx), ctx.organization.id, id, answers, { complete, summary: str(fd, "summary"), performedAt: parseDate(str(fd, "performedAt")) ?? new Date() });
    revalidatePath(`/walkthroughs/${id}`);
  }, complete ? "Begehung abgeschlossen. Legen Sie für die Mängel jetzt Maßnahmen an." : "Zwischenstand gespeichert.");
}
