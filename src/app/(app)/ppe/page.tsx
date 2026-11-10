import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { ensureDefaultPpe, PPE_CATEGORIES } from "@/lib/ppe";
import { requireOrg } from "@/lib/session";
import { addItem, issue, ppeStep } from "./actions";

export const metadata = { title: "PSA" };

export default async function PpePage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const ctx = await requireOrg("ppe.view");
  const orgId = ctx.organization.id;
  const { employee = "" } = await searchParams;
  await ensureDefaultPpe(orgId);
  const [items, employees, issues] = await Promise.all([
    db.ppeItem.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.ppeIssue.findMany({ where: { returnedAt: null, item: { organizationId: orgId }, ...(employee ? { employeeId: employee } : {}) }, include: { item: true, employee: true }, orderBy: [{ employee: { lastName: "asc" } }, { issuedAt: "desc" }] }),
  ]);
  const manage = ctx.can("ppe.manage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Persönliche Schutzausrüstung</h1>
      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">PSA ausgeben</h2>
          <ActionForm action={issue} submitLabel="Ausgabe erfassen">
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2"><label className="label">Person *</label><select name="employeeId" required className="input">{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">PSA *</label><select name="itemId" required className="input">{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
              <div><label className="label">Größe</label><input name="size" className="input" /></div>
              <div><label className="label">Menge</label><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></div>
              <div><label className="label">Ausgabe am *</label><input name="issuedAt" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="receiptSigned" /> Empfang und Unterweisung zur Benutzung schriftlich bestätigt (§ 3 PSA-BV)</label>
            </div>
          </ActionForm>
        </section>
      )}
      <section className="card overflow-x-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ausgegebene PSA ({issues.length})</h2>
          <form className="flex gap-2"><select name="employee" defaultValue={employee} className="input w-auto"><option value="">alle Personen</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select><button className="btn-secondary">Filtern</button></form>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Person</th><th>PSA</th><th>Größe / Menge</th><th>Ausgabe</th><th>Austausch</th><th>Empfang</th><th /></tr></thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2">{i.employee.lastName}, {i.employee.firstName}</td>
                <td>{i.item.name}{i.item.inspectionRequired && <span className="ml-1 text-xs text-amber-700">(prüfpflichtig)</span>}</td>
                <td>{[i.size, `${i.quantity}×`].filter(Boolean).join(" · ")}</td>
                <td>{formatDate(i.issuedAt)}</td>
                <td>{i.replaceDue ? <span className="flex items-center gap-2">{formatDate(i.replaceDue)}{classifyDue(i.replaceDue) !== "ok" && <DueBadge status={classifyDue(i.replaceDue)} />}</span> : "nach Verschleiß"}</td>
                <td>{i.receiptSigned ? "✓" : manage ? <form action={ppeStep}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="step" value="receipt" /><button className="text-xs text-[var(--brand)] hover:underline">bestätigen</button></form> : <span className="text-amber-700">offen</span>}</td>
                <td>{manage && <form action={ppeStep}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="step" value="return" /><button className="text-xs text-slate-600 hover:underline">zurückgegeben</button></form>}</td>
              </tr>
            ))}
            {issues.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine offenen Ausgaben</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">PSA-Katalog</h2>
        <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">{items.map((i) => <li key={i.id}>{i.name} <span className="text-slate-500">· {i.category}{i.standard && ` · ${i.standard}`}{i.replaceMonths && ` · Austausch nach ${i.replaceMonths} Monaten`}</span></li>)}</ul>
        {manage && (
          <ActionForm action={addItem} submitLabel="PSA hinzufügen" className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <div className="sm:col-span-2"><label className="label">Bezeichnung *</label><input name="name" required className="input" /></div>
            <div><label className="label">Kategorie</label><select name="category" className="input">{PPE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Norm</label><input name="standard" className="input" /></div>
            <div><label className="label">Austausch (Monate)</label><input name="replaceMonths" type="number" min={1} className="input" /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-5"><input type="checkbox" name="inspectionRequired" /> regelmäßige Prüfung durch Sachkundige erforderlich</label>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
