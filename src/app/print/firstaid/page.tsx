import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Verbandbuch drucken" };

export default async function PrintFirstAid() {
  const ctx = await requireOrg("firstaid.view");
  const entries = await db.firstAidEntry.findMany({ where: { organizationId: ctx.organization.id }, include: { employee: true }, orderBy: { occurredAt: "asc" } });
  return (
    <main className="bg-white p-6 text-xs text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <h1 className="text-lg font-bold">Verbandbuch – {ctx.organization.name}</h1>
      <p className="mb-3">Dokumentation der Erste-Hilfe-Leistungen nach § 24 Abs. 6 DGUV Vorschrift 1 · vertraulich · Aufbewahrung 5 Jahre</p>
      <table className="w-full border border-black">
        <thead><tr>{["Nr.", "Datum/Uhrzeit", "Name der verletzten Person", "Ort", "Hergang", "Art und Umfang der Verletzung", "Erste-Hilfe-Maßnahmen", "Ersthelfer/in", "Zeugen"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>
          {entries.map((e, n) => (
            <tr key={e.id}>
              <td className="border border-black p-1">{n + 1}</td>
              <td className="border border-black p-1">{formatDateTime(e.occurredAt)}</td>
              <td className="border border-black p-1">{e.employee ? `${e.employee.lastName}, ${e.employee.firstName}` : e.personName}</td>
              <td className="border border-black p-1">{e.location}</td>
              <td className="border border-black p-1">{e.description}</td>
              <td className="border border-black p-1">{e.injury}</td>
              <td className="border border-black p-1">{e.measures}</td>
              <td className="border border-black p-1">{e.firstAider}</td>
              <td className="border border-black p-1">{e.witnesses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
