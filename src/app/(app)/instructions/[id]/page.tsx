import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { InstructionSheet } from "@/components/InstructionSheet";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { canRelease, STATUS_LABELS } from "@/lib/instructions";
import { requireOrg } from "@/lib/session";
import { workflow } from "../actions";
import { fromInstruction } from "../../trainings/actions";
import { InstructionForm } from "../InstructionForm";
import { instructionOptions } from "../options";

export const metadata = { title: "Betriebsanweisung" };

function Step({ id, step, label, note }: { id: string; step: string; label: string; note?: boolean }) {
  return (
    <ActionForm action={workflow} submitLabel={label} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      {note && <input name="note" placeholder="Hinweis an die Bearbeitung" className="input w-64" />}
    </ActionForm>
  );
}

export default async function InstructionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const ctx = await requireOrg("instructions.view");
  const { id } = await params;
  const { neu } = await searchParams;
  const editor = ctx.can("instructions.edit");
  const i = await db.operatingInstruction.findFirst({
    where: { id, organizationId: ctx.organization.id, ...(editor ? {} : { status: "RELEASED" }) },
    include: { substance: true, equipment: true },
  });
  if (!i) notFound();
  const [versions, users] = await Promise.all([
    db.operatingInstruction.findMany({ where: { seriesId: i.seriesId }, orderBy: { version: "desc" } }),
    db.user.findMany({ where: { id: { in: [i.releasedById, i.lastEditorId, i.authorId].filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const name = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? null;
  const editable = editor && (i.status === "DRAFT" || i.status === "IN_REVIEW");
  const canReleaseIt = ctx.can("instructions.release");
  const release = canRelease(i, ctx.user.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{i.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">V{i.version} · {STATUS_LABELS[i.status]}</span>
        <a href={`/print/instructions/${i.id}`} target="_blank" className="btn-secondary ml-auto">Drucken / PDF</a>
      </div>
      {neu && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Gefahrstoff freigegeben. Dieser Entwurf wurde aus den SDB-Daten erzeugt – bitte prüfen, ergänzen und zur Freigabe vorlegen.</p>}

      {editor && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Ablauf</h2>
          <p className="text-sm text-slate-600">
            Erstellt von {name(i.authorId) ?? "–"} · zuletzt bearbeitet von {name(i.lastEditorId) ?? "–"}
            {i.releasedAt && ` · freigegeben am ${formatDate(i.releasedAt)} von ${name(i.releasedById) ?? "–"} · Überprüfung bis ${formatDate(i.reviewDue)}`}
          </p>
          <div className="flex flex-wrap gap-4">
            {i.status === "DRAFT" && <Step id={i.id} step="submit" label="Zur Freigabe vorlegen" />}
            {i.status === "IN_REVIEW" && canReleaseIt && (release.ok
              ? <Step id={i.id} step="release" label="Freigeben" />
              : <p className="text-sm text-amber-800">{release.reason}</p>)}
            {i.status === "IN_REVIEW" && canReleaseIt && <Step id={i.id} step="return" label="Zurück in Bearbeitung" note />}
            {i.status === "RELEASED" && <Step id={i.id} step="version" label="Neue Version erstellen" />}
            {i.status === "RELEASED" && canReleaseIt && <Step id={i.id} step="withdraw" label="Zurückziehen" />}
            {i.status === "RELEASED" && ctx.can("trainings.manage") && (
              <ActionForm action={fromInstruction} submitLabel="Unterweisung daraus erstellen" className="">
                <input type="hidden" name="instructionId" value={i.id} />
              </ActionForm>
            )}
          </div>
        </section>
      )}

      <InstructionSheet instruction={i} organizationName={ctx.organization.name} releasedByName={name(i.releasedById)} />

      <section className="card text-sm">
        <h2 className="mb-2 text-lg font-semibold">Bezug und Aushang</h2>
        <p>Anlage: {i.equipment ? <Link className="text-[var(--brand)] hover:underline" href={`/equipment/${i.equipment.id}`}>{i.equipment.inventoryNumber} · {i.equipment.name}</Link> : "–"}</p>
        <p>Gefahrstoff: {i.substance ? <Link className="text-[var(--brand)] hover:underline" href={`/substances/${i.substance.id}`}>{i.substance.name}</Link> : "–"}</p>
        <p>Aushangorte: {i.postings || "–"}</p>
      </section>

      {editable && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Bearbeiten</h2>
          {i.status === "IN_REVIEW" && <p className="mb-4 text-sm text-amber-800">Änderungen setzen die Betriebsanweisung zurück in den Entwurf.</p>}
          <InstructionForm instruction={i} {...await instructionOptions(ctx.organization.id)} />
        </section>
      )}

      {editor && versions.length > 1 && (
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">Versionen</h2>
          <ul className="space-y-1 text-sm">
            {versions.map((v) => (
              <li key={v.id}>
                <Link href={`/instructions/${v.id}`} className={v.id === i.id ? "font-semibold" : "text-[var(--brand)] hover:underline"}>V{v.version}</Link>
                {" "}– {STATUS_LABELS[v.status]}{v.releasedAt && `, freigegeben ${formatDate(v.releasedAt)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
