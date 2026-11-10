import Link from "next/link";
import type { ComplianceStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { COMPLIANCE_LABELS, complianceRateOf, ensureDefaultLegal } from "@/lib/legal";
import { requireOrg } from "@/lib/session";
import { add, evaluate } from "./actions";
import { addAction as addActionForLegal } from "../actions/actions";

export const metadata = { title: "Rechtskataster" };

const STYLE: Record<ComplianceStatus, string> = {
  NOT_EVALUATED: "bg-slate-100 text-slate-700",
  FULFILLED: "bg-emerald-50 text-emerald-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  NOT_FULFILLED: "bg-red-100 text-red-800",
  NOT_RELEVANT: "bg-slate-50 text-slate-400",
};

export default async function LegalPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireOrg("legal.view");
  const orgId = ctx.organization.id;
  const { status = "" } = await searchParams;
  await ensureDefaultLegal(orgId);
  const [items, employees] = await Promise.all([
    db.legalRequirement.findMany({ where: { organizationId: orgId }, include: { responsible: true, actions: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } } }, orderBy: [{ area: "asc" }, { law: "asc" }] }),
    db.employee.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const shown = status in COMPLIANCE_LABELS ? items.filter((i) => i.status === status) : items;
  const areas = [...new Set(shown.map((i) => i.area))];
  const rate = complianceRateOf(items);
  const manage = ctx.can("legal.manage");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rechtskataster</h1>
        <p>Erfüllungsgrad: <strong>{rate != null ? `${rate} %` : "–"}</strong> <span className="text-sm text-slate-500">({items.filter((i) => i.status === "NOT_EVALUATED").length} nicht bewertet)</span></p>
      </div>
      <p className="text-sm text-slate-500">Grundbestand des Arbeitsschutzrechts – bitte auf den Betrieb anpassen und regelmäßig (jährlich) bewerten. Für Lücken eine Maßnahme anlegen.</p>
      <form className="flex gap-2"><select name="status" defaultValue={status} className="input w-auto"><option value="">alle</option>{Object.entries(COMPLIANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn-secondary">Filtern</button></form>
      {areas.map((area) => (
        <section key={area} className="card">
          <h2 className="mb-3 text-lg font-semibold">{area}</h2>
          <ul className="divide-y divide-slate-100">
            {shown.filter((i) => i.area === area).map((i) => (
              <li key={i.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{i.law}{i.reference && ` ${i.reference}`}</strong>
                  <span className={`rounded px-2 py-0.5 text-xs ${STYLE[i.status]}`}>{COMPLIANCE_LABELS[i.status]}</span>
                  {i.reviewDue && classifyDue(i.reviewDue) !== "ok" && <DueBadge status={classifyDue(i.reviewDue)} />}
                  {i.actions.length > 0 && <Link href="/actions" className="text-xs text-amber-700">{i.actions.length} offene Maßnahme(n)</Link>}
                </div>
                <p>{i.obligation}</p>
                <p className="text-xs text-slate-500">{i.evidence && `Nachweis: ${i.evidence} · `}{i.responsible && `verantwortlich: ${i.responsible.firstName} ${i.responsible.lastName} · `}{i.evaluatedAt && `bewertet ${formatDate(i.evaluatedAt)}`}</p>
                {manage && (
                  <details className="mt-2"><summary className="cursor-pointer text-[var(--brand)]">Bewerten</summary>
                    <ActionForm action={evaluate} submitLabel="Bewertung speichern" className="mt-2 grid gap-2 sm:grid-cols-4 sm:items-end">
                      <input type="hidden" name="id" value={i.id} />
                      <div><label className="label">Status</label><select name="status" defaultValue={i.status} className="input">{Object.entries(COMPLIANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                      <div className="sm:col-span-2"><label className="label">Nachweis</label><input name="evidence" defaultValue={i.evidence ?? ""} className="input" /></div>
                      <div><label className="label">Verantwortlich</label><select name="responsibleId" defaultValue={i.responsibleId ?? ""} className="input"><option value="">–</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}</select></div>
                    </ActionForm>
                    {(i.status === "PARTIAL" || i.status === "NOT_FULFILLED") && ctx.can("actions.manage") && (
                      <ActionForm action={addActionForLegal} submitLabel="Maßnahme für diese Lücke anlegen" buttonClassName="btn-secondary" className="mt-2 flex gap-2">
                        <input type="hidden" name="legalRequirementId" value={i.id} />
                        <input type="hidden" name="sourceType" value="LEGAL" />
                        <input type="hidden" name="back" value="/legal" />
                        <input type="hidden" name="title" value={`Rechtsanforderung umsetzen: ${i.law}${i.reference ? ` ${i.reference}` : ""}`} />
                        <input type="hidden" name="dueDate" value={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)} />
                        <input type="hidden" name="responsibleId" value={i.responsibleId ?? ""} />
                      </ActionForm>
                    )}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Anforderung hinzufügen</h2>
          <ActionForm action={add} submitLabel="Hinzufügen" className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><label className="label">Bereich *</label><input name="area" required list="areas" className="input" /><datalist id="areas">{[...new Set(items.map((i) => i.area))].map((a) => <option key={a} value={a} />)}</datalist></div>
            <div><label className="label">Vorschrift *</label><input name="law" required className="input" /></div>
            <div><label className="label">Paragraph</label><input name="reference" className="input" /></div>
            <div className="sm:col-span-4"><label className="label">Pflicht *</label><input name="obligation" required className="input" /></div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
