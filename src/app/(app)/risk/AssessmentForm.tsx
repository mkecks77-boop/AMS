import type { RiskAssessment } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Field, SelectField } from "@/components/Field";
import { db } from "@/lib/db";
import { KIND_LABELS } from "@/lib/risk";
import { saveAssessment } from "./actions";

export async function AssessmentForm({ organizationId, assessment: a }: { organizationId: string; assessment?: RiskAssessment }) {
  const [sites, departments, employees] = await Promise.all([
    db.site.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  return (
    <ActionForm action={saveAssessment} submitLabel={a ? "Speichern" : "Anlegen"}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Arbeitsplatz / Tätigkeit (Titel)" name="title" required defaultValue={a?.title} className="sm:col-span-2" />
        <SelectField label="Art" name="kind" defaultValue={a?.kind ?? "GENERAL"} options={Object.entries(KIND_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <SelectField label="Standort" name="siteId" empty="–" defaultValue={a?.siteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField label="Abteilung" name="departmentId" empty="–" defaultValue={a?.departmentId} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectField label="Verantwortlich" name="responsibleId" empty="–" defaultValue={a?.responsibleId} options={employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))} />
        <Field label="Beschreibung der Tätigkeit / Arbeitsmittel" name="scope" defaultValue={a?.scope} className="sm:col-span-2" />
        <Field label="Überprüfung alle (Monate)" name="reviewIntervalMonths" type="number" defaultValue={a?.reviewIntervalMonths ?? 24} />
        <Field label="Beteiligte (Führungskraft, Sifa, Betriebsarzt, Beschäftigte …)" name="participants" defaultValue={a?.participants} className="sm:col-span-3" />
      </div>
    </ActionForm>
  );
}
