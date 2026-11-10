import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDateTime, nowWallClock, toInputDateTime } from "@/lib/dates";
import { contractorProblems, PERMIT_CHECKS, PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/contractors";
import { requireOrg } from "@/lib/session";
import { step } from "../actions";

export const metadata = { title: "Erlaubnisschein" };

export default async function PermitDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("permits.request");
  const { id } = await params;
  const p = await db.permit.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { contractor: true, site: true, workers: { include: { worker: true } } } });
  if (!p) notFound();
  const users = await db.user.findMany({ where: { id: { in: [p.requestedById, p.approvedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const name = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? "–";
  const approve = ctx.can("permits.approve");
  const problems = p.contractor ? contractorProblems(p.contractor, p.workers.map((w) => w.worker), p.validFrom) : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Erlaubnisschein {p.number}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{PERMIT_STATUS_LABELS[p.status]}</span>
        <a href={`/print/permits/${p.id}`} target="_blank" className="btn-secondary ml-auto">Drucken</a>
      </div>
      <section className="card grid gap-2 text-sm sm:grid-cols-2">
        <p><strong>{PERMIT_TYPE_LABELS[p.type]}</strong></p>
        <p>{[p.site?.name, p.location].filter(Boolean).join(" · ")}</p>
        <p className="sm:col-span-2">{p.description}</p>
        <p>Zeitraum: {formatDateTime(p.validFrom)} – {formatDateTime(p.validTo)}</p>
        <p>Ausführend: {p.contractor ? `${p.contractor.name}${p.workers.length ? ` (${p.workers.map((w) => w.worker.name).join(", ")})` : ""}` : "eigenes Personal"}</p>
        <p>Beantragt von {name(p.requestedById)}{p.approvedById && ` · ${p.status === "REJECTED" ? "abgelehnt" : "genehmigt"} von ${name(p.approvedById)}`}</p>
        {p.note && <p>Hinweis: {p.note}</p>}
        {p.fireWatchUntil && <p>Brandwache bis {formatDateTime(p.fireWatchUntil)}</p>}
      </section>
      {problems.length > 0 && p.status === "REQUESTED" && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{problems.join(" ")}</p>}
      {approve && p.status === "REQUESTED" && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Genehmigung (Vier-Augen-Prinzip)</h2>
          <div className="flex flex-wrap gap-4">
            <ActionForm action={step} submitLabel="Genehmigen" className="flex items-end gap-2"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="step" value="approve" /><input name="note" placeholder="Auflagen (optional)" className="input w-64" /></ActionForm>
            <ActionForm action={step} submitLabel="Ablehnen" buttonClassName="btn-secondary" className="flex items-end gap-2"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="step" value="reject" /><input name="note" placeholder="Begründung" className="input w-64" /></ActionForm>
          </div>
        </section>
      )}
      {approve && p.status === "APPROVED" && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Freigabe vor Ort – Sicherheitsmaßnahmen bestätigen</h2>
          <ActionForm action={step} submitLabel="Arbeiten freigeben">
            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="step" value="activate" />
            <div className="space-y-2 text-sm">{PERMIT_CHECKS[p.type].map((c) => <label key={c} className="flex items-center gap-2"><input type="checkbox" name="checks" value={c} /> {c}</label>)}</div>
          </ActionForm>
        </section>
      )}
      {p.status === "ACTIVE" && (
        <>
          <section className="card text-sm"><h2 className="mb-2 text-lg font-semibold">Bestätigte Maßnahmen</h2><ul className="list-disc pl-5">{p.checks.map((c) => <li key={c}>{c}</li>)}</ul></section>
          {approve && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold">Arbeiten abschließen</h2>
              <ActionForm action={step} submitLabel="Abschließen" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="step" value="close" />
                {p.type === "HOT_WORK" && <div><label className="label">Brandwache bis * (mind. 30 min nach Arbeitsende)</label><input name="fireWatchUntil" type="datetime-local" defaultValue={toInputDateTime(new Date(nowWallClock().getTime() + 30 * 60000))} className="input" /></div>}
              </ActionForm>
            </section>
          )}
        </>
      )}
    </div>
  );
}
