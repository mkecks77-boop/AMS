"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/password";
import { verifyTotp } from "@/lib/totp";
import { passwordLoginBlocked, startSso } from "@/lib/sso";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { acceptInvitation, normalizeEmail, resetPassword, UserError } from "@/lib/users";
import { str, type FormState } from "@/lib/form";

const GENERIC = "E-Mail oder Passwort ist falsch.";

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = normalizeEmail(str(fd, "email"));
  const password = String(fd.get("password") ?? "");
  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { active: true, organization: { active: true } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (user && !user.isPlatformAdmin && (await passwordLoginBlocked(email))) {
    return { error: "Für Ihr Unternehmen ist die Anmeldung mit dem Unternehmenskonto vorgeschrieben. Bitte „Mit Unternehmenskonto anmelden“ verwenden." };
  }
  if (!user?.passwordHash || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: GENERIC };
  }
  if (user.totpEnabled && user.totpSecret) {
    const code = str(fd, "code");
    if (!code) return { error: "Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.", needCode: true };
    if (!verifyTotp(user.totpSecret, code)) return { error: "Der Code ist ungültig.", needCode: true };
  }
  const only = user.memberships.length === 1 ? user.memberships[0].organizationId : null;
  await createSession(user.id, only);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ organizationId: only, userId: user.id, action: "login", entity: "User", entityId: user.id });
  redirect(only ? "/" : user.memberships.length === 0 && user.isPlatformAdmin ? "/platform" : "/select-org");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function switchOrganization(fd: FormData) {
  const session = await requireUser();
  const orgId = str(fd, "organizationId");
  const allowed =
    session.user.memberships.some((m) => m.organizationId === orgId) ||
    (session.user.isPlatformAdmin &&
      (await db.organization.count({ where: { id: orgId, active: true } })) > 0);
  if (!allowed) redirect("/select-org");
  await db.session.update({ where: { id: session.id }, data: { activeOrganizationId: orgId } });
  redirect("/");
}

export async function acceptInvite(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  try {
    const { userId, organizationId } = await acceptInvitation(token, {
      name: str(fd, "name"),
      password: String(fd.get("password") ?? ""),
    });
    await createSession(userId, organizationId);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect("/");
}

export async function setNewPassword(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await resetPassword(str(fd, "token"), String(fd.get("password") ?? ""));
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect("/login?reset=1");
}

export async function ssoLogin(_: FormState, fd: FormData): Promise<FormState> {
  let url = "";
  try {
    url = await startSso(str(fd, "email"));
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect(url);
}
