import type { SubstanceStatus } from "@prisma/client";
import { SUBSTANCE_STATUS_LABELS } from "@/lib/substances";

const STYLE: Record<SubstanceStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  PHASED_OUT: "bg-slate-100 text-slate-600",
};

export function SubstanceStatusBadge({ status }: { status: SubstanceStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>{SUBSTANCE_STATUS_LABELS[status]}</span>;
}
