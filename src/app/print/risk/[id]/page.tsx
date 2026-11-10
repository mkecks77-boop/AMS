import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { HAZARD_FACTORS, KIND_LABELS, riskLevel, riskScore, RISK_LABELS } from "@/lib/risk";
import { ACTION_STATUS_LABELS } from "@/lib/measures";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Gefährdungsbeurteilung drucken" };

const r = (p: number | null, s: number | null) => (p && s ? `${riskScore(p, s)} (${RISK_LABELS[riskLevel(p, s)]})` : "–");

export default async function PrintRisk({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("risk.view");
  const { id } = await params;
  const ra = await db.riskAssessment.findFirst({
    where: { id, organizationId: ctx.organization.id, ...(ctx.can("risk.manage") ? {} : { status: "RELEASED" }) },
    include: { site: true, department: true, responsible: true, hazards: { orderBy: { sortOrder: "asc" } }, actions: { include: { responsible: true } } },
  });
  if (!ra) notFound();
  const releasedBy = ra.releasedById ? await db.user.findUnique({ where: { id: ra.releasedById } }) : null;
  return (
    <main className="bg-white p-6 text-xs text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <p>{ctx.organization.name}</p>
      <h1 className="text-lg font-bold">Gefährdungsbeurteilung nach §§ 5, 6 ArbSchG – {KIND_LABELS[ra.kind]}</h1>
      <table className="my-3 w-full border border-black">
        <tbody>
          <tr><th className="w-48 border border-black p-1 text-left">Arbeitsplatz / Tätigkeit</th><td className="border border-black p-1">{ra.title}{ra.scope && ` – ${ra.scope}`}</td></tr>
          <tr><th className="border border-black p-1 text-left">Bereich</th><td className="border border-black p-1">{[ra.site?.name, ra.department?.name].filter(Boolean).join(" · ")}</td></tr>
          <tr><th className="border border-black p-1 text-left">Verantwortlich</th><td className="border border-black p-1">{ra.responsible ? `${ra.responsible.firstName} ${ra.responsible.lastName}` : ""}</td></tr>
          <tr><th className="border border-black p-1 text-left">Beteiligte</th><td className="border border-black p-1">{ra.participants}</td></tr>
          <tr><th className="border border-black p-1 text-left">Freigabe / Überprüfung</th><td className="border border-black p-1">{ra.releasedAt ? `${formatDate(ra.releasedAt)} durch ${releasedBy?.name ?? ""} · nächste Überprüfung ${formatDate(ra.reviewDue)}` : "ENTWURF"}</td></tr>
        </tbody>
      </table>
      <table className="w-full border border-black">
        <thead><tr>{["Nr.", "Gefährdungsfaktor", "Gefährdung", "Risiko vorher", "Schutzmaßnahmen", "Restrisiko"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>
          {ra.hazards.map((h, n) => (
            <tr key={h.id} className="align-top">
              <td className="border border-black p-1">{n + 1}</td>
              <td className="border border-black p-1">{HAZARD_FACTORS[h.factor]}</td>
              <td className="border border-black p-1">{h.description}</td>
              <td className="border border-black p-1">{r(h.probability, h.severity)}</td>
              <td className="border border-black p-1 whitespace-pre-line">{h.measures}</td>
              <td className="border border-black p-1">{r(h.residualProbability, h.residualSeverity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ra.actions.length > 0 && (
        <>
          <h2 className="mt-4 font-bold">Umsetzung der Maßnahmen</h2>
          <table className="w-full border border-black">
            <thead><tr>{["Maßnahme", "Verantwortlich", "Frist", "Status / Wirksamkeit"].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {ra.actions.map((a) => (
                <tr key={a.id}><td className="border border-black p-1">{a.title}</td><td className="border border-black p-1">{a.responsible ? `${a.responsible.firstName} ${a.responsible.lastName}` : ""}</td><td className="border border-black p-1">{formatDate(a.dueDate)}</td><td className="border border-black p-1">{ACTION_STATUS_LABELS[a.status]}{a.effectivenessNote && ` – ${a.effectivenessNote}`}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="mt-4">Risikobewertung: 5×5-Matrix, Risiko = Wahrscheinlichkeit × Schadensschwere (1–4 gering, 5–9 mittel, 10–16 hoch, 20–25 sehr hoch).</p>
    </main>
  );
}
