import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Protokoll" };

const LABELS: Record<string, string> = {
  login: "Anmeldung",
  "member.added": "Mitglied hinzugefügt",
  "member.invited": "Person eingeladen",
  "member.updated": "Mitgliedschaft geändert",
  "invitation.accepted": "Einladung angenommen",
  "password.reset_link_created": "Passwort-Link erstellt",
  "organization.created": "Unternehmen angelegt",
  "organization.activated": "Unternehmen aktiviert",
  "organization.deactivated": "Unternehmen deaktiviert",
  "site.created": "Standort angelegt",
  "site.updated": "Standort geändert",
  "department.created": "Abteilung angelegt",
  "department.updated": "Abteilung geändert",
  "employee.created": "Mitarbeiter/in angelegt",
  "employee.updated": "Mitarbeiter/in geändert",
  "equipment.created": "Anlage angelegt",
  "equipment.updated": "Anlage geändert",
  "equipment.status_changed": "Anlagenstatus geändert",
  "obligation.created": "Prüfpflicht angelegt",
  "obligation.updated": "Prüfpflicht geändert",
  "inspection.recorded": "Prüfung erfasst",
  "substance.requested": "Gefahrstoff beantragt",
  "substance.updated": "Gefahrstoff geändert",
  "substance.approved": "Gefahrstoff freigegeben",
  "substance.rejected": "Gefahrstoff abgelehnt",
  "substance.phased_out": "Gefahrstoff außer Einsatz",
  "substance.use_added": "Einsatzort hinzugefügt",
  "substance.use_removed": "Einsatzort entfernt",
  "instruction.created": "Betriebsanweisung angelegt",
  "instruction.updated": "Betriebsanweisung bearbeitet",
  "instruction.submitted": "BA zur Freigabe vorgelegt",
  "instruction.released": "Betriebsanweisung freigegeben",
  "instruction.returned": "BA zurück in Bearbeitung",
  "instruction.new_version": "Neue BA-Version",
  "instruction.withdrawn": "Betriebsanweisung zurückgezogen",
};

export default async function AuditPage() {
  const { organization } = await requireOrg("audit.view");
  const logs = await db.auditLog.findMany({
    where: { organizationId: organization.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="card overflow-x-auto">
      <h1 className="mb-4 text-2xl font-semibold">Protokoll</h1>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500"><tr><th className="py-2">Zeitpunkt</th><th>Person</th><th>Aktion</th><th>Details</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="py-2 whitespace-nowrap">{l.createdAt.toLocaleString("de-DE")}</td>
              <td className="py-2">{l.user?.name ?? "–"}</td>
              <td className="py-2">{LABELS[l.action] ?? l.action}</td>
              <td className="py-2 font-mono text-xs text-slate-500">{l.details ? JSON.stringify(l.details) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
