import { db } from "@/lib/db";

export async function siteAndDepartmentOptions(organizationId: string) {
  const [sites, departments] = await Promise.all([
    db.site.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" }, include: { site: true } }),
  ]);
  return {
    sites: sites.map((s) => ({ value: s.id, label: s.name })),
    departments: departments.map((d) => ({ value: d.id, label: d.site ? `${d.name} (${d.site.name})` : d.name })),
  };
}
