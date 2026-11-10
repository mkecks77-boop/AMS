import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { KIND_LABELS, riskLevel, RISK_LABELS } from "@/lib/risk";
import { requireOrg } from "@/lib/session";
import { AssessmentForm } from "./AssessmentForm";

export const metadata = { title: "Gefährdungsbeurteilungen" };

const STATUS = { DRAFT: "Entwurf", RELEASED: "freigegeben", ARCHIVED: "archiviert" } as const;

export default async function RiskList({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const ctx = await requireOrg("risk.view");
  const { all } = await searchParams;
  const manage = ctx.can("risk.manage");
  const where: Prisma.RiskAssessmentWhereInput = {
    organizationId: ctx.organization.id,
    ...(manage ? (all ? {} : { status: { not: "ARCHIVED" } }) : { status: "RELEASED" }),
  };
  const items = await db.riskAssessment.findMany({ where, include: { site: true, department: true, hazards: true }, orderBy: { title: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Gefährdungsbeurteilungen</h1>
      <section className="card overflow-x-auto">
        {manage && <form className="mb-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all" defaultChecked={!!all} /> auch archivierte <button className="btn-secondary ml-2">Anzeigen</button></label></form>}
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Arbeitsplatz / Tätigkeit</th><th>Art</th><th>Bereich</th><th>Gefährdungen</th><th>höchstes Restrisiko</th><th>Status</th><th>Überprüfung</th></tr></thead>
          <tbody>
            {items.map((r) => {
              const worst = r.hazards.map((h) => (h.residualProbability && h.residualSeverity ? h.residualProbability * h.residualSeverity : 0)).reduce((a, b) => Math.max(a, b), 0);
              const worstH = r.hazards.find((h) => (h.residualProbability ?? 0) * (h.residualSeverity ?? 0) === worst);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2"><Link href={`/risk/${r.id}`} className="font-medium text-[var(--brand)] hover:underline">{r.title}</Link></td>
                  <td>{KIND_LABELS[r.kind]}</td>
                  <td>{[r.site?.name, r.department?.name].filter(Boolean).join(" · ") || "–"}</td>
                  <td>{r.hazards.length}</td>
                  <td>{worst && worstH ? RISK_LABELS[riskLevel(worstH.residualProbability!, worstH.residualSeverity!)] : "–"}</td>
                  <td>{STATUS[r.status]}</td>
                  <td>{r.reviewDue && r.status === "RELEASED" ? <span className="flex items-center gap-2">{formatDate(r.reviewDue)}{classifyDue(r.reviewDue) !== "ok" && <DueBadge status={classifyDue(r.reviewDue)} />}</span> : "–"}</td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine Gefährdungsbeurteilungen</td></tr>}
          </tbody>
        </table>
      </section>
      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Neue Gefährdungsbeurteilung</h2>
          <AssessmentForm organizationId={ctx.organization.id} />
        </section>
      )}
    </div>
  );
}
