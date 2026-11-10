import type { Equipment } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Check, Field, SelectField } from "@/components/Field";
import { EQUIPMENT_CATEGORIES } from "@/lib/catalog";
import { toInputDate } from "@/lib/dates";
import { saveEquipment } from "./actions";

type Opt = { value: string; label: string };

export function EquipmentForm({ equipment, sites, employees }: { equipment?: Equipment; sites: Opt[]; employees: Opt[] }) {
  const categories =
    equipment && !EQUIPMENT_CATEGORIES.includes(equipment.category)
      ? [...EQUIPMENT_CATEGORIES, equipment.category]
      : EQUIPMENT_CATEGORIES;
  return (
    <ActionForm action={saveEquipment} submitLabel={equipment ? "Speichern" : "Anlegen"}>
      {equipment && <input type="hidden" name="id" value={equipment.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Inventarnummer" name="inventoryNumber" required defaultValue={equipment?.inventoryNumber} />
        <Field label="Bezeichnung" name="name" required defaultValue={equipment?.name} />
        <SelectField label="Kategorie" name="category" required options={categories.map((c) => ({ value: c, label: c }))} defaultValue={equipment?.category ?? "Maschinen"} />
        <Field label="Hersteller" name="manufacturer" defaultValue={equipment?.manufacturer} />
        <Field label="Typ / Modell" name="model" defaultValue={equipment?.model} />
        <Field label="Seriennummer" name="serialNumber" defaultValue={equipment?.serialNumber} />
        <Field label="Baujahr" name="yearBuilt" type="number" defaultValue={equipment?.yearBuilt} />
        <Field label="Inbetriebnahme" name="commissionedAt" type="date" defaultValue={toInputDate(equipment?.commissionedAt)} />
        <SelectField label="Verantwortlich" name="responsibleId" options={employees} empty="–" defaultValue={equipment?.responsibleId} />
        <SelectField label="Standort" name="siteId" options={sites} empty="–" defaultValue={equipment?.siteId} />
        <Field label="Ort / Raum" name="location" defaultValue={equipment?.location} className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-6">
        <Check label="CE-Kennzeichnung" name="ceMarked" defaultChecked={equipment?.ceMarked} />
        <Check label="Konformitätserklärung liegt vor" name="hasDeclarationOfConformity" defaultChecked={equipment?.hasDeclarationOfConformity} />
        <Check label="Betriebsanleitung liegt vor" name="hasOperatingManual" defaultChecked={equipment?.hasOperatingManual} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Bemerkungen</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={equipment?.notes ?? ""} className="input" />
      </div>
    </ActionForm>
  );
}
