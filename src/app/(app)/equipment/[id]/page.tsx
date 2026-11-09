import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { INSPECTOR_TYPE_LABELS } from "@/lib/catalog";
import { db } from "@/lib/db";
import { classifyDue, formatDate, toInputDate } from "@/lib/dates";
import { RESULT_LABELS, STATUS_LABELS } from "@/lib/equipment";
import { STATUS_LABELS as BA_STATUS } from "@/lib/instructions";
import { requireOrg } from "@/lib/session";
import { changeStatus, recordInspection, toggleObligation } from "../actions";
import { EquipmentForm } from "../EquipmentForm";
import { equipmentOptions } from "../options";
import { ObligationForm } from "./ObligationForm";

export const metadata = { title: "Anlage" };

export default async function EquipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("equipment.view");
  const { id } = await params;
  const eq = await db.equipment.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      site: true,
      responsible: true,
      obligations: {
        orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
        include: { inspections: { orderBy: { performedAt: "desc" }, take: 5 } },
      },
      statusChanges: { orderBy: { createdAt: "desc" } },
      instructions: { where: { status: { not: "ARCHIVED" } }, orderBy: { version: "desc" } },
    },
  });
  if (!eq) notFound();
  const canManage = ctx.can("equipment.manage");
  const canRecord = ctx.can("inspections.record") && eq.status !== "SCRAPPED";
  const today = toInputDate(new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{eq.inventoryNumber} · {eq.name}</h1>
        <StatusBadge status={eq.status} />
      </div>
      {eq.status === "LOCKED" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">Diese Anlage ist gesperrt und darf nicht benutzt werden.</p>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Prüfpflichten</h2>
        {eq.obligations.length === 0 && <p className="text-sm text-slate-500">Noch keine Prüfpflicht hinterlegt.</p>}
        <ul className="space-y-4">
          {eq.obligations.map((o) => (
            <li key={o.id} className={`rounded-md border border-slate-200 p-4 ${o.active ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <strong>{o.title}</strong>
                {o.active && <DueBadge status={classifyDue(o.nextDueAt)} />}
                <span className="text-sm text-slate-500">
                  alle {o.intervalMonths} Monate · {INSPECTOR_TYPE_LABELS[o.inspectorType]}{o.legalBasis && ` · ${o.legalBasis}`}
                </span>
                {canManage && (
                  <form action={toggleObligation} className="ml-auto">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="equipmentId" value={eq.id} />
                    <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                    <button className="btn-secondary">{o.active ? "Deaktivieren" : "Aktivieren"}</button>
                  </form>
                )}
              </div>
              <p className="mt-1 text-sm">
                Letzte Prüfung: {formatDate(o.lastInspectedAt)} · Nächste Prüfung: <strong>{formatDate(o.nextDueAt)}</strong>
              </p>
              {o.inspections.length > 0 && (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-slate-500"><tr><th>Datum</th><th>Prüfer/in</th><th>Ergebnis</th><th>Bemerkung</th></tr></thead>
                  <tbody>
                    {o.inspections.map((i) => (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="py-1">{formatDate(i.performedAt)}</td>
                        <td>{i.inspectorName}</td>
                        <td className={i.result === "FAILED" ? "text-red-700" : i.result === "DEFECTS" ? "text-amber-700" : ""}>{RESULT_LABELS[i.result]}</td>
                        <td>{i.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {canRecord && o.active && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">Prüfung erfassen</summary>
                  <ActionForm action={recordInspection} submitLabel="Prüfung speichern" className="mt-3 space-y-3">
                    <input type="hidden" name="obligationId" value={o.id} />
                    <input type="hidden" name="equipmentId" value={eq.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label className="label">Prüfdatum *</label><input name="performedAt" type="date" required max={today} defaultValue={today} className="input" /></div>
                      <div><label className="label">Prüfer/in *</label><input name="inspectorName" required defaultValue={ctx.user.name} className="input" /></div>
                      <div>
                        <label className="label">Ergebnis *</label>
                        <select name="result" className="input">
                          {Object.entries(RESULT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div><label className="label">Mängel / Bemerkungen</label><textarea name="notes" rows={2} className="input" /></div>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
        {canManage && eq.status !== "SCRAPPED" && (
          <details className="rounded-md border border-dashed border-slate-300 p-4">
            <summary className="cursor-pointer font-medium text-[var(--brand)]">Prüfpflicht hinzufügen</summary>
            <div className="mt-4"><ObligationForm equipmentId={eq.id} category={eq.category} /></div>
          </details>
        )}
      </section>

      {canManage && eq.status !== "SCRAPPED" && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Status ändern</h2>
          <ActionForm action={changeStatus} submitLabel="Status setzen" className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="equipmentId" value={eq.id} />
            <div>
              <label className="label">Neuer Status</label>
              <select name="status" defaultValue={eq.status} className="input">
                {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><label className="label">Begründung</label><input name="reason" className="input" /></div>
          </ActionForm>
        </section>
      )}

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Betriebsanweisungen</h2>
          {ctx.can("instructions.edit") && <Link href={`/instructions/new?equipmentId=${eq.id}`} className="btn-secondary">Neue Betriebsanweisung</Link>}
        </div>
        {eq.instructions.filter((i) => ctx.can("instructions.edit") || i.status === "RELEASED").length === 0 ? (
          <p className="text-sm text-slate-500">Keine Betriebsanweisung hinterlegt.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {eq.instructions.filter((i) => ctx.can("instructions.edit") || i.status === "RELEASED").map((i) => (
              <li key={i.id}><Link href={`/instructions/${i.id}`} className="text-[var(--brand)] hover:underline">{i.title} · V{i.version}</Link> – {BA_STATUS[i.status]}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Stammdaten</h2>
        {canManage ? (
          <EquipmentForm equipment={eq} {...await equipmentOptions(ctx.organization.id)} />
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Kategorie</dt><dd>{eq.category}</dd></div>
            <div><dt className="text-slate-500">Hersteller / Typ</dt><dd>{[eq.manufacturer, eq.model].filter(Boolean).join(" ") || "–"}</dd></div>
            <div><dt className="text-slate-500">Standort</dt><dd>{eq.site?.name ?? "–"} {eq.location}</dd></div>
            <div><dt className="text-slate-500">Verantwortlich</dt><dd>{eq.responsible ? `${eq.responsible.firstName} ${eq.responsible.lastName}` : "–"}</dd></div>
          </dl>
        )}
      </section>

      {eq.statusChanges.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Statusverlauf</h2>
          <ul className="space-y-1 text-sm">
            {eq.statusChanges.map((s) => (
              <li key={s.id}>
                {s.createdAt.toLocaleString("de-DE")}: {STATUS_LABELS[s.from]} → <strong>{STATUS_LABELS[s.to]}</strong>{s.reason && ` – ${s.reason}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
