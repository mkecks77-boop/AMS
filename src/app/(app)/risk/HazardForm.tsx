import type { Hazard } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { HAZARD_FACTORS, PROBABILITY_LABELS, SEVERITY_LABELS } from "@/lib/risk";
import { saveHazard } from "./actions";

function Scale({ name, labels, value, required }: { name: string; labels: string[]; value?: number | null; required?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? ""} required={required} className="input">
      {!required && <option value="">–</option>}
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} – {labels[n]}</option>)}
    </select>
  );
}

export function HazardForm({ assessmentId, hazard: h }: { assessmentId: string; hazard?: Hazard }) {
  return (
    <ActionForm action={saveHazard} submitLabel={h ? "Gefährdung speichern" : "Gefährdung hinzufügen"} className="space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {h && <input type="hidden" name="hazardId" value={h.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Gefährdungsfaktor *</label>
          <select name="factor" defaultValue={h?.factor ?? "1"} className="input">{Object.entries(HAZARD_FACTORS).map(([k, v]) => <option key={k} value={k}>{k}. {v}</option>)}</select>
        </div>
        <div className="sm:col-span-2"><label className="label">Gefährdung *</label><input name="description" required defaultValue={h?.description} className="input" /></div>
        <div><label className="label">Wahrscheinlichkeit (vorher) *</label><Scale name="probability" labels={PROBABILITY_LABELS} value={h?.probability ?? 3} required /></div>
        <div><label className="label">Schadensschwere (vorher) *</label><Scale name="severity" labels={SEVERITY_LABELS} value={h?.severity ?? 3} required /></div>
      </div>
      <div><label className="label">Schutzmaßnahmen (STOP: Substitution, Technik, Organisation, Person)</label><textarea name="measures" rows={3} defaultValue={h?.measures} className="input" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Wahrscheinlichkeit (nach Maßnahmen)</label><Scale name="residualProbability" labels={PROBABILITY_LABELS} value={h?.residualProbability} /></div>
        <div><label className="label">Schadensschwere (nach Maßnahmen)</label><Scale name="residualSeverity" labels={SEVERITY_LABELS} value={h?.residualSeverity} /></div>
      </div>
    </ActionForm>
  );
}
