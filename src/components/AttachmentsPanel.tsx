import { ActionForm } from "./ActionForm";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { ACCEPT, ENTITY_TYPES, formatSize } from "@/lib/files";
import type { OrgContext } from "@/lib/session";
import { remove, upload } from "@/app/(app)/files/actions";

/** Dateien zu einem Datensatz: Liste, Upload, Löschen (je nach Rechten) */
export async function AttachmentsPanel({ ctx, entityType, entityId, back, title = "Dateien", hint }: { ctx: OrgContext; entityType: keyof typeof ENTITY_TYPES; entityId: string; back: string; title?: string; hint?: string }) {
  const def = ENTITY_TYPES[entityType];
  if (!ctx.can(def.view)) return null;
  const files = await db.attachment.findMany({ where: { organizationId: ctx.organization.id, entityType, entityId }, orderBy: { createdAt: "desc" } });
  const edit = ctx.can(def.edit);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">{title} ({files.length})</h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2">
              {f.mimeType.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${f.id}`} alt="" className="h-12 w-12 rounded object-cover" />
              )}
              <a href={`/api/files/${f.id}`} target="_blank" className="font-medium text-[var(--brand)] hover:underline">{f.fileName}</a>
              <span className="text-xs text-slate-500">{formatSize(f.size)} · {formatDate(f.createdAt)}</span>
              {edit && (
                <form action={remove} className="ml-auto">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="text-xs text-red-700 hover:underline">löschen</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <ActionForm action={upload} submitLabel="Hochladen" buttonClassName="btn-secondary" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="back" value={back} />
          <input type="file" name="files" multiple accept={ACCEPT} capture={undefined} className="text-sm" />
          <span className="text-xs text-slate-500">PDF, Bilder, Word, Excel · max. 15 MB</span>
        </ActionForm>
      )}
    </section>
  );
}
