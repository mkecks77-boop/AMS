import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { DueBadge } from "@/components/DueBadge";
import { db } from "@/lib/db";
import { classifyDue, formatDate } from "@/lib/dates";
import { contractorProblems } from "@/lib/contractors";
import { requireOrg } from "@/lib/session";
import { save } from "./actions";

export const metadata = { title: "Fremdfirmen" };

export default async function ContractorsPage() {
  const ctx = await requireOrg("contractors.view");
  const list = await db.contractor.findMany({ where: { organizationId: ctx.organization.id }, include: { workers: { where: { active: true } } }, orderBy: { name: "asc" } });
  const now = new Date();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fremdfirmen</h1>
        {ctx.can("permits.request") && <Link href="/permits" className="btn-secondary">Erlaubnisscheine</Link>}
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Firma</th><th>Ansprechpartner</th><th>Haftpflicht bis</th><th>Personen (eingewiesen)</th><th>Einsatzbereit</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const ok = contractorProblems(c, [], now).length === 0;
              const briefed = c.workers.filter((w) => w.briefedUntil && w.briefedUntil >= now).length;
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="py-2"><Link href={`/contractors/${c.id}`} className="font-medium text-[var(--brand)] hover:underline">{c.name}</Link>{c.blocked && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">gesperrt</span>}</td>
                  <td>{[c.contactName, c.phone].filter(Boolean).join(" · ") || "–"}</td>
                  <td>{c.insuranceUntil ? <span className="flex items-center gap-2">{formatDate(c.insuranceUntil)}{classifyDue(c.insuranceUntil) !== "ok" && <DueBadge status={classifyDue(c.insuranceUntil)} />}</span> : <span className="text-red-700">fehlt</span>}</td>
                  <td>{c.workers.length} ({briefed})</td>
                  <td>{ok ? "✓" : <span className="text-red-700">nein</span>}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Keine Fremdfirmen</td></tr>}
          </tbody>
        </table>
      </section>
      {ctx.can("contractors.manage") && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Fremdfirma anlegen</h2>
          <ActionForm action={save} submitLabel="Anlegen">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Firma *</label><input name="name" required className="input" /></div>
              <div><label className="label">Ansprechpartner</label><input name="contactName" className="input" /></div>
              <div><label className="label">Telefon</label><input name="phone" className="input" /></div>
              <div><label className="label">E-Mail</label><input name="email" type="email" className="input" /></div>
              <div><label className="label">Haftpflichtnachweis gültig bis</label><input name="insuranceUntil" type="date" className="input" /></div>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
