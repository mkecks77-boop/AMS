import { NextResponse, type NextRequest } from "next/server";
import { finishSso } from "@/lib/sso";
import { createSession } from "@/lib/session";
import { UserError } from "@/lib/users";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  try {
    const { userId, organizationId } = await finishSso({ code: p.get("code"), state: p.get("state"), error: p.get("error") });
    await createSession(userId, organizationId);
    return NextResponse.redirect(new URL("/", base));
  } catch (e) {
    const msg = e instanceof UserError ? e.message : "Die Anmeldung ist fehlgeschlagen.";
    if (!(e instanceof UserError)) console.error("SSO-Fehler", e);
    return NextResponse.redirect(new URL(`/login?sso_error=${encodeURIComponent(msg)}`, base));
  }
}
