import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { mailConfigured } from "@/lib/mail";
import { switchOrganization } from "../actions/auth";
import { createOrg, toggleOrg } from "./actions";

export const metadata = { title: "Plattform" };

export default async function PlatformPage() {
  await requirePlatformAdmin();
  const mails = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const orgs = await db.organization.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: { where: { active: true } } } } },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plattform-Verwaltung</h1>
        <Link href="/select-org" className="btn-secondary">Zu den Unternehmen</Link>
      </div>
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Neues Unternehmen</h2>
        <ActionForm action={createOrg} submitLabel="Anlegen">
          <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="slug">Kurzname (optional)</label><input id="slug" name="slug" className="input" /></div>
          <div><label className="label" htmlFor="adminEmail">E-Mail erster Admin</label><input id="adminEmail" name="adminEmail" type="email" required className="input" /></div>
          </div>
        </ActionForm>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold">Unternehmen ({orgs.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Name</th><th>Kurzname</th><th>Nutzer</th><th>Status</th><th /></tr></thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{o.name}</td>
                <td>{o.slug}</td>
                <td>{o._count.memberships}</td>
                <td>{o.active ? "aktiv" : "gesperrt"}</td>
                <td className="flex gap-2 py-2">
                  {o.active && (
                    <form action={switchOrganization}>
                      <input type="hidden" name="organizationId" value={o.id} />
                      <button className="btn-secondary">Öffnen</button>
                    </form>
                  )}
                  <form action={toggleOrg}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                    <button className="btn-secondary">{o.active ? "Sperren" : "Aktivieren"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-lg font-semibold">E-Mail-Versandprotokoll</h2>
        <p className="mb-3 text-sm text-slate-500">{mailConfigured() ? "SMTP ist konfiguriert." : "SMTP ist nicht konfiguriert (SMTP_URL) – E-Mails werden nur protokolliert."}</p>
        <table className="w-full text-left text-sm">
          <tbody>{mails.map((m) => <tr key={m.id} className="border-t border-slate-100"><td className="py-1">{m.createdAt.toLocaleString("de-DE")}</td><td>{m.to}</td><td>{m.subject}</td><td>{m.sent ? "versendet" : <span className="text-amber-700">{m.error}</span>}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
