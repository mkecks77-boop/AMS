"use server";

import type { IncidentType } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { nowWallClock, parseDateTime } from "@/lib/dates";
import { addFirstAidEntry, INCIDENT_TYPE_LABELS, reportIncident } from "@/lib/incidents";
import { bool, int, str, type FormState } from "@/lib/form";

export async function submitIncident(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("incidents.report");
  const type = str(fd, "type");
  const occurredAt = parseDateTime(str(fd, "occurredAt"));
  let id = "";
  const res = await run(async () => {
    if (!occurredAt) return { error: "Bitte Datum und Uhrzeit angeben." };
    const lost = int(fd, "lostDays");
    const inc = await reportIncident(actorOf(ctx), ctx.organization.id, {
      type: (type in INCIDENT_TYPE_LABELS ? type : "NEAR_MISS") as IncidentType,
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
      lostDays: lost == null || Number.isNaN(lost) ? 0 : lost,
    }, nowWallClock());
    id = inc.id;
  }, "Meldung gespeichert. Danke!");
  if (!res.error && ctx.can("incidents.view")) redirect(`/incidents/${id}`);
  return res;
}

export async function submitFirstAid(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("incidents.report");
  const occurredAt = parseDateTime(str(fd, "occurredAt"));
  return run(async () => {
    if (!occurredAt) return { error: "Bitte Datum und Uhrzeit angeben." };
    await addFirstAidEntry(actorOf(ctx), ctx.organization.id, {
      occurredAt,
      siteId: str(fd, "siteId"),
      location: str(fd, "location"),
      employeeId: str(fd, "employeeId"),
      personName: str(fd, "personName"),
      description: str(fd, "description"),
      injury: str(fd, "injury"),
      measures: str(fd, "measures"),
      firstAider: str(fd, "firstAider"),
      witnesses: str(fd, "witnesses"),
    }, nowWallClock());
  }, "Eintrag ins Verbandbuch gespeichert.");
}
