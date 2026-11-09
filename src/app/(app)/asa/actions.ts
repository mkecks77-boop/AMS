"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDateTime } from "@/lib/dates";
import { saveMeeting } from "@/lib/asa";
import { bool, str, type FormState } from "@/lib/form";

export async function save(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("asa.manage");
  const id = str(fd, "id") || null;
  const date = parseDateTime(str(fd, "date"));
  let newId = "";
  const res = await run(async () => {
    if (!date) return { error: "Bitte Datum und Uhrzeit angeben." };
    newId = (await saveMeeting(actorOf(ctx), ctx.organization.id, id, {
      date, location: str(fd, "location"), participants: str(fd, "participants"), agenda: str(fd, "agenda") || undefined, minutes: str(fd, "minutes"), done: bool(fd, "done"),
    })).id;
    revalidatePath("/asa");
    if (id) revalidatePath(`/asa/${id}`);
  });
  if (!res.error && !id) redirect(`/asa/${newId}`);
  return res;
}
