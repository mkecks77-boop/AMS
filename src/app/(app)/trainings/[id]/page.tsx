import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { formatDate, toInputDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { isRequired, KIND_LABELS, trainingStatus, TRAINING_STATUS_LABELS } from "@/lib/trainings";
import { addSession, saveRequirements } from "../actions";
import { TopicForm } from "../TopicForm";
import { TrainingStatusBadge } from "@/components/TrainingStatusBadge";

export const metadata = { title: "Unterweisung" };

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("trainings.view");
  const { id } = await params;
  const orgId = ctx.organization.id;
  const t = await db.trainingTopic.findFirst({
    where: { id, organizationId: orgId },
    include: { requirements: true, instruction: true, sessions: { orderBy: { date: "desc" }, include: { records: { include: { employee: true } } } } },
  });
  if (!t) notFound();
  const [departments, employees] = await Promise.all([
    db.department.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { organizationId: orgId, active: true },
      include: { department: true, trainingRecords: { where: { topicId: t.id }, orderBy: { completedAt: "desc" }, take: 1 } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const manage = ctx.can("trainings.manage");
  const all = t.requirements.some((r) => !r.departmentId);
  const apprOnly = t.requirements.some((r) => r.apprenticesOnly);
  const rows = employees.map((e) => ({ e, required: isRequired(t.requirements, e), status: trainingStatus(e.trainingRecords[0], new Date()) }));
  const target = rows.filter((r) => r.required);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{KIND_LABELS[t.kind]} · {t.intervalMonths ? `alle ${t.intervalMonths} Monate` : "einmalig"}</span>
        <a href={`/print/trainings/${t.id}`} target="_blank" className="btn-secondary ml-auto">Teilnehmerliste drucken</a>
      </div>
      {t.instruction && <p className="text-sm">Grundlage: <Link href={`/instructions/${t.instruction.id}`} className="text-[var(--brand)] hover:underline">Betriebsanweisung {t.instruction.title} (V{t.instruction.version})</Link></p>}

      <section className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold">Zielgruppe und Stand ({target.length} Personen)</h2>
        {manage && (
          <ActionForm action={saveRequirements} submitLabel="Zielgruppe speichern" className="mb-6 space-y-3">
            <input type="hidden" name="topicId" value={t.id} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allEmployees" defaultChecked={all} /> alle Beschäftigten</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2"><input type="checkbox" name="departmentIds" value={d.id} defaultChecked={t.requirements.some((r) => r.departmentId === d.id)} /> {d.name}</label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="apprenticesOnly" defaultChecked={apprOnly} /> nur Auszubildende</label>
          </ActionForm>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Name</th><th>Abteilung</th><th>Letzte Teilnahme</th><th>Gültig bis</th><th>Status</th></tr></thead>
          <tbody>
            {target.map(({ e, status }) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="py-2">{e.lastName}, {e.firstName}{e.apprentice && " (Azubi)"}</td>
                <td>{e.department?.name ?? "–"}</td>
                <td>{formatDate(e.trainingRecords[0]?.completedAt)}</td>
                <td>{e.trainingRecords[0] ? (e.trainingRecords[0].validUntil ? formatDate(e.trainingRecords[0].validUntil) : "unbegrenzt") : "–"}</td>
                <td><TrainingStatusBadge status={status} /></td>
              </tr>
            ))}
            {target.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-500">Noch keine Zielgruppe festgelegt.</td></tr>}
          </tbody>
        </table>
      </section>

      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Durchgeführte Unterweisung erfassen</h2>
          <ActionForm action={addSession} submitLabel="Erfassen">
            <input type="hidden" name="topicId" value={t.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Datum *</label><input name="date" type="date" required defaultValue={toInputDate(new Date())} max={toInputDate(new Date())} className="input" /></div>
              <div><label className="label">Unterwiesen durch *</label><input name="trainer" required defaultValue={ctx.user.name} className="input" /></div>
              <div><label className="label">Ort</label><input name="location" className="input" /></div>
            </div>
            <fieldset>
              <legend className="label">Teilnehmende (vorausgewählt: Zielgruppe mit fehlender oder ablaufender Unterweisung)</legend>
              <div className="grid gap-1 text-sm sm:grid-cols-3">
                {rows.map(({ e, required, status }) => (
                  <label key={e.id} className="flex items-center gap-2">
                    <input type="checkbox" name="employeeIds" value={e.id} defaultChecked={required && status !== "ok"} />
                    {e.lastName}, {e.firstName}
                    {required && <span className="text-xs text-slate-500">({TRAINING_STATUS_LABELS[status]})</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <div><label className="label">Bemerkungen</label><input name="notes" className="input" /></div>
          </ActionForm>
        </section>
      )}

      {t.sessions.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Durchgeführte Termine</h2>
          <ul className="space-y-2 text-sm">
            {t.sessions.map((s) => (
              <li key={s.id}>
                <strong>{formatDate(s.date)}</strong> · {s.trainer}{s.location && ` · ${s.location}`} · {s.records.length} Teilnehmende
                <span className="block text-xs text-slate-500">{s.records.map((r) => `${r.employee.lastName}, ${r.employee.firstName}`).join("; ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {manage && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Thema bearbeiten</h2>
          <TopicForm topic={t} />
        </section>
      )}
      {!manage && t.content && <section className="card whitespace-pre-line text-sm">{t.content}</section>}
    </div>
  );
}
