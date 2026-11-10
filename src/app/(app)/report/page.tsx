import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { nowWallClock, toInputDateTime } from "@/lib/dates";
import { INCIDENT_TYPE_LABELS } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";
import { submitFirstAid, submitIncident } from "./actions";

export const metadata = { title: "Melden" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ art?: string }> }) {
  const ctx = await requireOrg("incidents.report");
  const { art } = await searchParams;
  const firstAid = art === "verbandbuch";
  const orgId = ctx.organization.id;
  const [sites, employees] = await Promise.all([
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const now = toInputDateTime(nowWallClock());
  const common = (
    <div className="grid gap-4 sm:grid-cols-3">
      <div><label className="label">Datum und Uhrzeit *</label><input name="occurredAt" type="datetime-local" required defaultValue={now} max={now} className="input" /></div>
      <div><label className="label">Standort</label><select name="siteId" className="input"><option value="">–</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label className="label">Ort / Arbeitsbereich</label><input name="location" className="input" /></div>
      <div>
        <label className="label">Betroffene Person</label>
        <select name="employeeId" className="input"><option value="">– nicht im Mitarbeiterstamm –</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select>
      </div>
      <div className="sm:col-span-2"><label className="label">oder Name (Fremdfirma, Besucher)</label><input name="personName" className="input" /></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Melden</h1>
      <div className="flex gap-2">
        <Link href="/report" className={firstAid ? "btn-secondary" : "btn"}>Unfall / Beinaheunfall / Gefahr</Link>
        <Link href="/report?art=verbandbuch" className={firstAid ? "btn" : "btn-secondary"}>Verbandbuch (Erste Hilfe)</Link>
      </div>
      {firstAid ? (
        <section className="card">
          <p className="mb-4 text-sm text-slate-500">Für kleine Verletzungen ohne Arbeitsausfall (DGUV Vorschrift 1 § 24). Die Einträge sind nur für berechtigte Personen sichtbar und werden nach 5 Jahren gelöscht.</p>
          <ActionForm action={submitFirstAid} submitLabel="Eintragen">
            {common}
            <div><label className="label">Hergang *</label><textarea name="description" required rows={3} className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Art der Verletzung *</label><input name="injury" required className="input" /></div>
              <div><label className="label">Erste-Hilfe-Maßnahmen *</label><input name="measures" required className="input" /></div>
              <div><label className="label">Ersthelfer/in *</label><input name="firstAider" required className="input" /></div>
              <div><label className="label">Zeugen</label><input name="witnesses" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      ) : (
        <section className="card">
          <ActionForm action={submitIncident} submitLabel="Meldung absenden">
            <div>
              <label className="label">Was ist passiert? *</label>
              <div className="flex flex-wrap gap-4 text-sm">
                {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2"><input type="radio" name="type" value={k} defaultChecked={k === "ACCIDENT"} required /> {v}</label>
                ))}
              </div>
            </div>
            {common}
            <div><label className="label">Tätigkeit zum Zeitpunkt des Ereignisses</label><input name="activity" className="input" /></div>
            <div><label className="label">Hergang *</label><textarea name="description" required rows={4} className="input" placeholder="Was ist wie passiert? Welche Arbeitsmittel / Stoffe waren beteiligt?" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Verletzung</label><input name="injury" className="input" /></div>
              <div><label className="label">Verletzter Körperteil</label><input name="bodyPart" className="input" /></div>
              <div><label className="label">Ausfalltage (falls bekannt)</label><input name="lostDays" type="number" min={0} defaultValue={0} className="input" /></div>
              <div><label className="label">Ersthelfer/in</label><input name="firstAider" className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Zeugen</label><input name="witnesses" className="input" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="doctorVisit" /> Arztbesuch / Durchgangsarzt</label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
