"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { isRole } from "@/lib/roles";
import { createPasswordReset, inviteMember, updateMembership, UserError } from "@/lib/users";
import { appUrl, str, type FormState } from "@/lib/form";
import { mailConfigured, sendMail } from "@/lib/mail";

async function actor() {
  const ctx = await requireOrg("users.manage");
  return { ctx, actor: { userId: ctx.user.id, isPlatformAdmin: ctx.user.isPlatformAdmin } };
}

function handle(e: unknown): FormState {
  if (e instanceof UserError) return { error: e.message };
  throw e;
}

export async function invite(_: FormState, fd: FormData): Promise<FormState> {
  const { ctx, actor: a } = await actor();
  const role = fd.get("role");
  const email = str(fd, "email");
  if (!isRole(role)) return { error: "Bitte eine Rolle wählen." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Bitte eine gültige E-Mail angeben." };
  try {
    const res = await inviteMember(a, {
      organizationId: ctx.organization.id,
      email,
      role,
      external: fd.get("external") === "on",
    });
    revalidatePath("/users");
    if (res.kind === "added") {
      return { message: "Die Person hat bereits ein Konto und wurde direkt hinzugefügt." };
    }
    const link = appUrl(`/invite/${res.token}`);
    const mailed = mailConfigured() && (await sendMail(email, `Einladung zu AMS – ${ctx.organization.name}`,
      `Sie wurden zum Arbeitsschutzmanagementsystem von ${ctx.organization.name} eingeladen.\n\nKonto anlegen (7 Tage gültig):\n${link}\n`));
    return {
      message: mailed ? "Einladung per E-Mail versendet. Zusätzlich hier der Link (7 Tage gültig):" : "Einladung erstellt. Senden Sie diesen Link an die Person (7 Tage gültig):",
      link,
    };
  } catch (e) {
    return handle(e);
  }
}

export async function changeMembership(_: FormState, fd: FormData): Promise<FormState> {
  const { ctx, actor: a } = await actor();
  const role = fd.get("role");
  const active = str(fd, "active");
  try {
    await updateMembership(a, {
      organizationId: ctx.organization.id,
      membershipId: str(fd, "membershipId"),
      role: isRole(role) ? role : undefined,
      active: active === "" ? undefined : active === "true",
    });
    revalidatePath("/users");
    return { message: "Gespeichert." };
  } catch (e) {
    return handle(e);
  }
}

export async function resetLink(_: FormState, fd: FormData): Promise<FormState> {
  const { ctx, actor: a } = await actor();
  try {
    const token = await createPasswordReset(a, {
      organizationId: ctx.organization.id,
      targetUserId: str(fd, "userId"),
    });
    return { message: "Link zum Zurücksetzen (24 Stunden gültig):", link: appUrl(`/reset/${token}`) };
  } catch (e) {
    return handle(e);
  }
}
