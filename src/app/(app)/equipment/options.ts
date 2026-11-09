import { db } from "@/lib/db";

export async function equipmentOptions(organizationId: string) {
  const [sites, employees] = await Promise.all([
    db.site.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  return {
    sites: sites.map((s) => ({ value: s.id, label: s.name })),
    employees: employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` })),
  };
}
