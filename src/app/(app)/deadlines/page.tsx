import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { DUE_LABELS, formatDate, type DueStatus } from "@/lib/dates";
import { countByStatus, getDeadlines, groupByMonth } from "@/lib/deadlines";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Fristenkalender" };

const MONTH = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; status?: string; range?: string }>;
}) {
  const { organization } = await requireOrg("deadlines.view");
  const { site = "", status = "", range = "12" } = await searchParams;
  const months = ["3", "12", "24"].includes(range) ? Number(range) : 12;
  const until = new Date();
  until.setUTCMonth(until.getUTCMonth() + months);

  const [all, sites] = await Promise.all([
    getDeadlines(organization.id, { siteId: site || null, until }),
    db.site.findMany({ where: { organizationId: organization.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  const counts = countByStatus(all);
  const items = status in DUE_LABELS ? all.filter((d) => d.status === status) : all;
  const qs = new URLSearchParams({ site, range: String(months) }).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fristenkalender</h1>
        <a href={`/deadlines/export?${qs}`} className="btn-secondary">Als CSV exportieren</a>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(DUE_LABELS) as DueStatus[]).map((s) => (
          <Link
            key={s}
            href={`/deadlines?${new URLSearchParams({ site, range: String(months), status: status === s ? "" : s })}`}
            className={`card !p-4 ${status === s ? "ring-2 ring-[var(--brand)]" : ""}`}
          >
            <DueBadge status={s} />
            <p className="mt-2 text-3xl font-semibold">{counts[s]}</p>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-3">
        <select name="site" defaultValue={site} className="input w-auto">
          <option value="">alle Standorte</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="range" defaultValue={String(months)} className="input w-auto">
          <option value="3">nächste 3 Monate</option>
          <option value="12">nächste 12 Monate</option>
          <option value="24">nächste 24 Monate</option>
        </select>
        <input type="hidden" name="status" value={status} />
        <button className="btn-secondary">Anzeigen</button>
      </form>

      {items.length === 0 && <p className="card text-sm text-slate-500">Keine Fristen im gewählten Zeitraum.</p>}
      {groupByMonth(items).map(([month, list]) => (
        <section key={month} className="card overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold">{MONTH.format(new Date(`${month}-01T00:00:00Z`))}</h2>
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <tbody>
              {list.map((d) => (
                <tr key={`${d.source}-${d.id}`} className="border-t border-slate-100 first:border-0">
                  <td className="w-28 py-2">{formatDate(d.dueAt)}</td>
                  <td className="w-36"><DueBadge status={d.status} /></td>
                  <td className="w-24 text-slate-500">{d.sourceLabel}</td>
                  <td>
                    <Link href={d.href} className="font-medium text-[var(--brand)] hover:underline">{d.title}</Link>
                    <span className="block text-xs text-slate-500">{d.subject}</span>
                  </td>
                  <td className="w-32">{d.siteName ?? "–"}</td>
                  <td className="w-36 text-red-700">{d.info ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
