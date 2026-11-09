"use server";

import type { PermitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { nowWallClock, parseDateTime } from "@/lib/dates";
import { activatePermit, closePermit, decidePermit, PERMIT_TYPE_LABELS, requestPermit } from "@/lib/contractors";
import { str, type FormState } from "@/lib/form";

export async function request(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("permits.request");
  const type = str(fd, "type");
  const from = parseDateTime(str(fd, "validFrom"));
  const to = parseDateTime(str(fd, "validTo"));
  let id = "";
  const res = await run(async () => {
    if (!from || !to) return { error: "Bitte Beginn und Ende angeben." };
    id = (await requestPermit(actorOf(ctx), ctx.organization.id, {
      type: (type in PERMIT_TYPE_LABELS ? type : "OTHER") as PermitType, siteId: str(fd, "siteId"), location: str(fd, "location"), description: str(fd, "description"),
      contractorId: str(fd, "contractorId"), workerIds: fd.getAll("workerIds").map(String), validFrom: from, validTo: to,
    })).id;
  });
  if (!res.error) redirect(`/permits/${id}`);
  return res;
}

export async function step(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("permits.approve");
  const id = str(fd, "id");
  const s = str(fd, "step");
  const a = actorOf(ctx);
  const now = nowWallClock();
  return run(async () => {
    if (s === "approve") await decidePermit(a, ctx.organization.id, id, true, str(fd, "note"), now);
    else if (s === "reject") await decidePermit(a, ctx.organization.id, id, false, str(fd, "note"), now);
    else if (s === "activate") await activatePermit(a, ctx.organization.id, id, fd.getAll("checks").map(String), now);
    else if (s === "close") await closePermit(a, ctx.organization.id, id, parseDateTime(str(fd, "fireWatchUntil")), now);
    revalidatePath(`/permits/${id}`);
  });
}
