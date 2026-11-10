import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { getMatrix, TRAINING_STATUS_LABELS, type TrainingStatus } from "@/lib/trainings";

export const metadata = { title: "Schulungsmatrix" };

const SHORT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

const CELL: Record<TrainingStatus, string> = {
  missing: "bg-red-500 text-white",
  overdue: "bg-red-500 text-white",
  due30: "bg-amber-400",
  due90: "bg-yellow-200",
  ok: "bg-emerald-500 text-white",
};

export default async function MatrixPage({ searchParams }: { searchParams: Promise<{ site?: string; department?: string }> }) {
  const ctx = await requireOrg("trainings.view");
  const { site = "", department = "" } = await searchParams;
  const orgId = ctx.organization.id;
  const [{ topics, rows, rate }, sites, departments] = await Promise.all([
    getMatrix(orgId, { siteId: site || null, departmentId: department || null }),
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Schulungsmatrix</h1>
        <p className="text-lg">Erfüllungsquote: <strong className={rate < 90 ? "text-red-700" : "text-emerald-700"}>{rate} %</strong></p>
      </div>
      <form className="flex flex-wrap gap-3">
        <select name="site" defaultValue={site} className="input w-auto"><option value="">alle Standorte</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="department" defaultValue={department} className="input w-auto"><option value="">alle Abteilungen</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <button className="btn-secondary">Filtern</button>
      </form>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["ok", "due90", "due30", "overdue"] as TrainingStatus[]).map((s) => <span key={s} className={`rounded px-2 py-0.5 ${CELL[s]}`}>{s === "overdue" ? "fehlt / abgelaufen" : TRAINING_STATUS_LABELS[s]}</span>)}
        <span className="rounded bg-slate-100 px-2 py-0.5">– nicht erforderlich</span>
      </div>
      <section className="card overflow-x-auto !p-0">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white p-2 text-left">Name</th>
              {topics.map((t) => (
                <th key={t.id} className="w-16 px-1 pb-2 align-bottom">
                  <Link href={`/trainings/${t.id}`} title={t.title} className="mx-auto block max-h-48 rotate-180 overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs font-medium [writing-mode:vertical-rl] hover:underline">{t.title}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee: e, cells }) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="sticky left-0 whitespace-nowrap bg-white p-2">{e.lastName}, {e.firstName}{e.apprentice && " (Azubi)"}</td>
                {cells.map((c) => (
                  <td key={c.topicId} className="p-0.5 text-center">
                    {c.required ? (
                      <span title={`${TRAINING_STATUS_LABELS[c.status]}${c.record?.validUntil ? `, gültig bis ${formatDate(c.record.validUntil)}` : ""}`} className={`block h-7 w-16 rounded text-[11px] leading-7 ${CELL[c.status]}`}>
                        {c.record ? (c.record.validUntil ? SHORT.format(c.record.validUntil) : "✓") : "fehlt"}
                      </span>
                    ) : <span className="text-slate-300">–</span>}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-4 text-slate-500">Keine Beschäftigten</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
