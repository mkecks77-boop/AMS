import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { logout, switchOrganization } from "../actions/auth";

export const metadata = { title: "Unternehmen wählen" };

export default async function SelectOrgPage() {
  const { user } = await requireUser();
  return (
    <AuthCard title="Unternehmen wählen">
      {user.memberships.length === 0 ? (
        <p className="text-sm text-slate-600">Sie sind derzeit keinem aktiven Unternehmen zugeordnet.</p>
      ) : (
        <ul className="space-y-2">
          {user.memberships.map((m) => (
            <li key={m.id}>
              <form action={switchOrganization}>
                <input type="hidden" name="organizationId" value={m.organizationId} />
                <button className="w-full rounded-md border border-slate-200 p-3 text-left hover:border-[var(--brand)] hover:bg-emerald-50">
                  <span className="block font-medium">{m.organization.name}</span>
                  <span className="text-sm text-slate-500">
                    {ROLE_LABELS[m.role]}
                    {m.external && " · extern"}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex gap-3">
        {user.isPlatformAdmin && <Link href="/platform" className="btn-secondary">Plattform-Verwaltung</Link>}
        <form action={logout}><button className="btn-secondary">Abmelden</button></form>
      </div>
    </AuthCard>
  );
}
