"use server";

import type { CauseCategory, IncidentStatus, IncidentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { nowWallClock, parseDate, parseDateTime } from "@/lib/dates";
import { CAUSE_LABELS, convertFirstAidEntry, INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, updateIncident } from "@/lib/incidents";
import { bool, int, str, type FormState } from "@/lib/form";

export async function saveIncident(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("incidents.manage");
  const id = str(fd, "id");
  const type = str(fd, "type");
  const status = str(fd, "status");
  const cause = str(fd, "causeCategory");
  const occurredAt = parseDateTime(str(fd, "occurredAt"));
  const lost = int(fd, "lostDays");
  return run(async () => {
    if (!occurredAt) return { error: "Bitte Datum und Uhrzeit angeben." };
    if (lost != null && Number.isNaN(lost)) return { error: "Ungültige Ausfalltage." };
    await updateIncident(actorOf(ctx), ctx.organization.id, id, {
      type: (type in INCIDENT_TYPE_LABELS ? type : "ACCIDENT") as IncidentType,
      occurredAt,
      siteId: str(fd, "siteId"),
      location: str(fd, "location"),
      employeeId: str(fd, "employeeId"),
      personName: str(fd, "personName"),
      activity: str(fd, "activity"),
      description: str(fd, "description"),
      injury: str(fd, "injury"),
      bodyPart: str(fd, "bodyPart"),
      witnesses: str(fd, "witnesses"),
      firstAider: str(fd, "firstAider"),
      doctorVisit: bool(fd, "doctorVisit"),
      lostDays: lost ?? 0,
      fatal: bool(fd, "fatal"),
      status: (status in INCIDENT_STATUS_LABELS ? status : undefined) as IncidentStatus | undefined,
      causeCategory: (cause in CAUSE_LABELS ? cause : null) as CauseCategory | null,
      rootCause: str(fd, "rootCause"),
      reportedToBgAt: parseDate(str(fd, "reportedToBgAt")),
    }, nowWallClock());
    revalidatePath(`/incidents/${id}`);
  });
}

export async function convertEntry(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("incidents.manage");
  let id = "";
  const res = await run(async () => {
    id = (await convertFirstAidEntry(actorOf(ctx), ctx.organization.id, str(fd, "id"), nowWallClock())).id;
  });
  if (!res.error) redirect(`/incidents/${id}`);
  return res;
}
