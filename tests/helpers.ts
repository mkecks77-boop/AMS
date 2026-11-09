import { db } from "@/lib/db";

export async function resetDb() {
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

/** Zwei Unternehmen und ein handelnder Nutzer */
export async function twoOrgs() {
  const user = await db.user.create({ data: { email: "sifa@x.de", name: "Sifa", passwordHash: "x" } });
  const a = await db.organization.create({ data: { name: "A", slug: "a" } });
  const b = await db.organization.create({ data: { name: "B", slug: "b" } });
  return { actor: { userId: user.id, isPlatformAdmin: false }, orgA: a.id, orgB: b.id };
}
