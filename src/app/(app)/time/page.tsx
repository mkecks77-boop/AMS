import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { formatHours, TIME_CATEGORIES, timeSummary } from "@/lib/timelog";
import { add, remove, setTarget } from "./actions";

export const metadata = { title: "Einsatzzeit" };

export default async function TimePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireOrg("reports.view");
  const year = Number((await searchParams).year) || new Date().getUTCFullYear();
  const orgId = ctx.organization.id;
  const [summary, org, entries] = await Promise.all([
    timeSummary(orgId, year),
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.timeEntry.findMany({ where: { organizationId: orgId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, include: { user: true }, orderBy: { date: "desc" }, take: 200 }),
  ]);
  const target = org.sifaHoursTarget;
  const pct = target ? Math.min(100, Math.round((summary.total / 60 / target) * 100)) : null;
  const canLog = ctx.can("time.log");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Einsatzzeit Fachkraft für Arbeitssicherheit {year}</h1>
        <form className="flex gap-2"><select name="year" defaultValue={String(year)} className="input w-auto">{Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - i).map((y) => <option key={y}>{y}</option>)}</select><button className="btn-secondary">Anzeigen</button></form>
      </div>
      <section className="card space-y-3">
        <p className="text-lg">Geleistet: <strong>{formatHours(summary.total)}</strong>{target ? <> von {target} h Soll (DGUV Vorschrift 2)</> : null}</p>
        {pct != null && <div className="h-3 w-full rounded bg-slate-100"><div className="h-3 rounded bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div>}
        <ul className="grid gap-1 text-sm sm:grid-cols-2">{summary.byCategory.map((c) => <li key={c.category}>{TIME_CATEGORIES[c.category]}: <strong>{formatHours(c.minutes)}</strong></li>)}</ul>
        <ActionForm action={setTarget} submitLabel="Soll speichern" buttonClassName="btn-secondary" className="flex flex-wrap items-end gap-3">
          <div><label className="label">Soll-Einsatzzeit (Stunden/Jahr)</label><input name="target" type="number" min={0} defaultValue={target ?? ""} className="input w-40" /></div>
        </ActionForm>
      </section>
      {canLog && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Tätigkeit erfassen</h2>
          <ActionForm action={add} submitLabel="Erfassen">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><label className="label">Datum *</label><input name="date" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">Stunden *</label><input name="hours" inputMode="decimal" required placeholder="1,5" className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Aufgabenfeld *</label><select name="category" className="input">{Object.entries(TIME_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="sm:col-span-4"><label className="label">Beschreibung</label><input name="description" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      )}
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Datum</th><th>Person</th><th>Aufgabenfeld</th><th>Dauer</th><th>Beschreibung</th><th /></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="py-2">{formatDate(e.date)}</td><td>{e.user.name}</td><td>{TIME_CATEGORIES[e.category] ?? e.category}</td><td>{formatHours(e.minutes)}</td><td>{e.description}</td>
                <td>{e.userId === ctx.user.id && <form action={remove}><input type="hidden" name="id" value={e.id} /><button className="text-xs text-red-700 hover:underline">löschen</button></form>}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Keine Einträge</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
