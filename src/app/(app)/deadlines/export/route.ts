import { NextResponse, type NextRequest } from "next/server";
import { DUE_LABELS, formatDate } from "@/lib/dates";
import { getDeadlines } from "@/lib/deadlines";
import { requireOrg } from "@/lib/session";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const { organization } = await requireOrg("deadlines.view");
  const p = req.nextUrl.searchParams;
  const months = Math.min(Math.max(Number(p.get("range")) || 12, 1), 60);
  const until = new Date();
  until.setUTCMonth(until.getUTCMonth() + months);
  const items = await getDeadlines(organization.id, { siteId: p.get("site") || null, until });
  const csv = toCsv([
    ["Fällig am", "Status", "Art", "Prüfung/Aufgabe", "Gegenstand", "Standort", "Hinweis"],
    ...items.map((d) => [formatDate(d.dueAt), DUE_LABELS[d.status], d.sourceLabel, d.title, d.subject, d.siteName ?? "", d.info ?? ""]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fristen-${organization.slug}.csv"`,
    },
  });
}
