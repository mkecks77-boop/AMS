import { notFound } from "next/navigation";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { contractorProblems, PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/contractors";
import { requireOrg } from "@/lib/session";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { block, brief, save, worker } from "../actions";

export const metadata = { title: "Fremdfirma" };

export default async function ContractorDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("contractors.view");
  const { id } = await params;
  const c = await db.contractor.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { workers: { orderBy: { name: "asc" } }, permits: { orderBy: { validFrom: "desc" }, take: 20 } } });
  if (!c) notFound();
  const manage = ctx.can("contractors.manage");
  const now = new Date();
  const problems = contractorProblems(c, [], now);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        {c.blocked && <span className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">gesperrt</span>}
      </div>
      {problems.length > 0 && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{problems.join(" ")}</p>}
      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Eingesetzte Personen</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Name</th><th>Fremdfirmeneinweisung</th><th>gültig bis</th><th /></tr></thead>
          <tbody>
            {c.workers.map((w) => (
              <tr key={w.id} className="border-t border-slate-100">
                <td className="py-2">{w.name}</td><td>{formatDate(w.briefedAt)}</td>
                <td className={!w.briefedUntil || w.briefedUntil < now ? "text-red-700" : ""}>{w.briefedUntil ? formatDate(w.briefedUntil) : "fehlt"}</td>
                <td>{manage && <form action={brief}><input type="hidden" name="workerId" value={w.id} /><input type="hidden" name="contractorId" value={c.id} /><button className="text-xs text-[var(--brand)] hover:underline">heute eingewiesen</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {manage && (
          <ActionForm action={worker} submitLabel="Person hinzufügen" className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="contractorId" value={c.id} />
            <div><label className="label">Name *</label><input name="name" required className="input" /></div>
            <div><label className="label">eingewiesen am</label><input name="briefedAt" type="date" className="input" /></div>
          </ActionForm>
        )}
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Erlaubnisscheine</h2>
        <ul className="space-y-1 text-sm">{c.permits.map((p) => <li key={p.id}><Link href={`/permits/${p.id}`} className="text-[var(--brand)] hover:underline">{p.number}</Link> · {PERMIT_TYPE_LABELS[p.type]} · {formatDate(p.validFrom)} · {PERMIT_STATUS_LABELS[p.status]}</li>)}</ul>
        {c.permits.length === 0 && <p className="text-sm text-slate-500">Keine</p>}
      </section>
      {manage && (
        <>
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Stammdaten</h2>
            <ActionForm action={save} submitLabel="Speichern">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="label">Firma</label><input name="name" required defaultValue={c.name} className="input" /></div>
                <div><label className="label">Ansprechpartner</label><input name="contactName" defaultValue={c.contactName ?? ""} className="input" /></div>
                <div><label className="label">Telefon</label><input name="phone" defaultValue={c.phone ?? ""} className="input" /></div>
                <div><label className="label">E-Mail</label><input name="email" type="email" defaultValue={c.email ?? ""} className="input" /></div>
                <div><label className="label">Haftpflicht bis</label><input name="insuranceUntil" type="date" defaultValue={toInputDate(c.insuranceUntil)} className="input" /></div>
                <div><label className="label">Notizen</label><input name="notes" defaultValue={c.notes ?? ""} className="input" /></div>
              </div>
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">{c.blocked ? "Sperre aufheben" : "Fremdfirma sperren"}</h2>
            <ActionForm action={block} submitLabel={c.blocked ? "Entsperren" : "Sperren"} buttonClassName="btn-secondary" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="blocked" value={c.blocked ? "false" : "true"} />
              {!c.blocked && <div className="flex-1"><label className="label">Begründung</label><input name="reason" className="input" /></div>}
            </ActionForm>
          </section>
        </>
      )}
      <AttachmentsPanel ctx={ctx} entityType="CONTRACTOR" entityId={c.id} back={`/contractors/${c.id}`} title="Unterlagen" hint="Haftpflichtnachweis, Qualifikationsnachweise, Einweisungsprotokolle." />
    </div>
  );
}
