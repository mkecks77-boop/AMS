import { DUE_LABELS, type DueStatus } from "@/lib/dates";

const STYLES: Record<DueStatus, string> = {
  overdue: "bg-red-100 text-red-800",
  due30: "bg-amber-100 text-amber-800",
  due90: "bg-yellow-50 text-yellow-800",
  ok: "bg-emerald-50 text-emerald-800",
};

export function DueBadge({ status }: { status: DueStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[status]}`}>{DUE_LABELS[status]}</span>;
}
