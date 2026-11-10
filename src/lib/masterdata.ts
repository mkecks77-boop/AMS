import { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { UserError, type Actor } from "./users";

/** Prüft, dass verknüpfte Datensätze zum selben Unternehmen gehören (Mandantentrennung). */
export async function assertOwned(
  organizationId: string,
  refs: { siteId?: string | null; departmentId?: string | null; employeeId?: string | null },
) {
  const checks: Promise<void>[] = [];
  const check = (count: Promise<number>, label: string) =>
    checks.push(count.then((n) => { if (n === 0) throw new UserError(`${label} nicht gefunden.`); }));
  if (refs.siteId) check(db.site.count({ where: { id: refs.siteId, organizationId } }), "Standort");
  if (refs.departmentId) check(db.department.count({ where: { id: refs.departmentId, organizationId } }), "Abteilung");
  if (refs.employeeId) check(db.employee.count({ where: { id: refs.employeeId, organizationId } }), "Mitarbeiter/in");
  await Promise.all(checks);
}

function uniqueError(e: unknown, msg: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new UserError(msg);
  throw e;
}

export async function createSite(actor: Actor, organizationId: string, input: { name: string; address?: string }) {
  if (!input.name) throw new UserError("Bitte einen Namen angeben.");
  const site = await db.site
    .create({ data: { organizationId, name: input.name, address: input.address || null } })
    .catch((e) => uniqueError(e, "Diesen Standort gibt es bereits."));
  await audit({ organizationId, userId: actor.userId, action: "site.created", entity: "Site", entityId: site.id, details: { name: site.name } });
  return site;
}

export async function createDepartment(
  actor: Actor,
  organizationId: string,
  input: { name: string; siteId?: string | null },
) {
  if (!input.name) throw new UserError("Bitte einen Namen angeben.");
  await assertOwned(organizationId, { siteId: input.siteId });
  const dep = await db.department
    .create({ data: { organizationId, name: input.name, siteId: input.siteId || null } })
    .catch((e) => uniqueError(e, "Diese Abteilung gibt es bereits."));
  await audit({ organizationId, userId: actor.userId, action: "department.created", entity: "Department", entityId: dep.id, details: { name: dep.name } });
  return dep;
}

export async function setSiteActive(actor: Actor, organizationId: string, id: string, active: boolean) {
  const r = await db.site.updateMany({ where: { id, organizationId }, data: { active } });
  if (r.count === 0) throw new UserError("Standort nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "site.updated", entity: "Site", entityId: id, details: { active } });
}

export async function setDepartmentActive(actor: Actor, organizationId: string, id: string, active: boolean) {
  const r = await db.department.updateMany({ where: { id, organizationId }, data: { active } });
  if (r.count === 0) throw new UserError("Abteilung nicht gefunden.");
  await audit({ organizationId, userId: actor.userId, action: "department.updated", entity: "Department", entityId: id, details: { active } });
}

export interface EmployeeInput {
  personnelNumber?: string | null;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  apprentice?: boolean;
  entryDate?: Date | null;
  exitDate?: Date | null;
  active?: boolean;
}

function cleanEmployee(input: EmployeeInput) {
  if (!input.firstName || !input.lastName) throw new UserError("Bitte Vor- und Nachnamen angeben.");
  return {
    personnelNumber: input.personnelNumber || null,
    firstName: input.firstName,
    lastName: input.lastName,
    jobTitle: input.jobTitle || null,
    siteId: input.siteId || null,
    departmentId: input.departmentId || null,
    apprentice: !!input.apprentice,
    entryDate: input.entryDate ?? null,
    exitDate: input.exitDate ?? null,
    active: input.active ?? true,
  };
}

export async function saveEmployee(actor: Actor, organizationId: string, id: string | null, input: EmployeeInput) {
  const data = cleanEmployee(input);
  await assertOwned(organizationId, { siteId: data.siteId, departmentId: data.departmentId });
  const msg = "Diese Personalnummer ist bereits vergeben.";
  let employee;
  if (id) {
    const existing = await db.employee.findFirst({ where: { id, organizationId } });
    if (!existing) throw new UserError("Mitarbeiter/in nicht gefunden.");
    employee = await db.employee.update({ where: { id }, data }).catch((e) => uniqueError(e, msg));
  } else {
    employee = await db.employee.create({ data: { ...data, organizationId } }).catch((e) => uniqueError(e, msg));
  }
  await audit({
    organizationId,
    userId: actor.userId,
    action: id ? "employee.updated" : "employee.created",
    entity: "Employee",
    entityId: employee.id,
    details: { name: `${data.firstName} ${data.lastName}` },
  });
  return employee;
}
