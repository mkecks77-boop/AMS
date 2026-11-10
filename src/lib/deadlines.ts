import { db } from "./db";
import { classifyDue, type DueStatus } from "./dates";
import { INACTIVE_STATUSES } from "./equipment";

/**
 * Einheitliche Frist aus beliebigem Modul. Weitere Module (Unterweisungen, Qualifikationen,
 * Gefährdungsbeurteilungen, SDB …) liefern später ebenfalls Deadline-Objekte.
 */
export interface Deadline {
  id: string;
  source: "inspection";
  sourceLabel: string;
  title: string;
  subject: string;
  dueAt: Date;
  status: DueStatus;
  siteId: string | null;
  siteName: string | null;
  href: string;
  /** z. B. Prüfer-Typ */
  info?: string;
}

export interface DeadlineFilter {
  siteId?: string | null;
  /** nur Fristen bis zu diesem Datum */
  until?: Date | null;
  status?: DueStatus | null;
}

async function inspectionDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const obs = await db.inspectionObligation.findMany({
    where: {
      organizationId,
      active: true,
      equipment: {
        status: { notIn: INACTIVE_STATUSES },
        ...(f.siteId ? { siteId: f.siteId } : {}),
      },
      ...(f.until ? { nextDueAt: { lte: f.until } } : {}),
    },
    include: { equipment: { include: { site: true } } },
  });
  return obs.map((o) => ({
    id: o.id,
    source: "inspection",
    sourceLabel: "Prüfung",
    title: o.title,
    subject: `${o.equipment.inventoryNumber} · ${o.equipment.name}`,
    dueAt: o.nextDueAt,
    status: classifyDue(o.nextDueAt, now),
    siteId: o.equipment.siteId,
    siteName: o.equipment.site?.name ?? null,
    href: `/equipment/${o.equipmentId}`,
    info: o.equipment.status === "LOCKED" ? "Anlage gesperrt" : undefined,
  }));
}

export async function getDeadlines(organizationId: string, f: DeadlineFilter = {}, now = new Date()) {
  const all = [...(await inspectionDeadlines(organizationId, f, now))];
  return all
    .filter((d) => !f.status || d.status === f.status)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function countByStatus(items: { status: DueStatus }[]): Record<DueStatus, number> {
  const c: Record<DueStatus, number> = { overdue: 0, due30: 0, due90: 0, ok: 0 };
  for (const i of items) c[i.status]++;
  return c;
}

/** Gruppiert nach Monat, z. B. "2026-11" → Fristen */
export function groupByMonth<T extends { dueAt: Date }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = i.dueAt.toISOString().slice(0, 7);
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()];
}
