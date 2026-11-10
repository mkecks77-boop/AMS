import { requireOrg } from "@/lib/session";
import { EquipmentForm } from "../EquipmentForm";
import { equipmentOptions } from "../options";

export const metadata = { title: "Neue Anlage" };

export default async function NewEquipment() {
  const { organization } = await requireOrg("equipment.manage");
  return (
    <div className="card">
      <h1 className="mb-4 text-2xl font-semibold">Neue Anlage / Maschine</h1>
      <EquipmentForm {...await equipmentOptions(organization.id)} />
    </div>
  );
}
