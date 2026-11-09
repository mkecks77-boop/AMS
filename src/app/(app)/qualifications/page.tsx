import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { ensureDefaultQualificationTypes, QUAL_CATEGORY_LABELS, quotaReport } from "@/lib/trainings";
import { addQual, addType, removeQual, saveRates } from "./actions";

export const metadata = { title: "Qualifikationen" };

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireOrg("trainings.view");
  const orgId = ctx.organization.id;
  const { type = "" } = await searchParams;
  await ensureDefaultQualificationTypes(orgId);
  const [types, employees, quals, quota, org] = await Promise.all([
    db.qualificationType.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.qualification.findMany({
      where: { employee: { organizationId: orgId, active: true }, ...(type ? { typeId: type } : {}) },
      include: { type: true, employee: true },
      orderBy: [{ type: { name: "asc" } }, { employee: { lastName: "asc" } }],
    }),
    quotaReport(orgId),
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
  ]);
  const manage = ctx.can("trainings.manage");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Qualifikationen & Befähigungen</h1>

      <section className="card overflow-x-auto">
        <h2 className="mb-1 text-lg font-semibold">Ersthelfer- und Brandschutzhelferquote</h2>
        <p className="mb-4 text-sm text-slate-500">Ersthelfer {org.firstAidRate} % (DGUV V1 § 26), Brandschutzhelfer {org.fireWardenRate} % (ASR A2.2) der Beschäftigten – je Standort, nur gültige Nachweise.</p>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Standort</th><th>Beschäftigte</th><th>Ersthelfer (Ist / Soll)</th><th>Brandschutzhelfer (Ist / Soll)</th></tr></thead>
          <tbody>
            {quota.map((q) => (
              <tr key={q.site} className="border-t border-slate-100">
                <td className="py-2">{q.site}</td>
                <td>{q.employees}</td>
                <td className={q.firstAid < q.firstAidRequired ? "font-semibold text-red-700" : "text-emerald-700"}>{q.firstAid} / {q.firstAidRequired}</td>
                <td className={q.fireWarden < q.fireWardenRequired ? "font-semibold text-red-700" : "text-emerald-700"}>{q.fireWarden} / {q.fireWardenRequired}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ctx.can("masterdata.manage") && (
          <ActionForm action={saveRates} submitLabel="Quoten speichern" className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Ersthelferquote</label>
              <select name="firstAidRate" defaultValue={String(org.firstAidRate)} className="input w-auto">
                <option value="5">5 % (Verwaltung, Handel)</option><option value="10">10 % (sonstige Betriebe)</option>
              </select>
            </div>
            <div><label className="label">Brandschutzhelfer %</label><input name="fireWardenRate" type="number" defaultValue={org.fireWardenRate} className="input w-24" /></div>
          </ActionForm>
        )}
      </section>

      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Qualifikation erfassen</h2>
          <ActionForm action={addQual} submitLabel="Erfassen">
            <div className="grid gap-4 sm:grid-cols-5">
              <div className="sm:col-span-2">
                <label className="label">Person *</label>
                <select name="employeeId" required className="input">{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Qualifikation *</label>
                <select name="typeId" required className="input">{types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.validityMonths ? ` (${t.validityMonths} Mon.)` : ""}</option>)}</select>
              </div>
              <div><label className="label">Erworben am *</label><input name="acquiredAt" type="date" required max={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">Gültig bis (leer = automatisch)</label><input name="validUntil" type="date" className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Aussteller / Lehrgangsträger</label><input name="issuer" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      )}

      <section className="card overflow-x-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Nachweise ({quals.length})</h2>
          <form className="flex gap-2">
            <select name="type" defaultValue={type} className="input w-auto"><option value="">alle Arten</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <button className="btn-secondary">Filtern</button>
          </form>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Person</th><th>Qualifikation</th><th>Erworben</th><th>Gültig bis</th><th>Aussteller</th><th /></tr></thead>
          <tbody>
            {quals.map((q) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td className="py-2">{q.employee.lastName}, {q.employee.firstName}</td>
                <td>{q.type.name}</td>
                <td>{formatDate(q.acquiredAt)}</td>
                <td>{q.validUntil ? <span className="flex items-center gap-2">{formatDate(q.validUntil)} <DueBadge status={classifyDue(q.validUntil)} /></span> : "unbegrenzt"}</td>
                <td>{q.issuer ?? "–"}</td>
                <td>{manage && <form action={removeQual}><input type="hidden" name="id" value={q.id} /><button className="text-xs text-red-700 hover:underline">entfernen</button></form>}</td>
              </tr>
            ))}
            {quals.length === 0 && <tr><td colSpan={6} className="py-4 text-slate-500">Keine Nachweise</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Qualifikationsarten</h2>
        <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
          {types.map((t) => <li key={t.id}>{t.name} · {t.validityMonths ? `${t.validityMonths} Monate` : "unbegrenzt"} · {QUAL_CATEGORY_LABELS[t.category]}{t.legalBasis && <span className="text-slate-500"> · {t.legalBasis}</span>}</li>)}
        </ul>
        {manage && (
          <ActionForm action={addType} submitLabel="Art hinzufügen" className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <div className="sm:col-span-2"><label className="label">Name *</label><input name="name" required className="input" /></div>
            <div><label className="label">Gültigkeit (Monate)</label><input name="validityMonths" type="number" min={1} className="input" /></div>
            <div><label className="label">Kategorie</label><select name="category" className="input">{Object.entries(QUAL_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Rechtsgrundlage</label><input name="legalBasis" className="input" /></div>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
