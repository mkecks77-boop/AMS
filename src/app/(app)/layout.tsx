import Link from "next/link";
import { NavGroup } from "@/components/NavGroup";
import { requireOrg } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { logout, switchOrganization } from "../actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const { user, organization, role } = ctx;
  const item = (href: string, label: string, show: boolean) => (show ? [{ href, label }] : []);
  const groups = [
    { label: "Ereignisse", items: [
      ...item("/incidents", "Unfälle & Ereignisse", ctx.can("incidents.view")),
      ...item("/firstaid", "Verbandbuch", ctx.can("firstaid.view")),
      ...item("/actions", "Maßnahmen", ctx.can("actions.view")),
    ] },
    { label: "Gefährdungen", items: [
      ...item("/risk", "Gefährdungsbeurteilungen", ctx.can("risk.view")),
      ...item("/walkthroughs", "Begehungen", ctx.can("walkthroughs.view")),
      ...item("/substances", "Gefahrstoffe", ctx.can("substances.view")),
      ...item("/instructions", "Betriebsanweisungen", ctx.can("instructions.view")),
    ] },
    { label: "Betrieb", items: [
      ...item("/equipment", "Anlagen & Maschinen", ctx.can("equipment.view")),
      ...item("/ppe", "PSA", ctx.can("ppe.view")),
      ...item("/contractors", "Fremdfirmen", ctx.can("contractors.view")),
      ...item("/permits", "Erlaubnisscheine", ctx.can("permits.request")),
    ] },
    { label: "Personal", items: [
      ...item("/trainings", "Unterweisungen", ctx.can("trainings.view")),
      ...item("/trainings/matrix", "Schulungsmatrix", ctx.can("trainings.view")),
      ...item("/qualifications", "Qualifikationen", ctx.can("trainings.view")),
      ...item("/medical", "Arbeitsmedizinische Vorsorge", ctx.can("medical.view")),
      ...item("/appointments", "Beauftragte", ctx.can("appointments.view")),
      ...item("/employees", "Mitarbeiter", ctx.can("masterdata.view")),
    ] },
    { label: "Sifa", items: [
      ...item("/asa", "Arbeitsschutzausschuss", ctx.can("asa.view")),
      ...item("/legal", "Rechtskataster", ctx.can("legal.view")),
      ...item("/time", "Einsatzzeit", ctx.can("reports.view")),
      ...item("/print/annual", "Jahresbericht", ctx.can("reports.view")),
    ] },
    { label: "Verwaltung", items: [
      ...item("/sites", "Standorte & Abteilungen", ctx.can("masterdata.manage")),
      ...item("/users", "Nutzer", ctx.can("users.manage")),
      ...item("/audit", "Protokoll", ctx.can("audit.view")),
      ...item("/platform", "Plattform", user.isPlatformAdmin),
    ] },
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
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Übersicht</Link>
            {ctx.can("deadlines.view") && <Link href="/deadlines" className="rounded px-2 py-1 text-slate-700 hover:bg-slate-100">Fristen</Link>}
            {groups.map((g) => <NavGroup key={g.label} label={g.label} items={g.items} />)}
            {ctx.can("incidents.report") && <Link href="/report" className="ml-1 rounded bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700">Melden</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/profile" className="text-slate-600 hover:text-[var(--brand)]" title="Profil, Passwort, Zwei-Faktor-Anmeldung">
              {user.name} · {role ? ROLE_LABELS[role] : "Plattform-Admin"}
            </Link>
            <form action={logout}><button className="btn-secondary">Abmelden</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
