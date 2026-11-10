import type { EquipmentStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/equipment";

const STYLES: Record<EquipmentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800",
  LOCKED: "bg-red-100 text-red-800",
  REPAIR: "bg-amber-100 text-amber-800",
  DECOMMISSIONED: "bg-slate-100 text-slate-600",
  SCRAPPED: "bg-slate-200 text-slate-500",
};

export function StatusBadge({ status }: { status: EquipmentStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
