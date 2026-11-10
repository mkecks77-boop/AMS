import Link from "next/link";
import type { Action, Employee } from "@prisma/client";
import { ActionForm } from "./ActionForm";
import { DueBadge } from "./DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { ACTION_STATUS_LABELS, LEVEL_LABELS, OPEN_STATUSES, PRIORITY_LABELS } from "@/lib/measures";
import { addAction } from "@/app/(app)/actions/actions";

/** Maßnahmenliste + Formular für eine Quelle (Unfall, Begehung, GBU, ASA …) */
export async function ActionsPanel({
  organizationId,
  actions,
  source,
  back,
  canManage,
  defaultTitle,
}: {
  organizationId: string;
  actions: (Action & { responsible: Employee | null })[];
  source: Record<string, string>;
  back: string;
  canManage: boolean;
  defaultTitle?: string;
}) {
  const employees = canManage
    ? await db.employee.findMany({ where: { organizationId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
    : [];
  const in14 = new Date();
  in14.setUTCDate(in14.getUTCDate() + 14);
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">Maßnahmen ({actions.length})</h2>
      {actions.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Maßnahme</th><th>Verantwortlich</th><th>Frist</th><th>Status</th></tr></thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/actions/${a.id}`} className="text-[var(--brand)] hover:underline">{a.title}</Link>{a.level && <span className="ml-2 text-xs text-slate-500">{LEVEL_LABELS[a.level]}</span>}</td>
                <td>{a.responsible ? `${a.responsible.firstName} ${a.responsible.lastName}` : "–"}</td>
                <td><span className="flex items-center gap-2">{formatDate(a.dueDate)}{OPEN_STATUSES.includes(a.status) && classifyDue(a.dueDate) !== "ok" && <DueBadge status={classifyDue(a.dueDate)} />}</span></td>
                <td>{ACTION_STATUS_LABELS[a.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canManage && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">Maßnahme hinzufügen</summary>
          <ActionForm action={addAction} submitLabel="Maßnahme anlegen" className="mt-3 space-y-3">
            {Object.entries(source).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="back" value={back} />
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><label className="label">Maßnahme *</label><input name="title" required defaultValue={defaultTitle} className="input" /></div>
              <div><label className="label">Art (STOP)</label><select name="level" className="input"><option value="">–</option>{Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label">Priorität</label><select name="priority" defaultValue="MEDIUM" className="input">{Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">Verantwortlich</label><select name="responsibleId" className="input"><option value="">–</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div><label className="label">Frist *</label><input name="dueDate" type="date" required defaultValue={toInputDate(in14)} className="input" /></div>
            </div>
            <div><label className="label">Beschreibung</label><textarea name="description" rows={2} className="input" /></div>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
