import Link from "next/link";
import type { ActionStatus, Prisma } from "@prisma/client";
import { ActionsPanel } from "@/components/ActionsPanel";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { ACTION_STATUS_LABELS, OPEN_STATUSES, PRIORITY_LABELS, SOURCE_LABELS } from "@/lib/measures";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Maßnahmen" };

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ status?: string; responsible?: string; overdue?: string }> }) {
  const ctx = await requireOrg("actions.view");
  const { status = "", responsible = "", overdue } = await searchParams;
  const orgId = ctx.organization.id;
  const where: Prisma.ActionWhereInput = {
    organizationId: orgId,
    ...(status in ACTION_STATUS_LABELS ? { status: status as ActionStatus } : status === "all" ? {} : { status: { in: OPEN_STATUSES } }),
    ...(responsible ? { responsibleId: responsible } : {}),
    ...(overdue ? { dueDate: { lt: new Date() }, status: { in: OPEN_STATUSES } } : {}),
  };
  const [items, employees, counts] = await Promise.all([
    db.action.findMany({ where, include: { responsible: true, incident: true }, orderBy: [{ dueDate: "asc" }] }),
    db.employee.findMany({ where: { organizationId: orgId, responsibleActions: { some: {} } }, orderBy: { lastName: "asc" } }),
    db.action.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
  ]);
  const count = (s: ActionStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const done = count("DONE") + count("VERIFIED");
  const total = done + count("OPEN") + count("IN_PROGRESS");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Maßnahmen</h1>
        <p className="text-sm">Umsetzungsquote: <strong>{total ? Math.round((done / total) * 100) : 100} %</strong> ({done} von {total})</p>
      </div>
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-3">
          <select name="status" defaultValue={status} className="input w-auto">
            <option value="">offen + in Bearbeitung</option>
            <option value="all">alle</option>
            {Object.entries(ACTION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="responsible" defaultValue={responsible} className="input w-auto">
            <option value="">alle Verantwortlichen</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="overdue" defaultChecked={!!overdue} /> nur überfällige</label>
          <button className="btn-secondary">Filtern</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Maßnahme</th><th>Herkunft</th><th>Priorität</th><th>Verantwortlich</th><th>Frist</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/actions/${a.id}`} className="font-medium text-[var(--brand)] hover:underline">{a.title}</Link></td>
                <td className="text-xs">{SOURCE_LABELS[a.sourceType] ?? a.sourceType}{a.incident && ` ${a.incident.number}`}</td>
                <td>{PRIORITY_LABELS[a.priority]}</td>
                <td>{a.responsible ? `${a.responsible.lastName}, ${a.responsible.firstName}` : "–"}</td>
                <td><span className="flex items-center gap-2">{formatDate(a.dueDate)}{OPEN_STATUSES.includes(a.status) && classifyDue(a.dueDate) !== "ok" && <DueBadge status={classifyDue(a.dueDate)} />}</span></td>
                <td>{ACTION_STATUS_LABELS[a.status]}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Keine Maßnahmen</td></tr>}
          </tbody>
        </table>
      </section>
      {ctx.can("actions.manage") && <ActionsPanel organizationId={orgId} actions={[]} source={{ sourceType: "OTHER" }} back="/actions" canManage />}
    </div>
  );
}
