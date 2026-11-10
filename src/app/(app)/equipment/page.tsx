import Link from "next/link";
import type { EquipmentStatus, Prisma } from "@prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/equipment";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Anlagen & Maschinen" };

export default async function EquipmentList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; site?: string; status?: string }>;
}) {
  const ctx = await requireOrg("equipment.view");
  const { q = "", site = "", status = "" } = await searchParams;
  const orgId = ctx.organization.id;
  const where: Prisma.EquipmentWhereInput = {
    organizationId: orgId,
    ...(site ? { siteId: site } : {}),
    ...(status in STATUS_LABELS ? { status: status as EquipmentStatus } : { status: { not: "SCRAPPED" } }),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { inventoryNumber: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const [items, sites] = await Promise.all([
    db.equipment.findMany({
      where,
      include: {
        site: true,
        obligations: { where: { active: true }, orderBy: { nextDueAt: "asc" }, take: 1 },
      },
      orderBy: { inventoryNumber: "asc" },
    }),
    db.site.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Anlagen & Maschinen</h1>
        {ctx.can("equipment.manage") && <Link href="/equipment/new" className="btn">Neue Anlage</Link>}
      </div>
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-3">
          <input name="q" defaultValue={q} placeholder="Suche" className="input max-w-xs" />
          <select name="site" defaultValue={site} className="input w-auto">
            <option value="">alle Standorte</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="status" defaultValue={status} className="input w-auto">
            <option value="">alle (ohne verschrottet)</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-secondary">Filtern</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Inv.-Nr.</th><th>Bezeichnung</th><th>Kategorie</th><th>Standort</th><th>Status</th><th>Nächste Prüfung</th></tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const next = e.obligations[0];
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{e.inventoryNumber}</td>
                  <td><Link href={`/equipment/${e.id}`} className="font-medium text-[var(--brand)] hover:underline">{e.name}</Link></td>
                  <td>{e.category}</td>
                  <td>{e.site?.name ?? "–"}{e.location && ` · ${e.location}`}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>
                    {next ? (
                      <span className="flex items-center gap-2">{formatDate(next.nextDueAt)} <DueBadge status={classifyDue(next.nextDueAt)} /></span>
                    ) : <span className="text-slate-400">keine Prüfpflicht</span>}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Keine Anlagen</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
