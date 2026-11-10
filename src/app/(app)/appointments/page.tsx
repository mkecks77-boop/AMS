import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { APPOINTMENT_ROLES } from "@/lib/appointments";
import { requireOrg } from "@/lib/session";
import { create, step } from "./actions";

export const metadata = { title: "Beauftragte" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ ended?: string }> }) {
  const ctx = await requireOrg("appointments.view");
  const orgId = ctx.organization.id;
  const { ended } = await searchParams;
  const [list, employees, sites] = await Promise.all([
    db.appointment.findMany({ where: { organizationId: orgId, ...(ended ? {} : { endedAt: null }) }, include: { employee: true, site: true }, orderBy: [{ role: "asc" }, { appointedAt: "desc" }] }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const manage = ctx.can("appointments.manage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Beauftragte & Pflichtenübertragungen</h1>
      <section className="card overflow-x-auto">
        <form className="mb-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ended" defaultChecked={!!ended} /> auch beendete <button className="btn-secondary ml-2">Anzeigen</button></label></form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Funktion</th><th>Person</th><th>Bereich</th><th>seit</th><th>bis</th><th>Schriftlich</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className={`border-t border-slate-100 ${a.endedAt ? "text-slate-400" : ""}`}>
                <td className="py-2">{APPOINTMENT_ROLES[a.role]?.label ?? a.role}</td>
                <td>{a.employee.lastName}, {a.employee.firstName}</td>
                <td>{[a.site?.name, a.scope].filter(Boolean).join(" · ") || "–"}</td>
                <td>{formatDate(a.appointedAt)}</td>
                <td>{a.endedAt ? `beendet ${formatDate(a.endedAt)}` : formatDate(a.validUntil)}</td>
                <td>{a.signed ? "✓" : manage && !a.endedAt ? <form action={step}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="step" value="sign" /><button className="text-xs text-[var(--brand)] hover:underline">unterschrieben</button></form> : <span className="text-amber-700">offen</span>}</td>
                <td className="flex gap-3 py-2">
                  <a href={`/print/appointments/${a.id}`} target="_blank" className="text-xs text-[var(--brand)] hover:underline">Urkunde</a>
                  {manage && !a.endedAt && <form action={step}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="step" value="end" /><button className="text-xs text-slate-600 hover:underline">beenden</button></form>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine Beauftragungen</td></tr>}
          </tbody>
        </table>
      </section>
      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Neue Beauftragung</h2>
          <ActionForm action={create} submitLabel="Erfassen">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Funktion *</label><select name="role" className="input">{Object.entries(APPOINTMENT_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="label">Person *</label><select name="employeeId" required className="input">{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div><label className="label">Standort</label><select name="siteId" className="input"><option value="">–</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="sm:col-span-3"><label className="label">Verantwortungsbereich / übertragene Aufgaben (bei Pflichtenübertragung Pflicht)</label><textarea name="scope" rows={2} className="input" /></div>
              <div><label className="label">ab *</label><input name="appointedAt" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">befristet bis</label><input name="validUntil" type="date" className="input" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="signed" /> schriftlich unterschrieben</label>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
