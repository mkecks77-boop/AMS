import type { HazardousSubstance } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Check, Field, SelectField } from "@/components/Field";
import { Pictogram } from "@/components/Pictogram";
import { toInputDate } from "@/lib/dates";
import { GHS_PICTOGRAMS, SIGNAL_WORD_LABELS, STORAGE_CLASSES, WATER_HAZARD_CLASSES } from "@/lib/ghs";
import { saveSubstance } from "./actions";

export function SubstanceForm({ substance: s }: { substance?: HazardousSubstance }) {
  return (
    <ActionForm action={saveSubstance} submitLabel={s ? "Speichern" : "Gefahrstoff beantragen"}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Produktbezeichnung" name="name" required defaultValue={s?.name} />
        <Field label="Hersteller / Lieferant" name="manufacturer" defaultValue={s?.manufacturer} />
        <Field label="CAS-Nummer (bei Reinstoffen)" name="casNumber" defaultValue={s?.casNumber} />
        <Field label="Verwendungszweck / Tätigkeit" name="usage" defaultValue={s?.usage} className="sm:col-span-3" />
      </div>

      <fieldset>
        <legend className="label">GHS-Piktogramme</legend>
        <div className="flex flex-wrap gap-3">
          {Object.entries(GHS_PICTOGRAMS).map(([code, label]) => (
            <label key={code} className="flex w-28 cursor-pointer flex-col items-center rounded-md border border-slate-200 p-2 text-center text-xs has-[:checked]:border-[var(--brand)] has-[:checked]:bg-emerald-50">
              <Pictogram code={code} size={48} />
              <span className="mt-1">{label}</span>
              <input type="checkbox" name="pictograms" value={code} defaultChecked={s?.pictograms.includes(code)} className="mt-1" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Signalwort" name="signalWord" defaultValue={s?.signalWord ?? "NONE"} options={Object.entries(SIGNAL_WORD_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <SelectField label="Lagerklasse (TRGS 510)" name="storageClass" empty="–" defaultValue={s?.storageClass} options={Object.entries(STORAGE_CLASSES).map(([v, l]) => ({ value: v, label: `LGK ${v} – ${l}` }))} />
        <SelectField label="Wassergefährdungsklasse" name="waterHazardClass" empty="–" defaultValue={s?.waterHazardClass} options={WATER_HAZARD_CLASSES.map((w) => ({ value: w, label: w === "nwg" ? "nicht wassergefährdend" : `WGK ${w}` }))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="hStatements">H-Sätze (Gefahrenhinweise)</label>
          <textarea id="hStatements" name="hStatements" rows={3} className="input font-mono" placeholder="z. B. H225, H319, H336" defaultValue={s?.hStatements.join(", ")} />
        </div>
        <div>
          <label className="label" htmlFor="pStatements">P-Sätze (Sicherheitshinweise)</label>
          <textarea id="pStatements" name="pStatements" rows={3} className="input font-mono" placeholder="z. B. P210, P280, P305+P351+P338" defaultValue={s?.pStatements.map((p) => p.replace(/_/g, "+")).join(", ")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Datum Sicherheitsdatenblatt" name="sdsDate" type="date" defaultValue={toInputDate(s?.sdsDate)} />
        <Field label="Wiedervorlage SDB (leer = in 12 Monaten)" name="sdsReviewDue" type="date" defaultValue={toInputDate(s?.sdsReviewDue)} />
        <Field label="Persönliche Schutzausrüstung" name="ppe" defaultValue={s?.ppe} />
      </div>

      <div className="space-y-2 rounded-md bg-slate-50 p-4">
        <Check label="Substitutionsprüfung durchgeführt (§ 6 Abs. 1 GefStoffV)" name="substitutionChecked" defaultChecked={s?.substitutionChecked} />
        <textarea name="substitutionNotes" rows={2} className="input" placeholder="Ergebnis der Substitutionsprüfung, z. B. „Kein geeigneter Ersatzstoff verfügbar, weil …“" defaultValue={s?.substitutionNotes ?? ""} />
      </div>
    </ActionForm>
  );
}
