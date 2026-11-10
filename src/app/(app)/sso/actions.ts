"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { saveSsoConfig } from "@/lib/sso";
import { bool, str, type FormState } from "@/lib/form";

export async function save(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("users.manage");
  return run(async () => {
    await saveSsoConfig(actorOf(ctx), ctx.organization.id, {
      issuer: str(fd, "issuer"), clientId: str(fd, "clientId"), clientSecret: str(fd, "clientSecret") || null,
      emailDomains: str(fd, "emailDomains").split(/[,;\s]+/), autoProvision: bool(fd, "autoProvision"), enforce: bool(fd, "enforce"), enabled: bool(fd, "enabled"),
    });
    revalidatePath("/sso");
  }, "Gespeichert.");
}
