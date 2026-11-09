import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ActionsPanel } from "@/components/ActionsPanel";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { complianceRate, RESULT_LABELS } from "@/lib/walkthroughs";
import { answer } from "../actions";

export const metadata = { title: "Begehung" };

export default async function WalkthroughDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("walkthroughs.view");
  const { id } = await params;
  const w = await db.walkthrough.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { site: true, template: { include: { items: { orderBy: { sortOrder: "asc" } } } }, answers: true, actions: { include: { responsible: true }, orderBy: { dueDate: "asc" } } },
  });
  if (!w) notFound();
  const done = w.status === "DONE";
  const editable = ctx.can("walkthroughs.manage") && !done;
  const ans = new Map(w.answers.map((a) => [a.itemId, a]));
  const sections = [...new Set(w.template.items.map((i) => i.section))];
  const defects = w.template.items.filter((i) => ans.get(i.id)?.result === "DEFECT");
  const rate = complianceRate(w.answers);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{w.template.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{done ? `abgeschlossen ${formatDate(w.performedAt)}` : `geplant ${formatDate(w.plannedAt)}`}</span>
        {rate != null && <span className="text-sm">Erfüllungsgrad: <strong>{rate} %</strong></span>}
        <a href={`/print/walkthroughs/${w.id}`} target="_blank" className="btn-secondary ml-auto">Bericht drucken</a>
      </div>
      <p className="text-sm text-slate-600">{[w.site?.name, w.area].filter(Boolean).join(" · ")} · Durchführung: {w.auditor}{w.participants && ` · Teilnehmende: ${w.participants}`}</p>

      <section className="card">
        <ActionForm action={answer} submitLabel="Speichern">
          <input type="hidden" name="id" value={w.id} />
          <fieldset disabled={!editable} className="space-y-6">
            {sections.map((sec) => (
              <div key={sec}>
                <h2 className="mb-2 font-semibold">{sec}</h2>
                <ul className="divide-y divide-slate-100">
                  {w.template.items.filter((i) => i.section === sec).map((i) => {
                    const a = ans.get(i.id);
                    return (
                      <li key={i.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_auto]">
                        <span className="text-sm">{i.text}</span>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {(["OK", "DEFECT", "NA"] as const).map((r) => (
                            <label key={r} className={`flex items-center gap-1 rounded px-2 py-1 ${r === "DEFECT" ? "has-[:checked]:bg-red-100" : r === "OK" ? "has-[:checked]:bg-emerald-100" : "has-[:checked]:bg-slate-100"}`}>
                              <input type="radio" name={`r_${i.id}`} value={r} defaultChecked={a?.result === r} /> {RESULT_LABELS[r]}
                            </label>
                          ))}
                        </div>
                        <input name={`n_${i.id}`} defaultValue={a?.note ?? ""} placeholder="Bemerkung / Mangelbeschreibung" className="input sm:col-span-2" />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div><label className="label">Zusammenfassung</label><textarea name="summary" rows={3} defaultValue={w.summary ?? ""} className="input" /></div>
            {editable && (
              <div className="flex flex-wrap items-end gap-4 rounded-md bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="complete" /> Begehung abschließen</label>
                <div><label className="label">durchgeführt am</label><input name="performedAt" type="date" defaultValue={toInputDate(new Date())} className="input" /></div>
              </div>
            )}
          </fieldset>
        </ActionForm>
      </section>

      {defects.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Festgestellte Mängel ({defects.length})</h2>
          <ul className="list-disc pl-5 text-sm">{defects.map((i) => <li key={i.id}>{i.text}: <strong>{ans.get(i.id)?.note}</strong></li>)}</ul>
        </section>
      )}
      <ActionsPanel organizationId={ctx.organization.id} actions={w.actions} source={{ walkthroughId: w.id, sourceType: "AUDIT" }} back={`/walkthroughs/${w.id}`} canManage={ctx.can("actions.manage")} />
      <AttachmentsPanel ctx={ctx} entityType="WALKTHROUGH" entityId={w.id} back={`/walkthroughs/${w.id}`} title="Fotos" hint="Fotos der Mängel – direkt vom Handy hochladen." />
    </div>
  );
}
