import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDateTime, nowWallClock, toInputDateTime } from "@/lib/dates";
import { PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/contractors";
import { requireOrg } from "@/lib/session";
import { request } from "./actions";

export const metadata = { title: "Erlaubnisscheine" };

export default async function PermitsPage() {
  const ctx = await requireOrg("permits.request");
  const orgId = ctx.organization.id;
  const [list, sites, contractors] = await Promise.all([
    db.permit.findMany({ where: { organizationId: orgId }, include: { contractor: true, site: true }, orderBy: { validFrom: "desc" }, take: 100 }),
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    db.contractor.findMany({ where: { organizationId: orgId, blocked: false }, include: { workers: { where: { active: true }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
  ]);
  const start = nowWallClock();
  const end = new Date(start.getTime() + 8 * 3600 * 1000);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Erlaubnisscheine</h1>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Nr.</th><th>Art</th><th>Ort</th><th>Fremdfirma</th><th>Zeitraum</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/permits/${p.id}`} className="font-mono text-[var(--brand)] hover:underline">{p.number}</Link></td>
                <td>{PERMIT_TYPE_LABELS[p.type]}</td>
                <td>{[p.site?.name, p.location].filter(Boolean).join(" · ")}</td>
                <td>{p.contractor?.name ?? "eigenes Personal"}</td>
                <td className="text-xs">{formatDateTime(p.validFrom)} – {formatDateTime(p.validTo).slice(-5)}</td>
                <td>{PERMIT_STATUS_LABELS[p.status]}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Keine Erlaubnisscheine</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Erlaubnisschein beantragen</h2>
        <ActionForm action={request} submitLabel="Beantragen">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label">Art der Arbeiten *</label><select name="type" className="input">{Object.entries(PERMIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Standort</label><select name="siteId" className="input"><option value="">–</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="sm:col-span-3"><label className="label">Ort / Bereich *</label><input name="location" required className="input" /></div>
            <div className="sm:col-span-3"><label className="label">Beschreibung der Arbeiten *</label><textarea name="description" required rows={2} className="input" /></div>
            <div><label className="label">Beginn *</label><input name="validFrom" type="datetime-local" required defaultValue={toInputDateTime(start)} className="input" /></div>
            <div><label className="label">Ende * (max. 24 h)</label><input name="validTo" type="datetime-local" required defaultValue={toInputDateTime(end)} className="input" /></div>
            <div><label className="label">Fremdfirma</label><select name="contractorId" className="input"><option value="">– eigenes Personal –</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          {contractors.some((c) => c.workers.length) && (
            <fieldset>
              <legend className="label">Ausführende der Fremdfirma</legend>
              <div className="grid gap-1 text-sm sm:grid-cols-3">{contractors.flatMap((c) => c.workers.map((w) => <label key={w.id} className="flex items-center gap-2"><input type="checkbox" name="workerIds" value={w.id} /> {w.name} <span className="text-xs text-slate-500">({c.name})</span></label>))}</div>
            </fieldset>
          )}
        </ActionForm>
      </section>
    </div>
  );
}
