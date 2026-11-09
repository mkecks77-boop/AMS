"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { createDepartment, createSite, setDepartmentActive, setSiteActive } from "@/lib/masterdata";
import { str, type FormState } from "@/lib/form";

export async function addSite(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("masterdata.manage");
  return run(async () => {
    await createSite(actorOf(ctx), ctx.organization.id, { name: str(fd, "name"), address: str(fd, "address") });
    revalidatePath("/sites");
  }, "Standort angelegt.");
}

export async function addDepartment(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("masterdata.manage");
  return run(async () => {
    await createDepartment(actorOf(ctx), ctx.organization.id, { name: str(fd, "name"), siteId: str(fd, "siteId") || null });
    revalidatePath("/sites");
  }, "Abteilung angelegt.");
}

export async function toggle(fd: FormData) {
  const ctx = await requireOrg("masterdata.manage");
  const active = str(fd, "active") === "true";
  const fn = str(fd, "kind") === "site" ? setSiteActive : setDepartmentActive;
  await fn(actorOf(ctx), ctx.organization.id, str(fd, "id"), active);
  revalidatePath("/sites");
}
