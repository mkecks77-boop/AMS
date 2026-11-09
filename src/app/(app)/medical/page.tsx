import { ActionForm } from "@/components/ActionForm";
import { TrainingStatusBadge } from "@/components/TrainingStatusBadge";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { ensureDefaultMedicalTypes, MEDICAL_KIND_LABELS, medicalOverview, OUTCOME_LABELS } from "@/lib/medical";
import { requireOrg } from "@/lib/session";
import { addType, record, requirements } from "./actions";

export const metadata = { title: "Arbeitsmedizinische Vorsorge" };

export default async function MedicalPage() {
  const ctx = await requireOrg("medical.view");
  const orgId = ctx.organization.id;
  await ensureDefaultMedicalTypes(orgId);
  const [{ types: required, rows }, allTypes, departments, employees] = await Promise.all([
    medicalOverview(orgId),
    db.medicalCheckType.findMany({ where: { organizationId: orgId, active: true }, include: { requirements: { include: { department: true } } }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.department.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const manage = ctx.can("medical.manage");
  const blocked = rows.filter((r) => r.blocked);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Arbeitsmedizinische Vorsorge</h1>
      <p className="text-sm text-slate-600">Vorsorgekartei nach § 3 Abs. 4 ArbMedVV – nur Datum, Anlass und Termin der nächsten Vorsorge. Befunde und Diagnosen werden bewusst nicht gespeichert.</p>
      {blocked.length > 0 && (
        <section className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>Pflichtvorsorge fehlt oder ist abgelaufen – Tätigkeit darf nicht ausgeübt werden (§ 4 Abs. 2 ArbMedVV):</strong>
          <ul className="mt-1 list-disc pl-5">{blocked.map((r) => <li key={r.employee.id}>{r.employee.lastName}, {r.employee.firstName}</li>)}</ul>
        </section>
      )}
      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Übersicht</h2>
        {required.length === 0 ? <p className="text-sm text-slate-500">Noch keinem Anlass Beschäftigte zugeordnet (unten).</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Name</th>{required.map((t) => <th key={t.id} className="text-xs">{t.name}<span className="block font-normal">{MEDICAL_KIND_LABELS[t.kind]}</span></th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee.id} className={`border-t border-slate-100 ${r.blocked ? "bg-red-50" : ""}`}>
                  <td className="py-2">{r.employee.lastName}, {r.employee.firstName}</td>
                  {r.cells.map((c) => <td key={c.typeId}>{c.required && c.status ? <span className="flex flex-col gap-0.5"><TrainingStatusBadge status={c.status} />{c.nextDue && <span className="text-xs text-slate-500">bis {formatDate(c.nextDue)}</span>}</span> : <span className="text-slate-300">–</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Vorsorge erfassen</h2>
          <ActionForm action={record} submitLabel="Erfassen">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><label className="label">Person *</label><select name="employeeId" className="input">{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div><label className="label">Anlass *</label><select name="typeId" className="input">{allTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="label">Datum *</label><input name="date" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">Ergebnis</label><select name="outcome" className="input">{Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
          </ActionForm>
        </section>
      )}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Vorsorgeanlässe und Zuordnung</h2>
        {allTypes.map((t) => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <p><strong>{t.name}</strong> · {MEDICAL_KIND_LABELS[t.kind]} · alle {t.intervalMonths} Monate{t.reason && <span className="text-slate-500"> · {t.reason}</span>}</p>
            <p className="text-xs text-slate-500">Betroffen: {t.requirements.length ? t.requirements.map((r) => r.department?.name ?? "alle Beschäftigten").join(", ") : "–"}</p>
            {manage && (
              <details className="mt-2"><summary className="cursor-pointer text-[var(--brand)]">Zuordnung ändern</summary>
                <ActionForm action={requirements} submitLabel="Speichern" className="mt-2 space-y-2">
                  <input type="hidden" name="typeId" value={t.id} />
                  <label className="flex items-center gap-2"><input type="checkbox" name="allEmployees" defaultChecked={t.requirements.some((r) => !r.departmentId)} /> alle Beschäftigten</label>
                  <div className="flex flex-wrap gap-4">{departments.map((d) => <label key={d.id} className="flex items-center gap-2"><input type="checkbox" name="departmentIds" value={d.id} defaultChecked={t.requirements.some((r) => r.departmentId === d.id)} /> {d.name}</label>)}</div>
                </ActionForm>
              </details>
            )}
          </div>
        ))}
        {manage && (
          <ActionForm action={addType} submitLabel="Anlass hinzufügen" className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><label className="label">Name *</label><input name="name" required className="input" /></div>
            <div><label className="label">Art</label><select name="kind" className="input">{Object.entries(MEDICAL_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Intervall (Monate)</label><input name="intervalMonths" type="number" defaultValue={36} className="input" /></div>
            <div><label className="label">Anlass (Anhang ArbMedVV)</label><input name="reason" className="input" /></div>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
