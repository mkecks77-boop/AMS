import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { countByStatus, getDeadlines } from "@/lib/deadlines";
import { requireOrg } from "@/lib/session";
import { getMatrix, quotaReport } from "@/lib/trainings";

export const metadata = { title: "Übersicht" };

const PLANNED = [
  "Gefährdungsbeurteilungen",
];

export default async function Dashboard() {
  const ctx = await requireOrg("dashboard.view");
  const orgId = ctx.organization.id;
  const showDeadlines = ctx.can("deadlines.view");
  const in90 = new Date();
  in90.setUTCDate(in90.getUTCDate() + 90);

  const matrix = ctx.can("trainings.view") ? await getMatrix(orgId) : null;
  const quota = ctx.can("trainings.view") ? await quotaReport(orgId) : [];
  const quotaGaps = quota.filter((q) => q.firstAid < q.firstAidRequired || q.fireWarden < q.fireWardenRequired).length;
  const [openIncidents, overdueActions, lastAccident] = await Promise.all([
    ctx.can("incidents.view") ? db.incident.count({ where: { organizationId: orgId, status: { not: "CLOSED" } } }) : 0,
    ctx.can("actions.view") ? db.action.count({ where: { organizationId: orgId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } }) : 0,
    ctx.can("incidents.view") ? db.incident.findFirst({ where: { organizationId: orgId, type: "ACCIDENT", lostDays: { gt: 0 } }, orderBy: { occurredAt: "desc" } }) : null,
  ]);
  const daysWithout = lastAccident ? Math.floor((Date.now() - lastAccident.occurredAt.getTime()) / 86400000) : null;
  const [requested, baInReview, missingBa, members, equipmentCount, locked, deadlines] = await Promise.all([
    ctx.can("substances.approve") ? db.hazardousSubstance.count({ where: { organizationId: orgId, status: "REQUESTED" } }) : 0,
    ctx.can("instructions.release") ? db.operatingInstruction.count({ where: { organizationId: orgId, status: "IN_REVIEW" } }) : 0,
    ctx.can("instructions.edit")
      ? db.hazardousSubstance.count({ where: { organizationId: orgId, status: "APPROVED", instructions: { none: { status: "RELEASED" } } } })
      : 0,
    db.membership.count({ where: { organizationId: orgId, active: true } }),
    db.equipment.count({ where: { organizationId: orgId, status: { notIn: ["SCRAPPED", "DECOMMISSIONED"] } } }),
    db.equipment.findMany({ where: { organizationId: orgId, status: "LOCKED" }, orderBy: { inventoryNumber: "asc" } }),
    showDeadlines ? getDeadlines(orgId, { until: in90 }) : Promise.resolve([]),
  ]);
  const counts = countByStatus(deadlines);
  const urgent = deadlines.filter((d) => d.status === "overdue" || d.status === "due30").slice(0, 10);

  const tiles = [
    { label: "Überfällige Fristen", value: counts.overdue, href: "/deadlines?status=overdue", alert: counts.overdue > 0, show: showDeadlines },
    { label: "Fällig in 30 Tagen", value: counts.due30, href: "/deadlines?status=due30", show: showDeadlines },
    { label: "Gesperrte Anlagen", value: locked.length, href: "/equipment?status=LOCKED", alert: locked.length > 0, show: true },
    { label: "Anlagen in Betrieb", value: equipmentCount, href: "/equipment", show: true },
    { label: "Tage ohne Ausfallunfall", value: daysWithout ?? "–", href: "/incidents/stats", show: ctx.can("incidents.view") },
    { label: "Offene Meldungen", value: openIncidents, href: "/incidents?open=1", alert: openIncidents > 0, show: ctx.can("incidents.view") },
    { label: "Überfällige Maßnahmen", value: overdueActions, href: "/actions?overdue=1", alert: overdueActions > 0, show: ctx.can("actions.view") },
    { label: "Gefahrstoff-Anträge", value: requested, href: "/substances?status=REQUESTED", alert: requested > 0, show: ctx.can("substances.approve") },
    { label: "BA zur Freigabe", value: baInReview, href: "/instructions?status=IN_REVIEW", show: ctx.can("instructions.release") },
    { label: "Gefahrstoffe ohne gültige BA", value: missingBa, href: "/substances", alert: missingBa > 0, show: ctx.can("instructions.edit") },
    { label: "Unterweisungsquote", value: matrix ? `${matrix.rate} %` : "–", href: "/trainings/matrix", alert: !!matrix && matrix.rate < 90, show: !!matrix },
    { label: "Standorte mit Quotenlücke (EH/BSH)", value: quotaGaps, href: "/qualifications", alert: quotaGaps > 0, show: !!matrix },
    { label: "Aktive Nutzer", value: members, href: "/users", show: ctx.can("users.manage") },
  ].filter((t) => t.show);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{ctx.organization.name}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`card !p-4 ${t.alert ? "border-red-300 bg-red-50" : ""}`}>
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className={`text-3xl font-semibold ${t.alert ? "text-red-700" : ""}`}>{t.value}</p>
          </Link>
        ))}
      </div>

      {showDeadlines && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dringende Fristen</h2>
            <Link href="/deadlines" className="text-sm text-[var(--brand)] hover:underline">Alle Fristen</Link>
          </div>
          {urgent.length === 0 ? (
            <p className="text-sm text-slate-500">Keine überfälligen oder in den nächsten 30 Tagen fälligen Fristen.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {urgent.map((d) => (
                <li key={`${d.source}-${d.id}`} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-24">{formatDate(d.dueAt)}</span>
                  <DueBadge status={d.status} />
                  <span className="text-slate-500">{d.sourceLabel}</span>
                  <Link href={d.href} className="font-medium text-[var(--brand)] hover:underline">{d.title}</Link>
                  <span className="text-slate-500">{d.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Weitere Module (in Vorbereitung)</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED.map((m) => (
            <li key={m} className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">{m}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
