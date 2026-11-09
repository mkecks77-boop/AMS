import type { Role } from "@prisma/client";
import { db } from "./db";
import { DUE_LABELS, formatDate } from "./dates";
import { getDeadlines, type Deadline } from "./deadlines";
import { sendMail } from "./mail";

/** Rollen, die die Fristen-Zusammenfassung erhalten */
const DIGEST_ROLES: Role[] = ["ORG_ADMIN", "SAFETY_OFFICER", "MANAGER"];

export function digestText(orgName: string, items: Deadline[], appUrl: string): string {
  const groups = (["overdue", "due30"] as const).map((s) => ({ s, list: items.filter((d) => d.status === s) }));
  const lines = [`Fristen-Übersicht für ${orgName}`, ""];
  for (const { s, list } of groups) {
    if (!list.length) continue;
    lines.push(`${DUE_LABELS[s].toUpperCase()} (${list.length})`);
    for (const d of list) lines.push(`- ${formatDate(d.dueAt)} · ${d.sourceLabel}: ${d.title} – ${d.subject}`);
    lines.push("");
  }
  lines.push(`Alle Fristen: ${appUrl}/deadlines`, "", "Diese E-Mail können Sie in Ihrem Profil abbestellen.");
  return lines.join("\n");
}

/** Versendet je Unternehmen eine Zusammenfassung überfälliger und in 30 Tagen fälliger Fristen. */
export async function sendDigests(now = new Date()) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const orgs = await db.organization.findMany({ where: { active: true } });
  let sent = 0, skipped = 0;
  for (const org of orgs) {
    const items = (await getDeadlines(org.id, {}, now)).filter((d) => d.status === "overdue" || d.status === "due30");
    if (!items.length) continue;
    const recipients = await db.membership.findMany({
      where: { organizationId: org.id, active: true, role: { in: DIGEST_ROLES }, user: { active: true, emailDigest: true, passwordHash: { not: null } } },
      include: { user: true },
    });
    const text = digestText(org.name, items, appUrl);
    for (const r of recipients) {
      (await sendMail(r.user.email, `AMS – ${items.length} Fristen bei ${org.name}`, text)) ? sent++ : skipped++;
    }
  }
  return { sent, skipped };
}
