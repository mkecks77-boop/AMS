import type { Employee } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Check, Field, SelectField } from "@/components/Field";
import { toInputDate } from "@/lib/dates";
import { saveEmployee } from "./actions";

type Opt = { value: string; label: string };

export function EmployeeForm({ employee, sites, departments }: { employee?: Employee; sites: Opt[]; departments: Opt[] }) {
  return (
    <ActionForm action={saveEmployee} submitLabel={employee ? "Speichern" : "Anlegen"}>
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vorname" name="firstName" required defaultValue={employee?.firstName} />
        <Field label="Nachname" name="lastName" required defaultValue={employee?.lastName} />
        <Field label="Personalnummer" name="personnelNumber" defaultValue={employee?.personnelNumber} />
        <Field label="Tätigkeit / Funktion" name="jobTitle" defaultValue={employee?.jobTitle} />
        <SelectField label="Standort" name="siteId" options={sites} empty="–" defaultValue={employee?.siteId} />
        <SelectField label="Abteilung" name="departmentId" options={departments} empty="–" defaultValue={employee?.departmentId} />
        <Field label="Eintritt" name="entryDate" type="date" defaultValue={toInputDate(employee?.entryDate)} />
        {employee && <Field label="Austritt" name="exitDate" type="date" defaultValue={toInputDate(employee.exitDate)} />}
      </div>
      <div className="flex flex-wrap gap-6">
        <Check label="Auszubildende/r" name="apprentice" defaultChecked={employee?.apprentice} />
        {employee && <Check label="aktiv" name="active" defaultChecked={employee.active} />}
      </div>
    </ActionForm>
  );
}
