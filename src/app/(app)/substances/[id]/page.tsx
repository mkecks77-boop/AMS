import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Pictogram } from "@/components/Pictogram";
import { SubstanceStatusBadge } from "@/components/SubstanceStatusBadge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { cmrCategory, formatStatement, SIGNAL_WORD_LABELS, STORAGE_CLASSES } from "@/lib/ghs";
import { STATUS_LABELS as BA_STATUS } from "@/lib/instructions";
import { requireOrg } from "@/lib/session";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { addUse, decide, phaseOut, removeUse } from "../actions";
import { SubstanceForm } from "../SubstanceForm";

export const metadata = { title: "Gefahrstoff" };

export default async function SubstanceDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("substances.view");
  const { id } = await params;
  const s = await db.hazardousSubstance.findFirst({
    where: { id, organizationId: ctx.organization.id, ...(ctx.can("substances.edit") ? {} : { status: "APPROVED" }) },
    include: {
      uses: { include: { site: true }, orderBy: { workArea: "asc" } },
      instructions: { orderBy: [{ seriesId: "asc" }, { version: "desc" }] },
    },
  });
  if (!s) notFound();
  const sites = await db.site.findMany({ where: { organizationId: ctx.organization.id, active: true }, orderBy: { name: "asc" } });
  const cmr = cmrCategory(s.hStatements);
  const canEdit = ctx.can("substances.edit") && s.status !== "PHASED_OUT" && s.status !== "REJECTED";
  const canApprove = ctx.can("substances.approve");
  const instructions = ctx.can("instructions.edit") ? s.instructions : s.instructions.filter((i) => i.status === "RELEASED");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{s.name}</h1>
        <SubstanceStatusBadge status={s.status} />
        {cmr && <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">CMR Kategorie {cmr}</span>}
      </div>

      {s.status === "REQUESTED" && canApprove && (
        <section className="card border-amber-300 bg-amber-50">
          <h2 className="mb-2 text-lg font-semibold">Freigabe</h2>
          <p className="mb-4 text-sm">Vor der Freigabe: Substitutionsprüfung dokumentiert, SDB-Datum erfasst, Angaben mit dem SDB abgeglichen. Bei Freigabe wird automatisch ein Entwurf der Betriebsanweisung erstellt.</p>
          <ActionForm action={decide} submitLabel="Entscheidung speichern" className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="id" value={s.id} />
            <div>
              <label className="label">Entscheidung</label>
              <select name="decision" className="input"><option value="APPROVED">freigeben</option><option value="REJECTED">ablehnen</option></select>
            </div>
            <div><label className="label">Begründung / Auflagen</label><input name="note" className="input" /></div>
          </ActionForm>
        </section>
      )}
      {s.decisionNote && <p className="text-sm text-slate-600">Entscheidung vom {formatDate(s.decidedAt)}: {s.decisionNote}</p>}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Kennzeichnung</h2>
        <div className="flex flex-wrap items-center gap-4">
          {s.pictograms.map((p) => <Pictogram key={p} code={p} size={64} />)}
          <span className="text-lg font-bold">{s.signalWord !== "NONE" && SIGNAL_WORD_LABELS[s.signalWord]}</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <ul className="space-y-1">{s.hStatements.map((h) => <li key={h}>{formatStatement(h)}</li>)}</ul>
          <ul className="space-y-1">{s.pStatements.map((p) => <li key={p}>{formatStatement(p)}</li>)}</ul>
        </div>
        <p className="text-sm">
          Lagerklasse: {s.storageClass ? `${s.storageClass} – ${STORAGE_CLASSES[s.storageClass]}` : "–"} · WGK: {s.waterHazardClass ?? "–"} ·
          SDB vom {formatDate(s.sdsDate)}, Wiedervorlage {formatDate(s.sdsReviewDue)}
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Einsatzorte und Mengen</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {s.uses.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>{u.workArea}{u.site && ` · ${u.site.name}`}{u.quantity != null && ` · max. ${u.quantity.toLocaleString("de-DE")} ${u.unit ?? ""}`}</span>
              {canEdit && (
                <form action={removeUse}>
                  <input type="hidden" name="useId" value={u.id} />
                  <input type="hidden" name="substanceId" value={s.id} />
                  <button className="btn-secondary">Entfernen</button>
                </form>
              )}
            </li>
          ))}
          {s.uses.length === 0 && <li className="py-2 text-slate-500">Noch kein Einsatzort erfasst.</li>}
        </ul>
        {canEdit && (
          <ActionForm action={addUse} submitLabel="Einsatzort hinzufügen" className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <input type="hidden" name="substanceId" value={s.id} />
            <div className="sm:col-span-2"><label className="label">Arbeitsbereich *</label><input name="workArea" required className="input" /></div>
            <div>
              <label className="label">Standort</label>
              <select name="siteId" className="input"><option value="">–</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </div>
            <div><label className="label">Max. Menge</label><input name="quantity" inputMode="decimal" className="input" /></div>
            <div><label className="label">Einheit</label><input name="unit" placeholder="l, kg" className="input" /></div>
          </ActionForm>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Betriebsanweisungen</h2>
        {instructions.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Betriebsanweisung.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {instructions.map((i) => (
              <li key={i.id}><Link href={`/instructions/${i.id}`} className="text-[var(--brand)] hover:underline">{i.title} · V{i.version}</Link> – {BA_STATUS[i.status]}</li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Daten bearbeiten</h2>
          <SubstanceForm substance={s} />
        </section>
      )}
      {!canEdit && s.substitutionNotes && <p className="text-sm">Substitutionsprüfung: {s.substitutionNotes}</p>}

      {s.status === "APPROVED" && canApprove && (
        <form action={phaseOut}>
          <input type="hidden" name="id" value={s.id} />
          <button className="btn-secondary">Nicht mehr im Einsatz</button>
        </form>
      )}
      <AttachmentsPanel ctx={ctx} entityType="SUBSTANCE" entityId={s.id} back={`/substances/${s.id}`} title="Sicherheitsdatenblatt & Dokumente" hint="Aktuelles Sicherheitsdatenblatt (PDF) hier ablegen." />
    </div>
  );
}
