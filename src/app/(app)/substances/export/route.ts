import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { cmrCategory, GHS_PICTOGRAMS, SIGNAL_WORD_LABELS } from "@/lib/ghs";
import { requireOrg } from "@/lib/session";
import { toCsv } from "@/lib/csv";

/** Gefahrstoffverzeichnis nach § 6 Abs. 12 GefStoffV als CSV */
export async function GET(req: NextRequest) {
  const { organization } = await requireOrg("substances.view");
  const site = req.nextUrl.searchParams.get("site");
  const items = await db.hazardousSubstance.findMany({
    where: { organizationId: organization.id, status: "APPROVED", ...(site ? { uses: { some: { siteId: site } } } : {}) },
    include: { uses: { include: { site: true } } },
    orderBy: { name: "asc" },
  });
  const csv = toCsv([
    ["Produkt", "Hersteller", "CAS", "Verwendung", "Piktogramme", "Signalwort", "H-Sätze", "P-Sätze", "CMR", "Lagerklasse", "WGK", "Arbeitsbereiche und Mengen", "SDB vom", "Substitutionsprüfung"],
    ...items.map((s) => [
      s.name,
      s.manufacturer ?? "",
      s.casNumber ?? "",
      s.usage ?? "",
      s.pictograms.map((p) => `${p} ${GHS_PICTOGRAMS[p]}`).join(", "),
      s.signalWord === "NONE" ? "" : SIGNAL_WORD_LABELS[s.signalWord],
      s.hStatements.join(", "),
      s.pStatements.map((p) => p.replace(/_/g, "+")).join(", "),
      cmrCategory(s.hStatements) ? `Kat. ${cmrCategory(s.hStatements)}` : "",
      s.storageClass ?? "",
      s.waterHazardClass ?? "",
      s.uses.map((u) => `${u.workArea}${u.site ? ` (${u.site.name})` : ""}${u.quantity != null ? `: ${u.quantity} ${u.unit ?? ""}`.trimEnd() : ""}`).join("; "),
      formatDate(s.sdsDate),
      s.substitutionChecked ? s.substitutionNotes || "durchgeführt" : "offen",
    ]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gefahrstoffverzeichnis-${organization.slug}.csv"`,
    },
  });
}
