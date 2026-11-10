"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { createOrganization, setOrganizationActive, UserError } from "@/lib/users";
import { appUrl, str, type FormState } from "@/lib/form";

export async function createOrg(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requirePlatformAdmin();
  const name = str(fd, "name");
  try {
    const { invite } = await createOrganization(
      { userId: s.user.id, isPlatformAdmin: true },
      { name, slug: slugify(str(fd, "slug") || name), adminEmail: str(fd, "adminEmail") },
    );
    revalidatePath("/platform");
    return invite.kind === "invited"
      ? { message: "Unternehmen angelegt. Einladungslink für den ersten Admin:", link: appUrl(`/invite/${invite.token}`) }
      : { message: "Unternehmen angelegt. Die Person hatte bereits ein Konto und ist jetzt Admin." };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function toggleOrg(fd: FormData) {
  const s = await requirePlatformAdmin();
  await setOrganizationActive({ userId: s.user.id, isPlatformAdmin: true }, str(fd, "id"), str(fd, "active") === "true");
  revalidatePath("/platform");
}
