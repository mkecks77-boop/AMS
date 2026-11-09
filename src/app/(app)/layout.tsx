import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { logout, switchOrganization } from "../actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const { user, organization, role } = ctx;
  const nav = [
    { href: "/", label: "Übersicht", show: true },
    { href: "/deadlines", label: "Fristen", show: ctx.can("deadlines.view") },
    { href: "/equipment", label: "Anlagen", show: ctx.can("equipment.view") },
    { href: "/substances", label: "Gefahrstoffe", show: ctx.can("substances.view") },
    { href: "/instructions", label: "Betriebsanweisungen", show: ctx.can("instructions.view") },
    { href: "/trainings", label: "Unterweisungen", show: ctx.can("trainings.view") },
    { href: "/employees", label: "Mitarbeiter", show: ctx.can("masterdata.view") },
    { href: "/sites", label: "Standorte", show: ctx.can("masterdata.manage") },
    { href: "/users", label: "Nutzer", show: ctx.can("users.manage") },
    { href: "/audit", label: "Protokoll", show: ctx.can("audit.view") },
    { href: "/platform", label: "Plattform", show: user.isPlatformAdmin },
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="font-semibold text-[var(--brand)]">AMS</Link>
          {user.memberships.length > 1 || user.isPlatformAdmin ? (
            <form action={switchOrganization} className="flex items-center gap-2">
              <label htmlFor="org" className="sr-only">Unternehmen</label>
              <select id="org" name="organizationId" defaultValue={organization.id} className="input w-auto py-1">
                {!user.memberships.some((m) => m.organizationId === organization.id) && (
                  <option value={organization.id}>{organization.name}</option>
                )}
                {user.memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>{m.organization.name}</option>
                ))}
              </select>
              <button className="btn-secondary">Wechseln</button>
            </form>
          ) : (
            <span className="text-sm font-medium">{organization.name}</span>
          )}
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {nav.filter((n) => n.show).map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-700 hover:text-[var(--brand)]">{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user.name} · {role ? ROLE_LABELS[role] : "Plattform-Admin"}
            </span>
            <form action={logout}><button className="btn-secondary">Abmelden</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
