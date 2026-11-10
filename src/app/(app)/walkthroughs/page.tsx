import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { complianceRate, ensureDefaultTemplates } from "@/lib/walkthroughs";
import { addTemplate, plan } from "./actions";

export const metadata = { title: "Begehungen" };

export default async function WalkthroughsPage() {
  const ctx = await requireOrg("walkthroughs.view");
  const orgId = ctx.organization.id;
  await ensureDefaultTemplates(orgId);
  const [items, templates, sites] = await Promise.all([
    db.walkthrough.findMany({ where: { organizationId: orgId }, include: { template: true, site: true, answers: true, _count: { select: { actions: true } } }, orderBy: [{ status: "asc" }, { plannedAt: "desc" }] }),
    db.checklistTemplate.findMany({ where: { organizationId: orgId, active: true }, include: { _count: { select: { items: true } } }, orderBy: { title: "asc" } }),
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const manage = ctx.can("walkthroughs.manage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Begehungen</h1>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Datum</th><th>Checkliste</th><th>Bereich</th><th>Durchführung</th><th>Mängel</th><th>Erfüllung</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="border-t border-slate-100">
                <td className="py-2"><Link href={`/walkthroughs/${w.id}`} className="text-[var(--brand)] hover:underline">{formatDate(w.performedAt ?? w.plannedAt)}</Link></td>
                <td>{w.template.title}</td>
                <td>{[w.site?.name, w.area].filter(Boolean).join(" · ") || "–"}</td>
                <td>{w.auditor}</td>
                <td>{w.answers.filter((a) => a.result === "DEFECT").length}</td>
                <td>{complianceRate(w.answers) != null ? `${complianceRate(w.answers)} %` : "–"}</td>
                <td>{w.status === "DONE" ? "abgeschlossen" : <span className="flex items-center gap-2">geplant <DueBadge status={classifyDue(w.plannedAt)} /></span>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Noch keine Begehungen</td></tr>}
          </tbody>
        </table>
      </section>
      {manage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">Begehung planen</h2>
            <ActionForm action={plan} submitLabel="Planen">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label">Checkliste *</label><select name="templateId" required className="input">{templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({t._count.items} Punkte)</option>)}</select></div>
                <div><label className="label">Datum *</label><input name="plannedAt" type="date" required defaultValue={toInputDate(new Date())} className="input" /></div>
                <div><label className="label">Standort</label><select name="siteId" className="input"><option value="">–</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="label">Bereich</label><input name="area" className="input" /></div>
                <div><label className="label">Durchführung *</label><input name="auditor" required defaultValue={ctx.user.name} className="input" /></div>
                <div className="sm:col-span-2"><label className="label">Teilnehmende</label><input name="participants" className="input" placeholder="z. B. Bereichsleitung, Sicherheitsbeauftragte/r, Betriebsrat" /></div>
              </div>
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">Eigene Checkliste</h2>
            <ActionForm action={addTemplate} submitLabel="Checkliste anlegen">
              <div><label className="label">Titel *</label><input name="title" required className="input" /></div>
              <div><label className="label">Prüfpunkte * (je Zeile, optional „Abschnitt: Prüfpunkt“)</label><textarea name="items" required rows={6} className="input font-mono text-xs" placeholder={"Brandschutz: Feuerlöscher zugänglich\nOrdnung: Keine Stolperstellen"} /></div>
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}
