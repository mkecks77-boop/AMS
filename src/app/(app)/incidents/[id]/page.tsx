import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionsPanel } from "@/components/ActionsPanel";
import { db } from "@/lib/db";
import { formatDate, toInputDate, toInputDateTime } from "@/lib/dates";
import { CAUSE_LABELS, INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, isReportable, reportDueDate } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { saveIncident } from "../actions";

export const metadata = { title: "Meldung" };

export default async function IncidentDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("incidents.view");
  const { id } = await params;
  const orgId = ctx.organization.id;
  const i = await db.incident.findFirst({ where: { id, organizationId: orgId }, include: { actions: { include: { responsible: true }, orderBy: { dueDate: "asc" } } } });
  if (!i) notFound();
  const [sites, employees] = await Promise.all([
    db.site.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId: orgId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const manage = ctx.can("incidents.manage");
  const reportable = isReportable(i);
  const ro = !manage;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Meldung {i.number}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{INCIDENT_TYPE_LABELS[i.type]} · {INCIDENT_STATUS_LABELS[i.status]}</span>
        {(i.type === "ACCIDENT" || i.type === "COMMUTING") && <a href={`/print/incidents/${i.id}`} target="_blank" className="btn-secondary ml-auto">Unfallanzeige (Vorlage) drucken</a>}
      </div>
      {reportable && !i.reportedToBgAt && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Meldepflichtig (Arbeitsunfähigkeit &gt; 3 Tage bzw. tödlich): Unfallanzeige an die Berufsgenossenschaft binnen 3 Tagen – spätestens {formatDate(reportDueDate(i))}. Eine Kopie erhält der Betriebs-/Personalrat; die Fachkraft für Arbeitssicherheit und der Betriebsarzt sind zu informieren (§ 193 SGB VII).
        </p>
      )}

      <section className="card">
        <ActionForm action={saveIncident} submitLabel="Speichern">
          <input type="hidden" name="id" value={i.id} />
          <fieldset disabled={ro} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Art</label><select name="type" defaultValue={i.type} className="input">{Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label">Zeitpunkt</label><input name="occurredAt" type="datetime-local" required defaultValue={toInputDateTime(i.occurredAt)} className="input" /></div>
              <div><label className="label">Standort</label><select name="siteId" defaultValue={i.siteId ?? ""} className="input"><option value="">–</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">Ort / Arbeitsbereich</label><input name="location" defaultValue={i.location ?? ""} className="input" /></div>
              <div><label className="label">Person</label><select name="employeeId" defaultValue={i.employeeId ?? ""} className="input"><option value="">–</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
              <div><label className="label">oder Name</label><input name="personName" defaultValue={i.personName ?? ""} className="input" /></div>
              <div className="sm:col-span-3"><label className="label">Tätigkeit</label><input name="activity" defaultValue={i.activity ?? ""} className="input" /></div>
            </div>
            <div><label className="label">Hergang</label><textarea name="description" required rows={4} defaultValue={i.description} className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div><label className="label">Verletzung</label><input name="injury" defaultValue={i.injury ?? ""} className="input" /></div>
              <div><label className="label">Körperteil</label><input name="bodyPart" defaultValue={i.bodyPart ?? ""} className="input" /></div>
              <div><label className="label">Ausfalltage</label><input name="lostDays" type="number" min={0} defaultValue={i.lostDays} className="input" /></div>
              <div><label className="label">Ersthelfer/in</label><input name="firstAider" defaultValue={i.firstAider ?? ""} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Zeugen</label><input name="witnesses" defaultValue={i.witnesses ?? ""} className="input" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="doctorVisit" defaultChecked={i.doctorVisit} /> Arztbesuch</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="fatal" defaultChecked={i.fatal} /> tödlich</label>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <h2 className="mb-3 font-semibold">Untersuchung</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className="label">Ursachenkategorie</label><select name="causeCategory" defaultValue={i.causeCategory ?? ""} className="input"><option value="">–</option>{Object.entries(CAUSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Unfallanzeige erstattet am</label><input name="reportedToBgAt" type="date" defaultValue={toInputDate(i.reportedToBgAt)} className="input" /></div>
                <div><label className="label">Status</label><select name="status" defaultValue={i.status} className="input">{Object.entries(INCIDENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div className="mt-4"><label className="label">Ursachen (z. B. 5-Why: Warum? → Warum? …)</label><textarea name="rootCause" rows={4} defaultValue={i.rootCause ?? ""} className="input" /></div>
            </div>
          </fieldset>
        </ActionForm>
      </section>

      <ActionsPanel organizationId={orgId} actions={i.actions} source={{ incidentId: i.id, sourceType: "INCIDENT" }} back={`/incidents/${i.id}`} canManage={ctx.can("actions.manage")} />
      <AttachmentsPanel ctx={ctx} entityType="INCIDENT" entityId={i.id} back={`/incidents/${i.id}`} title="Fotos und Dokumente" hint="Unfallstelle, Skizzen, Zeugenaussagen. Keine ärztlichen Unterlagen ablegen." />
    </div>
  );
}
