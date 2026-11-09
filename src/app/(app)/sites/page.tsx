import { ActionForm } from "@/components/ActionForm";
import { Field, SelectField } from "@/components/Field";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { addDepartment, addSite, toggle } from "./actions";

export const metadata = { title: "Standorte & Abteilungen" };

function ToggleButton({ kind, id, active }: { kind: string; id: string; active: boolean }) {
  return (
    <form action={toggle}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button className="btn-secondary">{active ? "Deaktivieren" : "Aktivieren"}</button>
    </form>
  );
}

export default async function SitesPage() {
  const { organization } = await requireOrg("masterdata.manage");
  const where = { organizationId: organization.id };
  const [sites, departments] = await Promise.all([
    db.site.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { employees: true, equipment: true } } } }),
    db.department.findMany({ where, orderBy: { name: "asc" }, include: { site: true, _count: { select: { employees: true } } } }),
  ]);
  const siteOptions = sites.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Standorte & Abteilungen</h1>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Standorte</h2>
          <ActionForm action={addSite} submitLabel="Standort anlegen">
            <Field label="Name" name="name" required />
            <Field label="Adresse" name="address" />
          </ActionForm>
          <ul className="divide-y divide-slate-100 text-sm">
            {sites.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span className={s.active ? "" : "text-slate-400 line-through"}>
                  <strong>{s.name}</strong>{s.address && ` · ${s.address}`}
                  <span className="block text-xs text-slate-500">{s._count.employees} Mitarbeiter · {s._count.equipment} Anlagen</span>
                </span>
                <ToggleButton kind="site" id={s.id} active={s.active} />
              </li>
            ))}
          </ul>
        </section>
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Abteilungen</h2>
          <ActionForm action={addDepartment} submitLabel="Abteilung anlegen">
            <Field label="Name" name="name" required />
            <SelectField label="Standort" name="siteId" options={siteOptions} empty="– standortübergreifend –" />
          </ActionForm>
          <ul className="divide-y divide-slate-100 text-sm">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span className={d.active ? "" : "text-slate-400 line-through"}>
                  <strong>{d.name}</strong>{d.site && ` · ${d.site.name}`}
                  <span className="block text-xs text-slate-500">{d._count.employees} Mitarbeiter</span>
                </span>
                <ToggleButton kind="department" id={d.id} active={d.active} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
