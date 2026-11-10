import type { OperatingInstruction } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Field, SelectField } from "@/components/Field";
import { Pictogram } from "@/components/Pictogram";
import { GHS_PICTOGRAMS } from "@/lib/ghs";
import { SECTION_LABELS, TYPE_LABELS } from "@/lib/instructions";
import { ISO7010 } from "@/lib/pictograms";
import { saveInstruction } from "./actions";

type Opt = { value: string; label: string };

const GROUPS: [string, string[]][] = [
  ["GHS-Gefahrenpiktogramme", Object.keys(GHS_PICTOGRAMS)],
  ["Warnzeichen (W)", Object.keys(ISO7010).filter((c) => c.startsWith("W"))],
  ["Gebotszeichen (M)", Object.keys(ISO7010).filter((c) => c.startsWith("M"))],
  ["Verbotszeichen (P)", Object.keys(ISO7010).filter((c) => c.startsWith("P"))],
  ["Rettungszeichen (E)", Object.keys(ISO7010).filter((c) => c.startsWith("E"))],
];

const PLACEHOLDER: Record<keyof typeof SECTION_LABELS, string> = {
  hazards: "• Welche Gefahren gehen von der Maschine / dem Stoff / der Tätigkeit aus?",
  protectiveMeasures: "• Vor Arbeitsbeginn …\n• Persönliche Schutzausrüstung …\n• Verboten ist …",
  malfunctions: "• Maschine stillsetzen (NOT-HALT), gegen Wiedereinschalten sichern\n• Vorgesetzte informieren",
  firstAid: "• Ersthelfer heranziehen\n• Notruf 112\n• Unfall melden",
  maintenance: "• Instandhaltung nur durch beauftragte, unterwiesene Personen\n• Entsorgung …",
};

export function InstructionForm({
  instruction: i,
  preset,
  substances,
  equipment,
}: {
  instruction?: OperatingInstruction;
  /** Vorbelegung, z. B. aus der Anlagenseite */
  preset?: { equipmentId?: string; title?: string };
  substances: Opt[];
  equipment: Opt[];
}) {
  return (
    <ActionForm action={saveInstruction} submitLabel={i ? "Entwurf speichern" : "Anlegen"}>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Art" name="type" required defaultValue={i?.type ?? "MACHINE"} options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <Field label="Titel (Maschine, Stoff, Tätigkeit)" name="title" required defaultValue={i?.title ?? preset?.title} className="sm:col-span-2" />
        <Field label="Anwendungsbereich (Arbeitsplatz, Tätigkeit)" name="scope" defaultValue={i?.scope} className="sm:col-span-3" />
        <SelectField label="Verknüpfte Anlage" name="equipmentId" empty="–" options={equipment} defaultValue={i?.equipmentId ?? preset?.equipmentId} />
        <SelectField label="Verknüpfter Gefahrstoff" name="substanceId" empty="–" options={substances} defaultValue={i?.substanceId} />
        <Field label="Notruf" name="emergencyPhone" defaultValue={i?.emergencyPhone ?? "112"} />
      </div>

      {(Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((k) => (
        <div key={k}>
          <label className="label" htmlFor={k}>{SECTION_LABELS[k]}</label>
          <textarea id={k} name={k} rows={5} className="input" placeholder={PLACEHOLDER[k]} defaultValue={i?.[k] ?? ""} />
        </div>
      ))}

      <fieldset className="space-y-3">
        <legend className="label">Piktogramme</legend>
        {GROUPS.map(([name, codes]) => (
          <details key={name} open={codes.some((c) => i?.pictograms.includes(c))}>
            <summary className="cursor-pointer text-sm font-medium">{name}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {codes.map((c) => (
                <label key={c} className="flex w-28 cursor-pointer flex-col items-center rounded-md border border-slate-200 p-2 text-center text-[11px] has-[:checked]:border-[var(--brand)] has-[:checked]:bg-emerald-50">
                  <Pictogram code={c} size={40} />
                  <span className="mt-1">{GHS_PICTOGRAMS[c] ?? ISO7010[c]}</span>
                  <input type="checkbox" name="pictograms" value={c} defaultChecked={i?.pictograms.includes(c)} className="mt-1" />
                </label>
              ))}
            </div>
          </details>
        ))}
      </fieldset>

      <div>
        <label className="label" htmlFor="postings">Aushangorte</label>
        <input id="postings" name="postings" className="input" placeholder="z. B. Halle 1 an der Maschine, Gefahrstofflager" defaultValue={i?.postings ?? ""} />
      </div>
    </ActionForm>
  );
}
