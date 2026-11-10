import { db } from "@/lib/db";

export async function instructionOptions(organizationId: string) {
  const [substances, equipment] = await Promise.all([
    db.hazardousSubstance.findMany({ where: { organizationId, status: { in: ["REQUESTED", "APPROVED"] } }, orderBy: { name: "asc" } }),
    db.equipment.findMany({ where: { organizationId, status: { not: "SCRAPPED" } }, orderBy: { inventoryNumber: "asc" } }),
  ]);
  return {
    substances: substances.map((s) => ({ value: s.id, label: s.name })),
    equipment: equipment.map((e) => ({ value: e.id, label: `${e.inventoryNumber} · ${e.name}` })),
  };
}
