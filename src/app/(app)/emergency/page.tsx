import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { DRILL_KIND_LABELS, drillStatus } from "@/lib/emergency";
import { requireOrg } from "@/lib/session";
import { drill, plan } from "./actions";

export const metadata = { title: "Brandschutz & Notfall" };

export default async function EmergencyPage() {
  const ctx = await requireOrg("emergency.view");
  const orgId = ctx.organization.id;
  const [status, drills] = await Promise.all([
    drillStatus(orgId),
    db.drill.findMany({ where: { organizationId: orgId }, include: { site: true }, orderBy: { plannedAt: "desc" }, take: 50 }),
  ]);
  const manage = ctx.can("emergency.manage");
  const F = ({ n, l, v, req }: { n: string; l: string; v?: string | null; req?: boolean }) => (
    <div><label className="label">{l}{req && " *"}</label><input name={n} defaultValue={v ?? ""} required={req} className="input" /></div>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Brandschutz & Notfall</h1>
      {status.length === 0 && <p className="card text-sm text-slate-500">Bitte zuerst Standorte anlegen.</p>}
      {status.map(({ site, plan: p, planned, last, nextDue }) => (
        <section key={site.id} className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{site.name}</h2>
            {p ? <a href={`/print/emergency/${site.id}`} target="_blank" className="btn-secondary ml-auto">Alarmplan drucken (Aushang)</a> : <span className="ml-auto text-sm text-amber-700">Noch kein Alarmplan</span>}
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <p>Sammelplatz: <strong>{p?.assemblyPoint ?? "–"}</strong></p>
            <p>Interner Notruf: <strong>{p?.internalEmergency ?? "–"}</strong> · Feuerwehr/Rettung: <strong>{p?.fireBrigade ?? "112"}</strong></p>
            <p className="flex items-center gap-2">Alarmplan überprüft: {formatDate(p?.reviewedAt)} {p && classifyDue(p.reviewDue) !== "ok" && <DueBadge status={classifyDue(p.reviewDue)} />}</p>
            <p>Letzte Räumungsübung: {last ? formatDate(last.performedAt) : "–"}{last?.evacuationMinutes != null && ` (Räumung in ${last.evacuationMinutes} min)`}</p>
            <p className="flex items-center gap-2">Nächste Übung: {planned ? <Link href={`/emergency/drills/${planned.id}`} className="text-[var(--brand)] hover:underline">{formatDate(planned.plannedAt)}</Link> : formatDate(nextDue)} <DueBadge status={classifyDue(nextDue)} /></p>
          </div>
          {manage && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">{p ? "Alarmplan bearbeiten / als überprüft speichern" : "Alarmplan anlegen"}</summary>
              <ActionForm action={plan} submitLabel="Alarmplan speichern" className="mt-3 space-y-3">
                <input type="hidden" name="siteId" value={site.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <F n="assemblyPoint" l="Sammelplatz" v={p?.assemblyPoint} req />
                  <F n="internalEmergency" l="Interner Notruf (z. B. Pforte)" v={p?.internalEmergency} />
                  <F n="fireBrigade" l="Feuerwehr / Rettungsdienst" v={p?.fireBrigade ?? "112"} />
                  <F n="poisonCenter" l="Giftnotruf" v={p?.poisonCenter} />
                  <F n="dArzt" l="Durchgangsarzt (D-Arzt)" v={p?.dArzt} />
                  <F n="doctorOnDuty" l="Betriebsarzt / Ärztlicher Notdienst" v={p?.doctorOnDuty} />
                  <F n="alarmSignal" l="Alarmsignal" v={p?.alarmSignal} />
                  <F n="firstAidRooms" l="Erste-Hilfe-Raum / Verbandkästen" v={p?.firstAidRooms} />
                  <F n="aedLocations" l="Defibrillator (AED)" v={p?.aedLocations} />
                </div>
                <div><label className="label">Räumungshelfer / Brandschutzhelfer</label><input name="evacuationHelpers" defaultValue={p?.evacuationHelpers ?? ""} className="input" /></div>
                <div><label className="label">Weitere Hinweise</label><textarea name="notes" rows={2} defaultValue={p?.notes ?? ""} className="input" /></div>
              </ActionForm>
            </details>
          )}
        </section>
      ))}
      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Übungen</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Datum</th><th>Standort</th><th>Art</th><th>Teilnehmende</th><th>Räumungszeit</th><th>Status</th></tr></thead>
          <tbody>
            {drills.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/emergency/drills/${d.id}`} className="text-[var(--brand)] hover:underline">{formatDate(d.performedAt ?? d.plannedAt)}</Link></td>
                <td>{d.site.name}</td><td>{DRILL_KIND_LABELS[d.kind]}{!d.announced && " (unangekündigt)"}</td>
                <td>{d.participants ?? "–"}</td><td>{d.evacuationMinutes != null ? `${d.evacuationMinutes} min` : "–"}</td>
                <td>{d.performedAt ? "ausgewertet" : "geplant"}</td>
              </tr>
            ))}
            {drills.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Noch keine Übungen</td></tr>}
          </tbody>
        </table>
        {manage && status.length > 0 && (
          <ActionForm action={drill} submitLabel="Übung planen" className="mt-4 grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><label className="label">Standort</label><select name="siteId" className="input">{status.map((s) => <option key={s.site.id} value={s.site.id}>{s.site.name}</option>)}</select></div>
            <div><label className="label">Art</label><select name="kind" className="input">{Object.entries(DRILL_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Datum</label><input name="plannedAt" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unannounced" /> unangekündigt</label>
            <div className="sm:col-span-4"><label className="label">Szenario</label><input name="scenario" placeholder="z. B. Brand im Lager Halle 2, Treppenhaus Ost verraucht" className="input" /></div>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
