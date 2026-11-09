import { TRAINING_STATUS_LABELS, type TrainingStatus } from "@/lib/trainings";

const STYLE: Record<TrainingStatus, string> = {
  missing: "bg-red-100 text-red-800",
  overdue: "bg-red-100 text-red-800",
  due30: "bg-amber-100 text-amber-800",
  due90: "bg-yellow-50 text-yellow-800",
  ok: "bg-emerald-50 text-emerald-800",
};

export function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLE[status]}`}>{TRAINING_STATUS_LABELS[status]}</span>;
}
