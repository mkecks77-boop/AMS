import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { ACTION_STATUS_LABELS } from "@/lib/measures";
import { requireOrg } from "@/lib/session";
import { complianceRate, RESULT_LABELS } from "@/lib/walkthroughs";

export const metadata = { title: "Begehungsbericht" };

export default async function PrintWalkthrough({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("walkthroughs.view");
  const { id } = await params;
  const w = await db.walkthrough.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { site: true, template: { include: { items: { orderBy: { sortOrder: "asc" } } } }, answers: true, actions: { include: { responsible: true } } },
  });
  if (!w) notFound();
  const ans = new Map(w.answers.map((a) => [a.itemId, a]));
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-xs text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <p>{ctx.organization.name}</p>
      <h1 className="text-lg font-bold">Begehungsbericht: {w.template.title}</h1>
      <p className="mb-3">Datum: {formatDate(w.performedAt ?? w.plannedAt)} · Bereich: {[w.site?.name, w.area].filter(Boolean).join(" · ")} · Durchführung: {w.auditor}{w.participants && ` · Teilnehmende: ${w.participants}`} · Erfüllungsgrad: {complianceRate(w.answers) ?? "–"} %</p>
      <table className="w-full border border-black">
        <thead><tr>{["Abschnitt", "Prüfpunkt", "Ergebnis", "Bemerkung"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>
          {w.template.items.map((i) => {
            const a = ans.get(i.id);
            return <tr key={i.id} className={a?.result === "DEFECT" ? "font-semibold" : ""}><td className="border border-black p-1">{i.section}</td><td className="border border-black p-1">{i.text}</td><td className="border border-black p-1">{a ? RESULT_LABELS[a.result] : "–"}</td><td className="border border-black p-1">{a?.note}</td></tr>;
          })}
        </tbody>
      </table>
      {w.summary && <p className="mt-3"><strong>Zusammenfassung:</strong> {w.summary}</p>}
      {w.actions.length > 0 && (
        <>
          <h2 className="mt-4 font-bold">Maßnahmen</h2>
          <table className="w-full border border-black">
            <thead><tr>{["Maßnahme", "Verantwortlich", "Frist", "Status"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
            <tbody>{w.actions.map((a) => <tr key={a.id}><td className="border border-black p-1">{a.title}</td><td className="border border-black p-1">{a.responsible ? `${a.responsible.firstName} ${a.responsible.lastName}` : ""}</td><td className="border border-black p-1">{formatDate(a.dueDate)}</td><td className="border border-black p-1">{ACTION_STATUS_LABELS[a.status]}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </main>
  );
}
