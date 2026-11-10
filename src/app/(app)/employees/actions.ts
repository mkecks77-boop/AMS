"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { actorOf, run } from "@/lib/actions";
import { parseDate } from "@/lib/dates";
import { saveEmployee as save } from "@/lib/masterdata";
import { bool, str, type FormState } from "@/lib/form";

export async function saveEmployee(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireOrg("masterdata.manage");
  const id = str(fd, "id") || null;
  const result = await run(async () => {
    await save(actorOf(ctx), ctx.organization.id, id, {
      personnelNumber: str(fd, "personnelNumber"),
      firstName: str(fd, "firstName"),
      lastName: str(fd, "lastName"),
      jobTitle: str(fd, "jobTitle"),
      siteId: str(fd, "siteId"),
      departmentId: str(fd, "departmentId"),
      apprentice: bool(fd, "apprentice"),
      entryDate: parseDate(str(fd, "entryDate")),
      exitDate: parseDate(str(fd, "exitDate")),
      active: id ? bool(fd, "active") : true,
    });
    revalidatePath("/employees");
  });
  if (!result.error && id) redirect("/employees");
  return result.error ? result : { message: "Mitarbeiter/in angelegt." };
}
