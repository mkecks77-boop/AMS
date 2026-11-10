import Link from "next/link";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { countByStatus, getDeadlines } from "@/lib/deadlines";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Übersicht" };

const PLANNED = [
  "Arbeitsunfälle & Verbandbuch",
  "Schulungen & Qualifikationen",
  "Gefahrstoffverzeichnis",
  "Betriebsanweisungen",
  "Gefährdungsbeurteilungen",
  "Maßnahmen",
];

export default async function Dashboard() {
  const ctx = await requireOrg("dashboard.view");
  const orgId = ctx.organization.id;
  const showDeadlines = ctx.can("deadlines.view");
  const in90 = new Date();
  in90.setUTCDate(in90.getUTCDate() + 90);

  const [members, equipmentCount, locked, deadlines] = await Promise.all([
    db.membership.count({ where: { organizationId: orgId, active: true } }),
    db.equipment.count({ where: { organizationId: orgId, status: { notIn: ["SCRAPPED", "DECOMMISSIONED"] } } }),
    db.equipment.findMany({ where: { organizationId: orgId, status: "LOCKED" }, orderBy: { inventoryNumber: "asc" } }),
    showDeadlines ? getDeadlines(orgId, { until: in90 }) : Promise.resolve([]),
  ]);
  const counts = countByStatus(deadlines);
  const urgent = deadlines.filter((d) => d.status === "overdue" || d.status === "due30").slice(0, 10);

  const tiles = [
    { label: "Überfällige Prüfungen", value: counts.overdue, href: "/deadlines?status=overdue", alert: counts.overdue > 0, show: showDeadlines },
    { label: "Fällig in 30 Tagen", value: counts.due30, href: "/deadlines?status=due30", show: showDeadlines },
    { label: "Gesperrte Anlagen", value: locked.length, href: "/equipment?status=LOCKED", alert: locked.length > 0, show: true },
    { label: "Anlagen in Betrieb", value: equipmentCount, href: "/equipment", show: true },
    { label: "Aktive Nutzer", value: members, href: "/users", show: ctx.can("users.manage") },
  ].filter((t) => t.show);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{ctx.organization.name}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <p className="text-sm text-slate-500">Keine überfälligen oder in den nächsten 30 Tagen fälligen Prüfungen.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {urgent.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-24">{formatDate(d.dueAt)}</span>
                  <DueBadge status={d.status} />
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
