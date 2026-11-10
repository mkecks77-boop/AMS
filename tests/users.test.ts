import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  acceptInvitation,
  createOrganization,
  createPasswordReset,
  inviteMember,
  resetPassword,
  updateMembership,
  UserError,
} from "@/lib/users";
import { verifyPassword } from "@/lib/password";

const PW = "Sicheres-Passwort1";

async function reset() {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.passwordReset.deleteMany(),
    db.session.deleteMany(),
    db.invitation.deleteMany(),
    db.membership.deleteMany(),
    db.user.deleteMany(),
    db.organization.deleteMany(),
  ]);
}

async function setup() {
  const platform = await db.user.create({
    data: { email: "p@x.de", name: "Plattform", isPlatformAdmin: true, passwordHash: "x" },
  });
  const pa = { userId: platform.id, isPlatformAdmin: true };
  const a = await createOrganization(pa, { name: "Firma A", slug: "a", adminEmail: "admin@a.de" });
  const b = await createOrganization(pa, { name: "Firma B", slug: "b", adminEmail: "admin@b.de" });
  if (a.invite.kind !== "invited" || b.invite.kind !== "invited") throw new Error("erwartet Einladung");
  const adminA = await acceptInvitation(a.invite.token, { name: "Admin A", password: PW });
  const adminB = await acceptInvitation(b.invite.token, { name: "Admin B", password: PW });
  return {
    orgA: a.organization.id,
    orgB: b.organization.id,
    actorA: { userId: adminA.userId, isPlatformAdmin: false },
    actorB: { userId: adminB.userId, isPlatformAdmin: false },
  };
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await db.$disconnect();
});

describe("Einladungen und Mandanten", () => {
  it("externe Sifa wird von zwei Unternehmen eingeladen und hat ein Konto mit zwei Mitgliedschaften", async () => {
    const { orgA, orgB, actorA, actorB } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "Sifa@Extern.de", role: "SAFETY_OFFICER", external: true });
    expect(inv.kind).toBe("invited");
    if (inv.kind !== "invited") return;
    const { userId } = await acceptInvitation(inv.token, { name: "Erik Extern", password: PW });

    const second = await inviteMember(actorB, { organizationId: orgB, email: "sifa@extern.de", role: "SAFETY_OFFICER", external: true });
    expect(second).toEqual({ kind: "added", userId });

    const memberships = await db.membership.findMany({ where: { userId } });
    expect(memberships.map((m) => m.organizationId).sort()).toEqual([orgA, orgB].sort());
    expect(memberships.every((m) => m.external)).toBe(true);
  });

  it("Einladung kann nur einmal verwendet werden", async () => {
    const { orgA, actorA } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "m@a.de", role: "EMPLOYEE", external: false });
    if (inv.kind !== "invited") throw new Error();
    await acceptInvitation(inv.token, { name: "M", password: PW });
    await expect(acceptInvitation(inv.token, { name: "M", password: PW })).rejects.toThrow(UserError);
  });

  it("abgelaufene Einladung wird abgelehnt", async () => {
    const { orgA, actorA } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "m@a.de", role: "EMPLOYEE", external: false });
    if (inv.kind !== "invited") throw new Error();
    await db.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptInvitation(inv.token, { name: "M", password: PW })).rejects.toThrow("abgelaufen");
  });

  it("Admin kann keine Mitgliedschaft eines anderen Unternehmens ändern", async () => {
    const { orgA, orgB, actorA } = await setup();
    const mB = await db.membership.findFirstOrThrow({ where: { organizationId: orgB } });
    await expect(
      updateMembership(actorA, { organizationId: orgA, membershipId: mB.id, role: "EMPLOYEE" }),
    ).rejects.toThrow("nicht gefunden");
  });

  it("letzter Admin kann nicht herabgestuft werden", async () => {
    const { orgA, actorA } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "m@a.de", role: "ORG_ADMIN", external: false });
    if (inv.kind !== "invited") throw new Error();
    const { userId } = await acceptInvitation(inv.token, { name: "Zweiter", password: PW });
    const second = await db.membership.findFirstOrThrow({ where: { userId } });
    const first = await db.membership.findFirstOrThrow({ where: { userId: actorA.userId } });

    await updateMembership(actorA, { organizationId: orgA, membershipId: second.id, role: "EMPLOYEE" });
    await expect(
      updateMembership(actorA, { organizationId: orgA, membershipId: first.id, role: "EMPLOYEE" }),
    ).rejects.toThrow("mindestens einen");
  });
});

describe("Passwort zurücksetzen", () => {
  it("Admin setzt Passwort eigener Mitarbeiter zurück", async () => {
    const { orgA, actorA } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "m@a.de", role: "EMPLOYEE", external: false });
    if (inv.kind !== "invited") throw new Error();
    const { userId } = await acceptInvitation(inv.token, { name: "M", password: PW });

    const token = await createPasswordReset(actorA, { organizationId: orgA, targetUserId: userId });
    await resetPassword(token, "Neues-Passwort2");
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("Neues-Passwort2", u.passwordHash!)).toBe(true);
    await expect(resetPassword(token, "Noch-eins3")).rejects.toThrow(UserError);
  });

  it("Kunde kann das Konto der externen Sifa nicht übernehmen", async () => {
    const { orgA, orgB, actorA, actorB } = await setup();
    const inv = await inviteMember(actorA, { organizationId: orgA, email: "sifa@x.de", role: "SAFETY_OFFICER", external: true });
    if (inv.kind !== "invited") throw new Error();
    const { userId } = await acceptInvitation(inv.token, { name: "Sifa", password: PW });
    await inviteMember(actorB, { organizationId: orgB, email: "sifa@x.de", role: "SAFETY_OFFICER", external: true });

    await expect(
      createPasswordReset(actorA, { organizationId: orgA, targetUserId: userId }),
    ).rejects.toThrow("anderen Unternehmen");
  });
});
