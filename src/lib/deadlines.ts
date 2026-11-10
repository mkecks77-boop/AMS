import { db } from "./db";
import { classifyDue, type DueStatus } from "./dates";
import { INACTIVE_STATUSES } from "./equipment";

/**
 * Einheitliche Frist aus beliebigem Modul (Standortfilter: Prüfungen über die Anlage,
 * SDB über die Einsatzorte, Betriebsanweisungen über die verknüpfte Anlage). Weitere Module (Unterweisungen, Qualifikationen,
 * Gefährdungsbeurteilungen, SDB …) liefern später ebenfalls Deadline-Objekte.
 */
export interface Deadline {
  id: string;
  source: "inspection" | "sds" | "instruction";
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

/** Wiedervorlage Sicherheitsdatenblatt (freigegebene Gefahrstoffe) */
async function sdsDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.hazardousSubstance.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      sdsReviewDue: { not: null, ...(f.until ? { lte: f.until } : {}) },
      ...(f.siteId ? { uses: { some: { siteId: f.siteId } } } : {}),
    },
    include: { uses: { include: { site: true } } },
  });
  return list.map((s) => {
    const sites = [...new Set(s.uses.map((u) => u.site?.name).filter(Boolean))];
    return {
      id: s.id,
      source: "sds",
      sourceLabel: "Sicherheitsdatenblatt",
      title: "Aktualität des SDB prüfen",
      subject: s.name + (s.manufacturer ? ` (${s.manufacturer})` : ""),
      dueAt: s.sdsReviewDue!,
      status: classifyDue(s.sdsReviewDue!, now),
      siteId: null,
      siteName: sites.join(", ") || null,
      href: `/substances/${s.id}`,
    };
  });
}

/** Überprüfung freigegebener Betriebsanweisungen */
async function instructionDeadlines(organizationId: string, f: DeadlineFilter, now: Date): Promise<Deadline[]> {
  const list = await db.operatingInstruction.findMany({
    where: {
      organizationId,
      status: "RELEASED",
      reviewDue: { not: null, ...(f.until ? { lte: f.until } : {}) },
      ...(f.siteId ? { equipment: { siteId: f.siteId } } : {}),
    },
    include: { equipment: { include: { site: true } } },
  });
  return list.map((i) => ({
    id: i.id,
    source: "instruction",
    sourceLabel: "Betriebsanweisung",
    title: "Betriebsanweisung überprüfen",
    subject: `${i.title} (V${i.version})`,
    dueAt: i.reviewDue!,
    status: classifyDue(i.reviewDue!, now),
    siteId: i.equipment?.siteId ?? null,
    siteName: i.equipment?.site?.name ?? null,
    href: `/instructions/${i.id}`,
  }));
}

export async function getDeadlines(organizationId: string, f: DeadlineFilter = {}, now = new Date()) {
  const parts = await Promise.all([
    inspectionDeadlines(organizationId, f, now),
    sdsDeadlines(organizationId, f, now),
    instructionDeadlines(organizationId, f, now),
  ]);
  const all = parts.flat();
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
