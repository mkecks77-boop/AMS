import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { EmployeeForm } from "./EmployeeForm";
import { siteAndDepartmentOptions } from "./options";

export const metadata = { title: "Mitarbeiter" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const ctx = await requireOrg("masterdata.view");
  const { q = "", all } = await searchParams;
  const orgId = ctx.organization.id;
  const employees = await db.employee.findMany({
    where: {
      organizationId: orgId,
      ...(all ? {} : { active: true }),
      ...(q ? { OR: [
        { lastName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { personnelNumber: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    include: { site: true, department: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const canEdit = ctx.can("masterdata.manage");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
      {canEdit && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Neue Person</h2>
          <p className="mb-4 text-sm text-slate-500">Auch ohne Login – für Unterweisungen, Qualifikationen und Zuständigkeiten.</p>
          <EmployeeForm {...await siteAndDepartmentOptions(orgId)} />
        </section>
      )}
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap items-center gap-3">
          <input name="q" defaultValue={q} placeholder="Name oder Personalnummer" className="input max-w-xs" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all" defaultChecked={!!all} /> auch inaktive</label>
          <button className="btn-secondary">Suchen</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Name</th><th>Pers.-Nr.</th><th>Tätigkeit</th><th>Standort</th><th>Abteilung</th><th>Eintritt</th><th /></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className={`border-t border-slate-100 ${e.active ? "" : "text-slate-400"}`}>
                <td className="py-2 font-medium">
                  {e.lastName}, {e.firstName}
                  {e.apprentice && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">Azubi</span>}
                </td>
                <td>{e.personnelNumber ?? "–"}</td>
                <td>{e.jobTitle ?? "–"}</td>
                <td>{e.site?.name ?? "–"}</td>
                <td>{e.department?.name ?? "–"}</td>
                <td>{formatDate(e.entryDate)}</td>
                <td>{canEdit && <Link href={`/employees/${e.id}`} className="text-[var(--brand)] hover:underline">Bearbeiten</Link>}</td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine Einträge</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
