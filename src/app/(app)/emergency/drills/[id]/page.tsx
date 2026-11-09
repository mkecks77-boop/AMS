import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionsPanel } from "@/components/ActionsPanel";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { DRILL_KIND_LABELS } from "@/lib/emergency";
import { requireOrg } from "@/lib/session";
import { evaluate } from "../../actions";

export const metadata = { title: "Notfallübung" };

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("emergency.view");
  const { id } = await params;
  const d = await db.drill.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { site: true, actions: { include: { responsible: true }, orderBy: { dueDate: "asc" } } } });
  if (!d) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{DRILL_KIND_LABELS[d.kind]} · {d.site.name}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{d.performedAt ? `ausgewertet ${formatDate(d.performedAt)}` : `geplant ${formatDate(d.plannedAt)}`}{!d.announced && " · unangekündigt"}</span>
      </div>
      {d.scenario && <p className="text-sm">Szenario: {d.scenario}</p>}
      {d.performedAt ? (
        <section className="card space-y-2 text-sm">
          <p>Teilnehmende: <strong>{d.participants ?? "–"}</strong> · Zeit bis zur vollständigen Räumung: <strong>{d.evacuationMinutes != null ? `${d.evacuationMinutes} min` : "–"}</strong></p>
          <p className="whitespace-pre-line">{d.observations}</p>
        </section>
      ) : ctx.can("emergency.manage") && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Auswertung</h2>
          <ActionForm action={evaluate} submitLabel="Auswertung speichern">
            <input type="hidden" name="id" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">durchgeführt am *</label><input name="performedAt" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">Teilnehmende</label><input name="participants" type="number" min={0} className="input" /></div>
              <div><label className="label">Räumungszeit (Minuten)</label><input name="evacuationMinutes" type="number" min={0} className="input" /></div>
            </div>
            <div><label className="label">Beobachtungen *</label><textarea name="observations" required rows={5} className="input" placeholder={"Alarm überall hörbar? Fluchtwege frei? Sammelplatz erreicht, Vollzähligkeit geprüft? Mobilitätseingeschränkte Personen berücksichtigt? Was lief gut, was nicht?"} /></div>
          </ActionForm>
        </section>
      )}
      <ActionsPanel organizationId={ctx.organization.id} actions={d.actions} source={{ drillId: d.id, sourceType: "DRILL" }} back={`/emergency/drills/${d.id}`} canManage={ctx.can("actions.manage")} />
      <AttachmentsPanel ctx={ctx} entityType="DRILL" entityId={d.id} back={`/emergency/drills/${d.id}`} title="Fotos und Protokolle" />
    </div>
  );
}
