import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { FIRST_AID_RETENTION_YEARS, purgeFirstAidEntries } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";
import { convertEntry } from "../incidents/actions";

export const metadata = { title: "Verbandbuch" };

export default async function FirstAidPage() {
  const ctx = await requireOrg("firstaid.view");
  await purgeFirstAidEntries(ctx.organization.id);
  const entries = await db.firstAidEntry.findMany({
    where: { organizationId: ctx.organization.id },
    include: { employee: true, site: true, incident: true },
    orderBy: { occurredAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Verbandbuch</h1>
        <div className="flex gap-2">
          <a href="/print/firstaid" target="_blank" className="btn-secondary">Drucken</a>
          <Link href="/report?art=verbandbuch" className="btn">Neuer Eintrag</Link>
        </div>
      </div>
      <p className="text-sm text-slate-500">Dokumentation von Erste-Hilfe-Leistungen (DGUV Vorschrift 1 § 24 Abs. 6). Vertraulich – Einträge werden nach {FIRST_AID_RETENTION_YEARS} Jahren automatisch gelöscht.</p>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Zeitpunkt</th><th>Person</th><th>Ort</th><th>Hergang</th><th>Verletzung</th><th>Maßnahmen</th><th>Ersthelfer/in</th><th /></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="py-2 whitespace-nowrap">{formatDateTime(e.occurredAt)}</td>
                <td>{e.employee ? `${e.employee.lastName}, ${e.employee.firstName}` : e.personName}</td>
                <td>{[e.site?.name, e.location].filter(Boolean).join(" · ") || "–"}</td>
                <td>{e.description}</td>
                <td>{e.injury}</td>
                <td>{e.measures}</td>
                <td>{e.firstAider}</td>
                <td>
                  {e.incident ? <Link href={`/incidents/${e.incident.id}`} className="text-xs text-[var(--brand)] hover:underline">Meldung {e.incident.number}</Link>
                    : ctx.can("incidents.manage") && (
                      <ActionForm action={convertEntry} submitLabel="→ Unfallmeldung" className="" buttonClassName="btn-secondary">
                        <input type="hidden" name="id" value={e.id} />
                      </ActionForm>
                    )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-500">Keine Einträge</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
