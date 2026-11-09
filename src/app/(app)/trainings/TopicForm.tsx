import type { TrainingTopic } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Check, Field, SelectField } from "@/components/Field";
import { KIND_LABELS } from "@/lib/trainings";
import { saveTopic } from "./actions";

export function TopicForm({ topic: t }: { topic?: TrainingTopic }) {
  return (
    <ActionForm action={saveTopic} submitLabel={t ? "Speichern" : "Anlegen"}>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Titel" name="title" required defaultValue={t?.title} className="sm:col-span-2" />
        <SelectField label="Art" name="kind" defaultValue={t?.kind ?? "INSTRUCTION"} options={Object.entries(KIND_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <Field label="Wiederholung (Monate, 0 = einmalig)" name="intervalMonths" type="number" required defaultValue={t?.intervalMonths ?? 12} />
        <Field label="Rechtsgrundlage" name="legalBasis" defaultValue={t?.legalBasis} className="sm:col-span-2" />
        <Field label="Kurzbeschreibung" name="description" defaultValue={t?.description} className="sm:col-span-2" />
      </div>
      <Check label="Erstunterweisung vor Aufnahme der Tätigkeit" name="beforeStart" defaultChecked={t?.beforeStart ?? true} />
      <div>
        <label className="label" htmlFor="content">Inhalte</label>
        <textarea id="content" name="content" rows={6} className="input" defaultValue={t?.content ?? ""} placeholder="Gliederung bzw. Inhalt der Unterweisung" />
      </div>
      <p className="text-xs text-slate-500">Für Auszubildende werden Unterweisungen automatisch halbjährlich fällig (JArbSchG § 29).</p>
    </ActionForm>
  );
}
