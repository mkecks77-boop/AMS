import Link from "next/link";
import type { InstructionStatus, InstructionType, Prisma } from "@prisma/client";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "@/lib/instructions";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Betriebsanweisungen" };

export default async function InstructionsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string }> }) {
  const ctx = await requireOrg("instructions.view");
  const { q = "", type = "", status = "" } = await searchParams;
  const editor = ctx.can("instructions.edit");
  const where: Prisma.OperatingInstructionWhereInput = {
    organizationId: ctx.organization.id,
    ...(type in TYPE_LABELS ? { type: type as InstructionType } : {}),
    ...(!editor ? { status: "RELEASED" } : status in STATUS_LABELS ? { status: status as InstructionStatus } : { status: { not: "ARCHIVED" } }),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { scope: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const items = await db.operatingInstruction.findMany({
    where,
    include: { equipment: true, substance: true },
    orderBy: [{ title: "asc" }, { version: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Betriebsanweisungen</h1>
        {editor && <Link href="/instructions/new" className="btn">Neue Betriebsanweisung</Link>}
      </div>
      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-3">
          <input name="q" defaultValue={q} placeholder="Suche" className="input max-w-xs" />
          <select name="type" defaultValue={type} className="input w-auto">
            <option value="">alle Arten</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {editor && (
            <select name="status" defaultValue={status} className="input w-auto">
              <option value="">aktuelle (ohne Archiv)</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <button className="btn-secondary">Filtern</button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Titel</th><th>Art</th><th>Bezug</th><th>Version</th><th>Status</th><th>Überprüfung</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2">
                  <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: TYPE_COLORS[i.type] }} />
                  <Link href={`/instructions/${i.id}`} className="font-medium text-[var(--brand)] hover:underline">{i.title}</Link>
                </td>
                <td>{TYPE_LABELS[i.type]}</td>
                <td className="text-xs">{i.equipment ? `${i.equipment.inventoryNumber} · ${i.equipment.name}` : i.substance?.name ?? "–"}</td>
                <td>V{i.version}</td>
                <td>{STATUS_LABELS[i.status]}</td>
                <td>{i.status === "RELEASED" && i.reviewDue ? <span className="flex items-center gap-2">{formatDate(i.reviewDue)} {classifyDue(i.reviewDue) !== "ok" && <DueBadge status={classifyDue(i.reviewDue)} />}</span> : "–"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Keine Betriebsanweisungen</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
