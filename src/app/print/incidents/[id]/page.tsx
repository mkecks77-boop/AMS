import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/dates";
import { isReportable } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Unfallanzeige" };

/**
 * Vorbereitete Angaben für die Unfallanzeige nach § 193 SGB VII / UVAV.
 * Die eigentliche Anzeige erfolgt über das Formular bzw. Online-Portal der zuständigen BG/UK.
 */
export default async function PrintIncident({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("incidents.view");
  const { id } = await params;
  const i = await db.incident.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { employee: { include: { department: true } }, site: true } });
  if (!i) notFound();
  const Row = ({ n, label, value }: { n: string; label: string; value?: string | null }) => (
    <tr><td className="w-8 border border-black p-1 align-top">{n}</td><th className="w-56 border border-black p-1 text-left align-top">{label}</th><td className="border border-black p-1 whitespace-pre-line">{value || ""}</td></tr>
  );
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-sm text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <h1 className="text-xl font-bold">Unfallanzeige – vorbereitete Angaben</h1>
      <p className="mb-4 text-xs">Zur Übertragung in die Unfallanzeige der Berufsgenossenschaft / Unfallkasse (§ 193 SGB VII, UVAV). Meldepflicht: {isReportable(i) ? "ja" : "nein (≤ 3 Tage AU)"}. Interne Nr. {i.number}.</p>
      <table className="w-full border border-black">
        <tbody>
          <Row n="1" label="Unternehmen" value={ctx.organization.name} />
          <Row n="2" label="Betriebsteil / Standort" value={[i.site?.name, i.site?.address].filter(Boolean).join(", ")} />
          <Row n="3" label="Versicherte Person" value={i.employee ? `${i.employee.lastName}, ${i.employee.firstName}` : i.personName} />
          <Row n="4" label="Beschäftigt als / Abteilung" value={i.employee ? [i.employee.jobTitle, i.employee.department?.name].filter(Boolean).join(" / ") : ""} />
          <Row n="5" label="Beschäftigt seit" value={i.employee?.entryDate ? formatDate(i.employee.entryDate) : ""} />
          <Row n="6" label="Auszubildende/r" value={i.employee ? (i.employee.apprentice ? "ja" : "nein") : ""} />
          <Row n="7" label="Unfallzeitpunkt" value={formatDateTime(i.occurredAt)} />
          <Row n="8" label="Unfallort" value={i.location} />
          <Row n="9" label="Wegeunfall" value={i.type === "COMMUTING" ? "ja" : "nein"} />
          <Row n="10" label="Tätigkeit beim Unfall" value={i.activity} />
          <Row n="11" label="Ausführliche Schilderung des Unfallhergangs" value={i.description} />
          <Row n="12" label="Verletzte Körperteile" value={i.bodyPart} />
          <Row n="13" label="Art der Verletzung" value={i.injury} />
          <Row n="14" label="Tödlicher Unfall" value={i.fatal ? "ja" : "nein"} />
          <Row n="15" label="Zeugen / Erstinformierte" value={i.witnesses} />
          <Row n="16" label="Erste Hilfe durch" value={i.firstAider} />
          <Row n="17" label="Arztbesuch / Durchgangsarzt" value={i.doctorVisit ? "ja" : "nein"} />
          <Row n="18" label="Arbeitsunfähigkeit (Kalendertage)" value={String(i.lostDays)} />
        </tbody>
      </table>
      <div className="mt-10 grid grid-cols-3 gap-6 text-xs">
        <p className="border-t border-black pt-1">Datum, Unternehmer/in</p>
        <p className="border-t border-black pt-1">Betriebsrat / Personalrat</p>
        <p className="border-t border-black pt-1">Fachkraft für Arbeitssicherheit</p>
      </div>
    </main>
  );
}
