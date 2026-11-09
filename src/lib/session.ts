import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./roles";
import { SESSION_DAYS, daysFromNow, generateToken, hashToken } from "./tokens";

const COOKIE = "ams_session";

export async function createSession(userId: string, activeOrganizationId: string | null) {
  const token = generateToken();
  const expiresAt = daysFromNow(SESSION_DAYS);
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), activeOrganizationId, expiresAt },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(COOKIE);
}

/** Aktuelle Sitzung mit Nutzer und aktiven Mitgliedschaften (nur aktive Unternehmen). */
export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { active: true, organization: { active: true } },
            include: { organization: true },
            orderBy: { organization: { name: "asc" } },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session;
}

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function requireUser(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export interface OrgContext {
  session: CurrentSession;
  user: CurrentSession["user"];
  organization: { id: string; name: string; slug: string };
  /** null nur bei Plattform-Admins ohne eigene Mitgliedschaft */
  role: Role | null;
  can: (p: Permission) => boolean;
}

/**
 * Liefert das aktuell gewählte Unternehmen.
 * Alle Fachdaten-Abfragen müssen mit ctx.organization.id gefiltert werden.
 */
export async function requireOrg(permission?: Permission): Promise<OrgContext> {
  const session = await requireUser();
  const { user } = session;
  const orgId = session.activeOrganizationId;
  if (!orgId) redirect("/select-org");

  const membership = user.memberships.find((m) => m.organizationId === orgId);
  let organization = membership?.organization ?? null;
  if (!organization && user.isPlatformAdmin) {
    organization = await db.organization.findFirst({ where: { id: orgId, active: true } });
  }
  if (!organization) redirect("/select-org");

  const role = membership?.role ?? null;
  const access = { isPlatformAdmin: user.isPlatformAdmin, role };
  if (permission && !can(access, permission)) redirect("/forbidden");

  return {
    session,
    user,
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    role,
    can: (p) => can(access, p),
  };
}

export async function requirePlatformAdmin(): Promise<CurrentSession> {
  const session = await requireUser();
  if (!session.user.isPlatformAdmin) redirect("/forbidden");
  return session;
}
