import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { InstructionForm } from "../InstructionForm";
import { instructionOptions } from "../options";

export const metadata = { title: "Neue Betriebsanweisung" };

export default async function NewInstruction({ searchParams }: { searchParams: Promise<{ equipmentId?: string }> }) {
  const { organization } = await requireOrg("instructions.edit");
  const { equipmentId } = await searchParams;
  const eq = equipmentId ? await db.equipment.findFirst({ where: { id: equipmentId, organizationId: organization.id } }) : null;
  return (
    <div className="card">
      <h1 className="mb-2 text-2xl font-semibold">Neue Betriebsanweisung</h1>
      <p className="mb-6 text-sm text-slate-500">Für Gefahrstoffe wird der Entwurf bei der Freigabe des Stoffes automatisch aus den SDB-Daten erzeugt.</p>
      <InstructionForm preset={eq ? { equipmentId: eq.id, title: eq.name } : undefined} {...await instructionOptions(organization.id)} />
    </div>
  );
}
