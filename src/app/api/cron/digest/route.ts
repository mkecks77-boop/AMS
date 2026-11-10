import { NextResponse, type NextRequest } from "next/server";
import { sendDigests } from "@/lib/digest";
import { purgeFirstAidEntries } from "@/lib/incidents";
import { db } from "@/lib/db";

/**
 * Täglicher Lauf für einen Cloud-Scheduler (z. B. Vercel Cron, GitHub Actions, Cron-Job des Hosters):
 *   POST /api/cron/digest  mit Header  Authorization: Bearer <CRON_SECRET>
 * Versendet Fristen-E-Mails und löscht abgelaufene Verbandbucheinträge.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const orgs = await db.organization.findMany({ where: { active: true }, select: { id: true } });
  let purged = 0;
  for (const o of orgs) purged += await purgeFirstAidEntries(o.id);
  const digest = await sendDigests();
  return NextResponse.json({ ...digest, purgedFirstAidEntries: purged });
}
