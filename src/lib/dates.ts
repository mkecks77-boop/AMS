/** Addiert Monate; fällt der Tag weg (31. → Februar), wird auf den Monatsletzten gekürzt. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export type DueStatus = "overdue" | "due30" | "due90" | "ok";

export const DUE_LABELS: Record<DueStatus, string> = {
  overdue: "überfällig",
  due30: "fällig ≤ 30 Tage",
  due90: "fällig ≤ 90 Tage",
  ok: "in Ordnung",
};

const DAY = 24 * 60 * 60 * 1000;

/** Ampel: überfällig / ≤ 30 Tage / ≤ 90 Tage / ok (taggenau, Fälligkeit heute = noch nicht überfällig) */
export function classifyDue(dueAt: Date, now = new Date()): DueStatus {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const due = Date.UTC(dueAt.getUTCFullYear(), dueAt.getUTCMonth(), dueAt.getUTCDate());
  const days = Math.round((due - today) / DAY);
  if (days < 0) return "overdue";
  if (days <= 30) return "due30";
  if (days <= 90) return "due90";
  return "ok";
}

export function formatDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("de-DE", { timeZone: "UTC" }) : "–";
}

/** "2026-11-09" → Date (UTC-Mitternacht), leer → null */
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toInputDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
