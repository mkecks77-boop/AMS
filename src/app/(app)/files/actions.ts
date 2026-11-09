"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { deleteAttachment, ENTITY_TYPES, uploadAttachment } from "@/lib/files";
import { str, type FormState } from "@/lib/form";

export async function upload(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg();
  const entityType = str(fd, "entityType");
  const def = ENTITY_TYPES[entityType];
  if (!def || !ctx.can(def.edit)) return { error: "Keine Berechtigung." };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Bitte eine Datei auswählen." };
  return run(async () => {
    for (const f of files) {
      await uploadAttachment(actorOf(ctx), ctx.organization.id, { entityType, entityId: str(fd, "entityId"), fileName: f.name, data: Buffer.from(await f.arrayBuffer()) });
    }
    revalidatePath(str(fd, "back") || "/");
  }, files.length > 1 ? `${files.length} Dateien hochgeladen.` : "Datei hochgeladen.");
}

export async function remove(fd: FormData) {
  const ctx = await requireOrg();
  await deleteAttachment(actorOf(ctx), ctx.organization.id, str(fd, "id"), ctx.can);
  revalidatePath(str(fd, "back") || "/");
}
