import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ASA_INTERVAL_MONTHS, nextAsaDue } from "@/lib/asa";
import { requireOrg } from "@/lib/session";
import { save } from "./actions";

export const metadata = { title: "Arbeitsschutzausschuss" };

export default async function AsaPage() {
  const ctx = await requireOrg("asa.view");
  const meetings = await db.asaMeeting.findMany({ where: { organizationId: ctx.organization.id }, include: { _count: { select: { actions: true } } }, orderBy: { date: "desc" } });
  const lastDone = meetings.find((m) => m.status === "DONE");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Arbeitsschutzausschuss (ASA)</h1>
      <p className="text-sm text-slate-600">
        § 11 ASiG: Bei mehr als 20 Beschäftigten tritt der ASA mindestens alle {ASA_INTERVAL_MONTHS} Monate zusammen (Arbeitgeber/in, zwei Betriebsratsmitglieder, Betriebsarzt/-ärztin, Fachkraft für Arbeitssicherheit, Sicherheitsbeauftragte).
        {lastDone && <> Nächste Sitzung fällig bis <strong>{formatDate(nextAsaDue(lastDone.date))}</strong>.</>}
      </p>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Termin</th><th>Ort</th><th>Status</th><th>Maßnahmen</th></tr></thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/asa/${m.id}`} className="text-[var(--brand)] hover:underline">{formatDateTime(m.date)}</Link></td>
                <td>{m.location ?? "–"}</td>
                <td>{m.status === "DONE" ? "durchgeführt" : "geplant"}</td>
                <td>{m._count.actions}</td>
              </tr>
            ))}
            {meetings.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">Noch keine Sitzungen</td></tr>}
          </tbody>
        </table>
      </section>
      {ctx.can("asa.manage") && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Sitzung planen</h2>
          <p className="mb-4 text-sm text-slate-500">Die Tagesordnung wird mit aktuellen Kennzahlen (Unfälle, offene Maßnahmen, Gefahrstoffe) vorbereitet.</p>
          <ActionForm action={save} submitLabel="Planen">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Termin *</label><input name="date" type="datetime-local" required className="input" /></div>
              <div><label className="label">Ort</label><input name="location" className="input" /></div>
              <div><label className="label">Teilnehmende</label><input name="participants" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
