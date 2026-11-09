import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/dates";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "ASA-Protokoll" };

export default async function PrintAsa({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("asa.view");
  const { id } = await params;
  const m = await db.asaMeeting.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { actions: { include: { responsible: true } } } });
  if (!m) notFound();
  const done = m.status === "DONE";
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-sm text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <p className="text-xs">{ctx.organization.name}</p>
      <h1 className="text-xl font-bold">{done ? "Protokoll" : "Einladung"}: Sitzung des Arbeitsschutzausschusses</h1>
      <p className="mb-4">gemäß § 11 ASiG · {formatDateTime(m.date)}{m.location && ` · ${m.location}`}</p>
      {m.participants && <p className="mb-4"><strong>Teilnehmende:</strong> {m.participants}</p>}
      <h2 className="font-bold">Tagesordnung</h2>
      <p className="mb-4 whitespace-pre-line">{m.agenda}</p>
      {done && (<><h2 className="font-bold">Ergebnisse</h2><p className="mb-4 whitespace-pre-line">{m.minutes}</p></>)}
      {m.actions.length > 0 && (
        <table className="w-full border border-black text-xs">
          <thead><tr>{["Beschlossene Maßnahme", "Verantwortlich", "Frist"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
          <tbody>{m.actions.map((a) => <tr key={a.id}><td className="border border-black p-1">{a.title}</td><td className="border border-black p-1">{a.responsible ? `${a.responsible.firstName} ${a.responsible.lastName}` : ""}</td><td className="border border-black p-1">{formatDate(a.dueDate)}</td></tr>)}</tbody>
        </table>
      )}
      {done && <div className="mt-12 grid grid-cols-2 gap-10 text-xs"><p className="border-t border-black pt-1">Protokollführung</p><p className="border-t border-black pt-1">Arbeitgeber/in</p></div>}
    </main>
  );
}
