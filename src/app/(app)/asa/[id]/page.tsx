import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionsPanel } from "@/components/ActionsPanel";
import { db } from "@/lib/db";
import { formatDateTime, toInputDateTime } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { save } from "../actions";

export const metadata = { title: "ASA-Sitzung" };

export default async function AsaDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("asa.view");
  const { id } = await params;
  const m = await db.asaMeeting.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { actions: { include: { responsible: true }, orderBy: { dueDate: "asc" } } } });
  if (!m) notFound();
  const editable = ctx.can("asa.manage") && m.status === "PLANNED";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">ASA-Sitzung {formatDateTime(m.date)}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{m.status === "DONE" ? "durchgeführt" : "geplant"}</span>
        <a href={`/print/asa/${m.id}`} target="_blank" className="btn-secondary ml-auto">{m.status === "DONE" ? "Protokoll drucken" : "Einladung drucken"}</a>
      </div>
      <section className="card">
        <ActionForm action={save} submitLabel="Speichern">
          <input type="hidden" name="id" value={m.id} />
          <fieldset disabled={!editable} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Termin</label><input name="date" type="datetime-local" required defaultValue={toInputDateTime(m.date)} className="input" /></div>
              <div><label className="label">Ort</label><input name="location" defaultValue={m.location ?? ""} className="input" /></div>
              <div><label className="label">Teilnehmende</label><input name="participants" defaultValue={m.participants ?? ""} className="input" /></div>
            </div>
            <div><label className="label">Tagesordnung</label><textarea name="agenda" rows={9} defaultValue={m.agenda} className="input font-mono text-xs" /></div>
            <div><label className="label">Protokoll / Ergebnisse</label><textarea name="minutes" rows={10} defaultValue={m.minutes} className="input" placeholder="Zu TOP 1 … Beschlüsse und Maßnahmen bitte zusätzlich unten als Maßnahme anlegen." /></div>
            {editable && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="done" /> Sitzung hat stattgefunden – Protokoll abschließen</label>}
          </fieldset>
        </ActionForm>
      </section>
      <ActionsPanel organizationId={ctx.organization.id} actions={m.actions} source={{ asaMeetingId: m.id, sourceType: "ASA" }} back={`/asa/${m.id}`} canManage={ctx.can("actions.manage")} />
    </div>
  );
}
