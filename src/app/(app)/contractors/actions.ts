"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { addWorker, briefWorker, saveContractor, setContractorBlocked } from "@/lib/contractors";
import { bool, str, type FormState } from "@/lib/form";

export async function save(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("contractors.manage");
  const id = str(fd, "id") || null;
  let newId = "";
  const res = await run(async () => {
    newId = (await saveContractor(actorOf(ctx), ctx.organization.id, id, {
      name: str(fd, "name"), contactName: str(fd, "contactName"), phone: str(fd, "phone"), email: str(fd, "email"), insuranceUntil: parseDate(str(fd, "insuranceUntil")), notes: str(fd, "notes"),
    })).id;
    revalidatePath("/contractors");
    if (id) revalidatePath(`/contractors/${id}`);
  });
  if (!res.error && !id) redirect(`/contractors/${newId}`);
  return res;
}

export async function block(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("contractors.manage");
  const id = str(fd, "id");
  return run(async () => {
    await setContractorBlocked(actorOf(ctx), ctx.organization.id, id, bool(fd, "blocked"), str(fd, "reason"));
    revalidatePath(`/contractors/${id}`);
  });
}

export async function worker(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("contractors.manage");
  const id = str(fd, "contractorId");
  return run(async () => {
    await addWorker(actorOf(ctx), ctx.organization.id, { contractorId: id, name: str(fd, "name"), briefedAt: parseDate(str(fd, "briefedAt")) });
    revalidatePath(`/contractors/${id}`);
  }, "Person hinzugefügt.");
}

export async function brief(fd: FormData) {
  const ctx = await requireOrg("contractors.manage");
  await briefWorker(actorOf(ctx), ctx.organization.id, str(fd, "workerId"), new Date());
  revalidatePath(`/contractors/${str(fd, "contractorId")}`);
}
