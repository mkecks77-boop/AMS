import Link from "next/link";
import type { IncidentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, isReportable } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Unfälle & Ereignisse" };

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ year?: string; type?: string; open?: string }> }) {
  const ctx = await requireOrg("incidents.view");
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getUTCFullYear();
  const where: Prisma.IncidentWhereInput = {
    organizationId: ctx.organization.id,
    occurredAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    ...(sp.type && sp.type in INCIDENT_TYPE_LABELS ? { type: sp.type as IncidentType } : {}),
    ...(sp.open ? { status: { not: "CLOSED" } } : {}),
  };
  const items = await db.incident.findMany({ where, include: { employee: true, site: true, _count: { select: { actions: true } } }, orderBy: { occurredAt: "desc" } });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Unfälle & Ereignisse</h1>
        <div className="flex gap-2">
          <Link href={`/incidents/stats?year=${year}`} className="btn-secondary">Kennzahlen</Link>
          {ctx.can("firstaid.view") && <Link href="/firstaid" className="btn-secondary">Verbandbuch</Link>}
          <Link href="/report" className="btn">Neue Meldung</Link>
        </div>
      </div>
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-3">
          <select name="year" defaultValue={String(year)} className="input w-auto">
            {Array.from({ length: 6 }, (_, i) => new Date().getUTCFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="input w-auto"><option value="">alle Arten</option>{Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="open" defaultChecked={!!sp.open} /> nur offene</label>
          <button className="btn-secondary">Filtern</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Nr.</th><th>Zeitpunkt</th><th>Art</th><th>Person</th><th>Verletzung</th><th>Ausfalltage</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/incidents/${i.id}`} className="font-mono text-[var(--brand)] hover:underline">{i.number}</Link></td>
                <td>{formatDateTime(i.occurredAt)}</td>
                <td>{INCIDENT_TYPE_LABELS[i.type]}{isReportable(i) && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">meldepflichtig</span>}</td>
                <td>{i.employee ? `${i.employee.lastName}, ${i.employee.firstName}` : i.personName ?? "–"}</td>
                <td>{i.injury ?? "–"}</td>
                <td>{i.lostDays || "–"}</td>
                <td>{INCIDENT_STATUS_LABELS[i.status]}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine Meldungen</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
