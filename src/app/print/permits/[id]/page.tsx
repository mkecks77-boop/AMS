import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { PERMIT_CHECKS, PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/contractors";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Erlaubnisschein drucken" };

export default async function PrintPermit({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("permits.request");
  const { id } = await params;
  const p = await db.permit.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { contractor: true, site: true, workers: { include: { worker: true } } } });
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-sm text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <p className="text-xs">{ctx.organization.name}</p>
      <h1 className="text-xl font-bold">Erlaubnisschein {p.number} – {PERMIT_TYPE_LABELS[p.type]}</h1>
      <p className="mb-3 text-xs">Status: {PERMIT_STATUS_LABELS[p.status]} · am Arbeitsort mitführen</p>
      <table className="mb-4 w-full border border-black"><tbody>
        <tr><th className="w-48 border border-black p-1 text-left">Ort</th><td className="border border-black p-1">{[p.site?.name, p.location].filter(Boolean).join(" · ")}</td></tr>
        <tr><th className="border border-black p-1 text-left">Arbeiten</th><td className="border border-black p-1">{p.description}</td></tr>
        <tr><th className="border border-black p-1 text-left">Gültig</th><td className="border border-black p-1">{formatDateTime(p.validFrom)} bis {formatDateTime(p.validTo)}</td></tr>
        <tr><th className="border border-black p-1 text-left">Ausführende</th><td className="border border-black p-1">{p.contractor ? `${p.contractor.name}: ${p.workers.map((w) => w.worker.name).join(", ")}` : "eigenes Personal"}</td></tr>
        {p.note && <tr><th className="border border-black p-1 text-left">Auflagen</th><td className="border border-black p-1">{p.note}</td></tr>}
      </tbody></table>
      <h2 className="font-bold">Sicherheitsmaßnahmen</h2>
      <ul className="mb-4">{PERMIT_CHECKS[p.type].map((c) => <li key={c}>{p.checks.includes(c) ? "☒" : "☐"} {c}</li>)}</ul>
      {p.type === "HOT_WORK" && <p className="mb-4">Brandwache bis: {p.fireWatchUntil ? formatDateTime(p.fireWatchUntil) : "______________"} (mindestens 30 Minuten nach Ende der Arbeiten, anschließend Nachkontrolle)</p>}
      <div className="mt-12 grid grid-cols-3 gap-6 text-xs">
        <p className="border-t border-black pt-1">Auftraggeber / Genehmigung</p>
        <p className="border-t border-black pt-1">Ausführende/r</p>
        <p className="border-t border-black pt-1">Abschluss / Brandwache</p>
      </div>
    </main>
  );
}
