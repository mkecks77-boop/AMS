import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionsPanel } from "@/components/ActionsPanel";
import { RiskBadge, RiskMatrix } from "@/components/RiskBadge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { HAZARD_FACTORS, KIND_LABELS, releaseProblems } from "@/lib/risk";
import { requireOrg } from "@/lib/session";
import { riskStep } from "../actions";
import { AssessmentForm } from "../AssessmentForm";
import { HazardForm } from "../HazardForm";

export const metadata = { title: "Gefährdungsbeurteilung" };

const STATUS = { DRAFT: "Entwurf", RELEASED: "freigegeben", ARCHIVED: "archiviert" } as const;

function Step({ id, step, label, extra, secondary }: { id: string; step: string; label: string; extra?: Record<string, string>; secondary?: boolean }) {
  return (
    <ActionForm action={riskStep} submitLabel={label} className="" buttonClassName={secondary ? "btn-secondary" : undefined}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </ActionForm>
  );
}

export default async function RiskDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("risk.view");
  const { id } = await params;
  const manage = ctx.can("risk.manage");
  const ra = await db.riskAssessment.findFirst({
    where: { id, organizationId: ctx.organization.id, ...(manage ? {} : { status: "RELEASED" }) },
    include: { site: true, department: true, responsible: true, hazards: { orderBy: { sortOrder: "asc" } }, actions: { include: { responsible: true }, orderBy: { dueDate: "asc" } } },
  });
  if (!ra) notFound();
  const editable = manage && ra.status !== "ARCHIVED";
  const problems = releaseProblems(ra.hazards);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{ra.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{KIND_LABELS[ra.kind]} · {STATUS[ra.status]}</span>
        <a href={`/print/risk/${ra.id}`} target="_blank" className="btn-secondary ml-auto">Drucken / PDF</a>
      </div>
      <p className="text-sm text-slate-600">
        {[ra.site?.name, ra.department?.name, ra.scope].filter(Boolean).join(" · ")}
        {ra.responsible && ` · verantwortlich: ${ra.responsible.firstName} ${ra.responsible.lastName}`}
        {ra.releasedAt && ` · freigegeben ${formatDate(ra.releasedAt)}, Überprüfung bis ${formatDate(ra.reviewDue)}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <section className="card">
          <h2 className="mb-3 font-semibold">Restrisiko</h2>
          <RiskMatrix points={ra.hazards.filter((h) => h.residualProbability && h.residualSeverity).map((h) => ({ p: h.residualProbability!, s: h.residualSeverity! }))} />
        </section>
        {editable && (
          <section className="card space-y-3">
            <h2 className="font-semibold">Ablauf</h2>
            {ra.status === "DRAFT" && (problems.length ? <ul className="list-disc pl-5 text-sm text-amber-800">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : <Step id={ra.id} step="release" label="Freigeben (Wirksamkeit bestätigt)" />)}
            <div className="flex flex-wrap gap-3">
              <Step id={ra.id} step="copy" label="Als Vorlage kopieren" secondary />
              <Step id={ra.id} step="archive" label="Archivieren" secondary />
            </div>
          </section>
        )}
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Gefährdungen und Maßnahmen</h2>
        {ra.hazards.length === 0 && <p className="text-sm text-slate-500">Noch keine Gefährdung erfasst.</p>}
        {ra.hazards.map((h) => (
          <div key={h.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">{h.factor}. {HAZARD_FACTORS[h.factor]}</span>
              <strong>{h.description}</strong>
              <span className="text-xs">vorher <RiskBadge p={h.probability} s={h.severity} /></span>
              <span className="text-xs">nachher <RiskBadge p={h.residualProbability} s={h.residualSeverity} /></span>
            </div>
            {h.measures && <p className="mt-2 whitespace-pre-line text-sm">{h.measures}</p>}
            {editable && (
              <div className="mt-3 flex flex-wrap gap-4">
                <details className="flex-1"><summary className="cursor-pointer text-sm text-[var(--brand)]">Bearbeiten</summary><div className="mt-3"><HazardForm assessmentId={ra.id} hazard={h} /></div></details>
                <Step id={ra.id} step="deleteHazard" label="Entfernen" extra={{ hazardId: h.id }} secondary />
              </div>
            )}
          </div>
        ))}
        {editable && (
          <details className="rounded-md border border-dashed border-slate-300 p-4">
            <summary className="cursor-pointer font-medium text-[var(--brand)]">Gefährdung hinzufügen</summary>
            <div className="mt-4"><HazardForm assessmentId={ra.id} /></div>
          </details>
        )}
      </section>

      <ActionsPanel organizationId={ctx.organization.id} actions={ra.actions} source={{ riskAssessmentId: ra.id, sourceType: "RISK" }} back={`/risk/${ra.id}`} canManage={ctx.can("actions.manage") && editable} />

      {editable && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Kopfdaten</h2>
          <AssessmentForm organizationId={ctx.organization.id} assessment={ra} />
        </section>
      )}
    </div>
  );
}
