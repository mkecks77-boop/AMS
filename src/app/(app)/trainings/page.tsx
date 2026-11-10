import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { KIND_LABELS } from "@/lib/trainings";
import { TopicForm } from "./TopicForm";

export const metadata = { title: "Unterweisungen & Schulungen" };

export default async function TrainingsPage() {
  const ctx = await requireOrg("trainings.view");
  const topics = await db.trainingTopic.findMany({
    where: { organizationId: ctx.organization.id },
    include: { requirements: { include: { department: true } }, _count: { select: { sessions: true } } },
    orderBy: [{ active: "desc" }, { title: "asc" }],
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Unterweisungen & Schulungen</h1>
        <div className="flex gap-2">
          <Link href="/trainings/matrix" className="btn-secondary">Schulungsmatrix</Link>
          <Link href="/qualifications" className="btn-secondary">Qualifikationen</Link>
        </div>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Thema</th><th>Art</th><th>Wiederholung</th><th>Zielgruppe</th><th>Termine</th></tr></thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id} className={`border-t border-slate-100 ${t.active ? "" : "text-slate-400"}`}>
                <td className="py-2"><Link href={`/trainings/${t.id}`} className="font-medium text-[var(--brand)] hover:underline">{t.title}</Link></td>
                <td>{KIND_LABELS[t.kind]}</td>
                <td>{t.intervalMonths ? `alle ${t.intervalMonths} Monate` : "einmalig"}</td>
                <td className="text-xs">
                  {t.requirements.length === 0 ? <span className="text-amber-700">nicht zugeordnet</span>
                    : t.requirements.map((r) => (r.department?.name ?? "alle Beschäftigten") + (r.apprenticesOnly ? " (nur Azubis)" : "")).join(", ")}
                </td>
                <td>{t._count.sessions}</td>
              </tr>
            ))}
            {topics.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">Noch keine Themen</td></tr>}
          </tbody>
        </table>
      </section>
      {ctx.can("trainings.manage") && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Neues Thema</h2>
          <p className="mb-4 text-sm text-slate-500">Tipp: Aus einer freigegebenen Betriebsanweisung lässt sich direkt eine Unterweisung erzeugen.</p>
          <TopicForm />
        </section>
      )}
    </div>
  );
}
