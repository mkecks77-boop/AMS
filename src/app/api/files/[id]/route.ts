import { NextResponse, type NextRequest } from "next/server";
import { readAttachment } from "@/lib/files";
import { getSession } from "@/lib/session";
import { can } from "@/lib/roles";

/** Download mit Rechteprüfung. Bilder und PDF werden inline angezeigt, alles andere als Download. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const orgId = session?.activeOrganizationId;
  if (!session || !orgId) return new NextResponse("Nicht angemeldet", { status: 401 });
  const membership = session.user.memberships.find((m) => m.organizationId === orgId);
  if (!membership && !session.user.isPlatformAdmin) return new NextResponse("Nicht gefunden", { status: 404 });
  const access = { isPlatformAdmin: session.user.isPlatformAdmin, role: membership?.role ?? null };
  const { id } = await params;
  const file = await readAttachment(orgId, id, (p) => can(access, p));
  if (!file) return new NextResponse("Nicht gefunden", { status: 404 });
  const { attachment: a, data } = file;
  const inline = a.mimeType === "application/pdf" || a.mimeType.startsWith("image/");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(a.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
