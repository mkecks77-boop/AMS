import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, toInputDate } from "@/lib/dates";
import { ACTION_STATUS_LABELS, canTransition, LEVEL_LABELS, PRIORITY_LABELS, SOURCE_LABELS } from "@/lib/measures";
import { requireOrg } from "@/lib/session";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { editAction, setStatus } from "../actions";

export const metadata = { title: "Maßnahme" };

export default async function ActionDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("actions.view");
  const { id } = await params;
  const a = await db.action.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { responsible: true, incident: true } });
  if (!a) notFound();
  const manage = ctx.can("actions.manage");
  const [employees, history] = await Promise.all([
    manage ? db.employee.findMany({ where: { organizationId: ctx.organization.id, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }) : [],
    db.auditLog.findMany({ where: { entity: "Action", entityId: a.id, organizationId: ctx.organization.id }, include: { user: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const next = (Object.keys(ACTION_STATUS_LABELS) as (keyof typeof ACTION_STATUS_LABELS)[]).filter((s) => s !== a.status && canTransition(a.status, s));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{a.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{ACTION_STATUS_LABELS[a.status]}</span>
      </div>
      <section className="card grid gap-2 text-sm sm:grid-cols-2">
        <p>Herkunft: {SOURCE_LABELS[a.sourceType] ?? a.sourceType}{a.incident && <> – <Link className="text-[var(--brand)] hover:underline" href={`/incidents/${a.incident.id}`}>Meldung {a.incident.number}</Link></>}</p>
        <p>Frist: <strong>{formatDate(a.dueDate)}</strong> · Priorität: {PRIORITY_LABELS[a.priority]}</p>
        <p>Verantwortlich: {a.responsible ? `${a.responsible.firstName} ${a.responsible.lastName}` : "–"}</p>
        <p>Art: {a.level ? LEVEL_LABELS[a.level] : "–"}</p>
        {a.description && <p className="sm:col-span-2 whitespace-pre-line">{a.description}</p>}
        {a.completedAt && <p>Erledigt am {formatDate(a.completedAt)}</p>}
        {a.effectivenessNote && <p className="sm:col-span-2">Wirksamkeit / Begründung: {a.effectivenessNote}</p>}
      </section>
      {manage && next.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Status ändern</h2>
          <ActionForm action={setStatus} submitLabel="Übernehmen" className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="id" value={a.id} />
            <div><label className="label">Neuer Status</label><select name="status" className="input">{next.map((s) => <option key={s} value={s}>{ACTION_STATUS_LABELS[s]}</option>)}</select></div>
            <div><label className="label">Wirksamkeitsprüfung / Begründung</label><input name="note" className="input" /></div>
          </ActionForm>
        </section>
      )}
      {manage && (a.status === "OPEN" || a.status === "IN_PROGRESS") && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Bearbeiten</h2>
          <ActionForm action={editAction} submitLabel="Speichern">
            <input type="hidden" name="id" value={a.id} />
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><label className="label">Maßnahme</label><input name="title" defaultValue={a.title} required className="input" /></div>
              <div><label className="label">Art</label><select name="level" defaultValue={a.level ?? ""} className="input"><option value="">–</option>{Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label">Priorität</label><select name="priority" defaultValue={a.priority} className="input">{Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">Verantwortlich</label><select name="responsibleId" defaultValue={a.responsibleId ?? ""} className="input"><option value="">–</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div><label className="label">Frist</label><input name="dueDate" type="date" defaultValue={toInputDate(a.dueDate)} required className="input" /></div>
            </div>
            <div><label className="label">Beschreibung</label><textarea name="description" rows={3} defaultValue={a.description ?? ""} className="input" /></div>
          </ActionForm>
        </section>
      )}
      <section className="card text-sm">
        <h2 className="mb-2 text-lg font-semibold">Verlauf</h2>
        <ul className="space-y-1">{history.map((h) => <li key={h.id}>{formatDateTime(h.createdAt)} · {h.user?.name ?? "System"} · {h.action === "action.status" ? `Status → ${ACTION_STATUS_LABELS[(h.details as { to: keyof typeof ACTION_STATUS_LABELS }).to]}` : h.action === "action.created" ? "angelegt" : "geändert"}</li>)}</ul>
      </section>
      <AttachmentsPanel ctx={ctx} entityType="ACTION" entityId={a.id} back={`/actions/${a.id}`} title="Nachweise" hint="Fotos oder Belege zur Umsetzung." />
    </div>
  );
}
