"use server";

import type { ComplianceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { addLegal, COMPLIANCE_LABELS, evaluateLegal } from "@/lib/legal";
import { str, type FormState } from "@/lib/form";

export async function evaluate(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("legal.manage");
  const status = str(fd, "status");
  return run(async () => {
    if (!(status in COMPLIANCE_LABELS)) return { error: "Ungültiger Status." };
    await evaluateLegal(actorOf(ctx), ctx.organization.id, str(fd, "id"), { status: status as ComplianceStatus, evidence: str(fd, "evidence"), responsibleId: str(fd, "responsibleId") });
    revalidatePath("/legal");
  });
}

export async function add(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("legal.manage");
  return run(async () => {
    await addLegal(actorOf(ctx), ctx.organization.id, { area: str(fd, "area"), law: str(fd, "law"), reference: str(fd, "reference"), obligation: str(fd, "obligation") });
    revalidatePath("/legal");
  }, "Anforderung hinzugefügt.");
}
