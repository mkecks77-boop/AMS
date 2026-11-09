"use server";

import type { RiskAssessmentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { archiveAssessment, copyAssessment, deleteHazard, KIND_LABELS, releaseAssessment, saveAssessment as save, saveHazard as saveH } from "@/lib/risk";
import { int, str, type FormState } from "@/lib/form";

export async function saveAssessment(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("risk.manage");
  const id = str(fd, "id") || null;
  const kind = str(fd, "kind");
  let newId = "";
  const res = await run(async () => {
    const ra = await save(actorOf(ctx), ctx.organization.id, id, {
      title: str(fd, "title"),
      kind: (kind in KIND_LABELS ? kind : "GENERAL") as RiskAssessmentKind,
      siteId: str(fd, "siteId"),
      departmentId: str(fd, "departmentId"),
      scope: str(fd, "scope"),
      participants: str(fd, "participants"),
      responsibleId: str(fd, "responsibleId"),
      reviewIntervalMonths: int(fd, "reviewIntervalMonths") ?? 24,
    });
    newId = ra.id;
    revalidatePath("/risk");
    if (id) revalidatePath(`/risk/${id}`);
  });
  if (!res.error && !id) redirect(`/risk/${newId}`);
  return res;
}

export async function saveHazard(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("risk.manage");
  const id = str(fd, "assessmentId");
  const n = (k: string) => int(fd, k);
  return run(async () => {
    await saveH(actorOf(ctx), ctx.organization.id, id, str(fd, "hazardId") || null, {
      factor: str(fd, "factor"),
      description: str(fd, "description"),
      probability: n("probability") ?? NaN,
      severity: n("severity") ?? NaN,
      measures: str(fd, "measures"),
      residualProbability: n("residualProbability"),
      residualSeverity: n("residualSeverity"),
    });
    revalidatePath(`/risk/${id}`);
  });
}

export async function riskStep(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("risk.manage");
  const id = str(fd, "id");
  const step = str(fd, "step");
  const a = actorOf(ctx);
  let target = "";
  const res = await run(async () => {
    if (step === "release") await releaseAssessment(a, ctx.organization.id, id);
    else if (step === "copy") target = (await copyAssessment(a, ctx.organization.id, id)).id;
    else if (step === "archive") await archiveAssessment(a, ctx.organization.id, id);
    else if (step === "deleteHazard") await deleteHazard(a, ctx.organization.id, id, str(fd, "hazardId"));
    revalidatePath(`/risk/${id}`);
    revalidatePath("/risk");
  });
  if (!res.error && target) redirect(`/risk/${target}`);
  return res;
}
