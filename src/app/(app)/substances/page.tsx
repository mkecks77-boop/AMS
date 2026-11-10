import Link from "next/link";
import type { Prisma, SubstanceStatus } from "@prisma/client";
import { DueBadge } from "@/components/DueBadge";
import { Pictogram } from "@/components/Pictogram";
import { SubstanceStatusBadge } from "@/components/SubstanceStatusBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { cmrCategory, SIGNAL_WORD_LABELS } from "@/lib/ghs";
import { requireOrg } from "@/lib/session";
import { SUBSTANCE_STATUS_LABELS } from "@/lib/substances";

export const metadata = { title: "Gefahrstoffverzeichnis" };

export default async function SubstancesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; site?: string }> }) {
  const ctx = await requireOrg("substances.view");
  const { q = "", status = "", site = "" } = await searchParams;
  const orgId = ctx.organization.id;
  // Mitarbeitende sehen nur freigegebene Stoffe
  const onlyApproved = !ctx.can("substances.edit");
  const where: Prisma.HazardousSubstanceWhereInput = {
    organizationId: orgId,
    ...(onlyApproved ? { status: "APPROVED" } : status in SUBSTANCE_STATUS_LABELS ? { status: status as SubstanceStatus } : { status: { in: ["REQUESTED", "APPROVED"] } }),
    ...(site ? { uses: { some: { siteId: site } } } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { manufacturer: { contains: q, mode: "insensitive" } },
      { casNumber: { contains: q } },
    ] } : {}),
  };
  const [items, sites] = await Promise.all([
    db.hazardousSubstance.findMany({ where, include: { uses: { include: { site: true } }, instructions: { where: { status: "RELEASED" }, select: { id: true } } }, orderBy: { name: "asc" } }),
    db.site.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Gefahrstoffverzeichnis</h1>
        <div className="flex gap-2">
          <a href={`/substances/export?${new URLSearchParams({ site })}`} className="btn-secondary">CSV-Export</a>
          {ctx.can("substances.edit") && <Link href="/substances/new" className="btn">Gefahrstoff beantragen</Link>}
        </div>
      </div>
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-3">
          <input name="q" defaultValue={q} placeholder="Produkt, Hersteller, CAS" className="input max-w-xs" />
          <select name="site" defaultValue={site} className="input w-auto">
            <option value="">alle Standorte</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!onlyApproved && (
            <select name="status" defaultValue={status} className="input w-auto">
              <option value="">beantragt + freigegeben</option>
              {Object.entries(SUBSTANCE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <button className="btn-secondary">Filtern</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Produkt</th><th>Kennzeichnung</th><th>LGK / WGK</th><th>Einsatzorte</th><th>SDB</th><th>BA</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const cmr = cmrCategory(s.hStatements);
              return (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="py-2">
                    <Link href={`/substances/${s.id}`} className="font-medium text-[var(--brand)] hover:underline">{s.name}</Link>
                    <span className="block text-xs text-slate-500">{s.manufacturer}</span>
                    {cmr && <span className="mt-1 inline-block rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">CMR {cmr}</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-0.5">{s.pictograms.map((p) => <Pictogram key={p} code={p} size={28} />)}</div>
                    <span className="text-xs text-slate-500">{s.signalWord !== "NONE" && SIGNAL_WORD_LABELS[s.signalWord]}</span>
                  </td>
                  <td className="py-2">{s.storageClass ?? "–"} / {s.waterHazardClass ?? "–"}</td>
                  <td className="py-2 text-xs">{s.uses.map((u) => <span key={u.id} className="block">{u.workArea}{u.site && ` (${u.site.name})`}</span>)}</td>
                  <td className="py-2 text-xs">
                    {formatDate(s.sdsDate)}
                    {s.status === "APPROVED" && s.sdsReviewDue && classifyDue(s.sdsReviewDue) !== "ok" && <span className="mt-1 block"><DueBadge status={classifyDue(s.sdsReviewDue)} /></span>}
                  </td>
                  <td className="py-2">{s.instructions.length > 0 ? "✓" : <span className="text-amber-700">fehlt</span>}</td>
                  <td className="py-2"><SubstanceStatusBadge status={s.status} /></td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Keine Gefahrstoffe</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
