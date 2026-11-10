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
  "training.created": "Unterweisungsthema angelegt",
  "training.updated": "Unterweisungsthema geändert",
  "training.requirements": "Zielgruppe festgelegt",
  "training.session_recorded": "Unterweisung erfasst",
  "qualification.added": "Qualifikation erfasst",
  "qualification.removed": "Qualifikation entfernt",
  "qualification_type.created": "Qualifikationsart angelegt",
  "organization.rates": "Quoten geändert",
  "incident.reported": "Ereignis gemeldet",
  "incident.updated": "Meldung bearbeitet",
  "firstaid.created": "Verbandbucheintrag",
  "firstaid.purged": "Verbandbuch bereinigt (5 Jahre)",
  "action.created": "Maßnahme angelegt",
  "action.updated": "Maßnahme geändert",
  "action.status": "Maßnahmenstatus geändert",
  "risk.created": "GBU angelegt",
  "risk.updated": "GBU geändert",
  "risk.hazard_saved": "Gefährdung gespeichert",
  "risk.hazard_deleted": "Gefährdung entfernt",
  "risk.released": "GBU freigegeben",
  "risk.copied": "GBU kopiert",
  "risk.archived": "GBU archiviert",
  "checklist.created": "Checkliste angelegt",
  "walkthrough.planned": "Begehung geplant",
  "walkthrough.saved": "Begehung gespeichert",
  "walkthrough.completed": "Begehung abgeschlossen",
  "ppe.item_created": "PSA angelegt",
  "ppe.issued": "PSA ausgegeben",
  "ppe.returned": "PSA zurückgegeben",
  "ppe.receipt": "PSA-Empfang bestätigt",
  "appointment.created": "Beauftragung erfasst",
  "appointment.ended": "Beauftragung beendet",
  "appointment.signed": "Beauftragung unterschrieben",
  "asa.planned": "ASA-Sitzung geplant",
  "asa.updated": "ASA-Sitzung geändert",
  "asa.completed": "ASA-Protokoll abgeschlossen",
  "time.logged": "Einsatzzeit erfasst",
  "time.deleted": "Einsatzzeit gelöscht",
  "organization.sifa_target": "Soll-Einsatzzeit geändert",
  "password.changed": "Passwort geändert",
  "totp.enabled": "Zwei-Faktor-Anmeldung aktiviert",
  "totp.disabled": "Zwei-Faktor-Anmeldung deaktiviert",
  "medical.requirements": "Vorsorge-Zuordnung geändert",
  "medical.recorded": "Vorsorge erfasst",
  "medical.type_created": "Vorsorgeanlass angelegt",
  "contractor.created": "Fremdfirma angelegt",
  "contractor.updated": "Fremdfirma geändert",
  "contractor.blocked": "Fremdfirma gesperrt",
  "contractor.unblocked": "Fremdfirma entsperrt",
  "contractor.worker_added": "Fremdfirmen-Person hinzugefügt",
  "contractor.briefed": "Fremdfirmeneinweisung",
  "permit.requested": "Erlaubnisschein beantragt",
  "permit.approved": "Erlaubnisschein genehmigt",
  "permit.rejected": "Erlaubnisschein abgelehnt",
  "permit.activated": "Arbeiten freigegeben",
  "permit.closed": "Erlaubnisschein abgeschlossen",
  "legal.created": "Rechtsanforderung angelegt",
  "legal.evaluated": "Rechtsanforderung bewertet",
  "file.uploaded": "Datei hochgeladen",
  "file.deleted": "Datei gelöscht",
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
