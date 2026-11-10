import type { Role } from "@prisma/client";
import { db, transaction } from "./db";
import { withoutTenant } from "./tenant";
import { audit } from "./audit";
import { hashPassword, validatePassword } from "./password";
import { INVITATION_DAYS, daysFromNow, generateToken, hashToken } from "./tokens";
import { canResetPasswordFor, wouldRemoveLastAdmin } from "./roles";

export class UserError extends Error {}

export interface Actor {
  userId: string;
  isPlatformAdmin: boolean;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type InviteResult =
  | { kind: "added"; userId: string }
  | { kind: "invited"; token: string };

/**
 * Lädt eine Person in ein Unternehmen ein.
 * - Hat sie bereits ein Konto, wird sie direkt hinzugefügt (sieht das Unternehmen im Umschalter).
 * - Sonst wird ein Einladungslink erzeugt, mit dem sie Name und Passwort festlegt.
 */
export async function inviteMember(
  actor: Actor,
  input: { organizationId: string; email: string; name?: string; role: Role; external: boolean },
): Promise<InviteResult> {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({
    where: { email },
    include: { memberships: { where: { organizationId: input.organizationId } } },
  });

  if (existing?.passwordHash) {
    const m = existing.memberships[0];
    if (m?.active) throw new UserError("Diese Person ist bereits Mitglied.");
    const membership = m
      ? await db.membership.update({
          where: { id: m.id },
          data: { active: true, role: input.role, external: input.external },
        })
      : await db.membership.create({
          data: {
            userId: existing.id,
            organizationId: input.organizationId,
            role: input.role,
            external: input.external,
          },
        });
    await audit({
      organizationId: input.organizationId,
      userId: actor.userId,
      action: "member.added",
      entity: "Membership",
      entityId: membership.id,
      details: { email, role: input.role, external: input.external },
    });
    return { kind: "added", userId: existing.id };
  }

  const token = generateToken();
  const invitation = await db.invitation.create({
    data: {
      email,
      organizationId: input.organizationId,
      role: input.role,
      external: input.external,
      tokenHash: hashToken(token),
      expiresAt: daysFromNow(INVITATION_DAYS),
      invitedById: actor.userId,
    },
  });
  await audit({
    organizationId: input.organizationId,
    userId: actor.userId,
    action: "member.invited",
    entity: "Invitation",
    entityId: invitation.id,
    details: { email, role: input.role, external: input.external },
  });
  return { kind: "invited", token };
}

export async function findOpenInvitation(token: string) {
  const inv = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date() || !inv.organization.active) return null;
  return inv;
}

/** Nimmt eine Einladung an: legt Konto (falls nötig) und Mitgliedschaft an. */
export async function acceptInvitation(token: string, input: { name: string; password: string }) {
  const inv = await findOpenInvitation(token);
  if (!inv) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");
  const name = input.name.trim();
  if (!name) throw new UserError("Bitte den Namen angeben.");
  const pwError = validatePassword(input.password);
  if (pwError) throw new UserError(pwError);

  const existing = await db.user.findUnique({ where: { email: inv.email } });
  if (existing?.passwordHash) {
    throw new UserError("Für diese E-Mail besteht bereits ein Konto. Bitte anmelden.");
  }
  const passwordHash = await hashPassword(input.password);

  return transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name, passwordHash } })
      : await tx.user.create({ data: { email: inv.email, name, passwordHash } });
    await tx.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: inv.organizationId } },
      create: {
        userId: user.id,
        organizationId: inv.organizationId,
        role: inv.role,
        external: inv.external,
      },
      update: { role: inv.role, external: inv.external, active: true },
    });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        organizationId: inv.organizationId,
        userId: user.id,
        action: "invitation.accepted",
        entity: "Invitation",
        entityId: inv.id,
      },
    });
    return { userId: user.id, organizationId: inv.organizationId };
  });
}

/** Rolle ändern oder Mitgliedschaft (de)aktivieren – nur innerhalb des Unternehmens. */
export async function updateMembership(
  actor: Actor,
  input: { organizationId: string; membershipId: string; role?: Role; active?: boolean },
) {
  const m = await db.membership.findFirst({
    where: { id: input.membershipId, organizationId: input.organizationId },
  });
  if (!m) throw new UserError("Mitgliedschaft nicht gefunden.");
  if (m.userId === actor.userId && input.active === false) {
    throw new UserError("Sie können sich nicht selbst deaktivieren.");
  }

  const newActive = input.active ?? m.active;
  const newRole = input.role ?? m.role;
  const admins = await db.membership.findMany({
    where: { organizationId: input.organizationId, role: "ORG_ADMIN", active: true },
    select: { id: true },
  });
  if (
    wouldRemoveLastAdmin(
      admins.map((a) => a.id),
      m.id,
      newActive ? newRole : null,
    )
  ) {
    throw new UserError("Das Unternehmen braucht mindestens einen aktiven Unternehmens-Admin.");
  }

  const updated = await db.membership.update({
    where: { id: m.id },
    data: { role: newRole, active: newActive },
  });
  await audit({
    organizationId: input.organizationId,
    userId: actor.userId,
    action: "member.updated",
    entity: "Membership",
    entityId: m.id,
    details: { from: { role: m.role, active: m.active }, to: { role: newRole, active: newActive } },
  });
  return updated;
}

/** Erzeugt einen Link zum Setzen eines neuen Passworts. */
export async function createPasswordReset(
  actor: Actor,
  input: { organizationId: string; targetUserId: string },
): Promise<string> {
  // bewusst mandantenübergreifend: Gehört die Person auch anderen Unternehmen an?
  const { target, adminOrgIds } = await withoutTenant(async () => {
    const target = await db.user.findUnique({
      where: { id: input.targetUserId },
      include: { memberships: { select: { organizationId: true } } },
    });
    const adminOrgIds = (
      await db.membership.findMany({
        where: { userId: actor.userId, role: "ORG_ADMIN", active: true },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);
    return { target, adminOrgIds };
  });
  if (!target) throw new UserError("Person nicht gefunden.");
  const targetOrgIds = target.memberships.map((m) => m.organizationId);
  if (!targetOrgIds.includes(input.organizationId) && !actor.isPlatformAdmin) {
    throw new UserError("Person nicht gefunden.");
  }
  if (
    !canResetPasswordFor({ isPlatformAdmin: actor.isPlatformAdmin, adminOrgIds }, targetOrgIds) ||
    (target.isPlatformAdmin && !actor.isPlatformAdmin)
  ) {
    throw new UserError(
      "Diese Person gehört auch anderen Unternehmen an. Das Passwort kann nur sie selbst oder der Plattform-Betreiber zurücksetzen.",
    );
  }
  const token = generateToken();
  await db.passwordReset.create({
    data: { userId: target.id, tokenHash: hashToken(token), expiresAt: daysFromNow(1) },
  });
  await audit({
    organizationId: input.organizationId,
    userId: actor.userId,
    action: "password.reset_link_created",
    entity: "User",
    entityId: target.id,
  });
  return token;
}

export async function resetPassword(token: string, password: string) {
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new UserError("Der Link ist ungültig oder abgelaufen.");
  }
  const pwError = validatePassword(password);
  if (pwError) throw new UserError(pwError);
  const passwordHash = await hashPassword(password);
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
  });
  await audit({ userId: reset.userId, action: "password.reset", entity: "User", entityId: reset.userId });
}

/** Plattform-Betreiber: neues Unternehmen mit erstem Admin anlegen. */
export async function createOrganization(
  actor: Actor,
  input: { name: string; slug: string; adminEmail: string; adminName?: string },
) {
  if (!actor.isPlatformAdmin) throw new UserError("Keine Berechtigung.");
  const name = input.name.trim();
  if (!name || !input.slug) throw new UserError("Bitte Name angeben.");
  if (await db.organization.findUnique({ where: { slug: input.slug } })) {
    throw new UserError("Der Kurzname ist bereits vergeben.");
  }
  const org = await db.organization.create({ data: { name, slug: input.slug } });
  await audit({
    organizationId: org.id,
    userId: actor.userId,
    action: "organization.created",
    entity: "Organization",
    entityId: org.id,
  });
  const invite = await inviteMember(actor, {
    organizationId: org.id,
    email: input.adminEmail,
    role: "ORG_ADMIN",
    external: false,
  });
  return { organization: org, invite };
}

export async function setOrganizationActive(actor: Actor, organizationId: string, active: boolean) {
  if (!actor.isPlatformAdmin) throw new UserError("Keine Berechtigung.");
  await db.organization.update({ where: { id: organizationId }, data: { active } });
  await audit({
    organizationId,
    userId: actor.userId,
    action: active ? "organization.activated" : "organization.deactivated",
    entity: "Organization",
    entityId: organizationId,
  });
}
