import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { requireOrg } from "@/lib/session";
import { changeMembership, invite, resetLink } from "./actions";

export const metadata = { title: "Nutzer" };

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="role" defaultValue={defaultValue ?? "EMPLOYEE"} className="input">
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}

export default async function UsersPage() {
  const { organization, user: me } = await requireOrg("users.manage");
  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: organization.id },
      include: { user: true },
      orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
    }),
    db.invitation.findMany({
      where: { organizationId: organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Nutzerverwaltung</h1>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Person einladen</h2>
        <ActionForm action={invite} submitLabel="Einladen">
          <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">E-Mail</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label">Rolle</label>
            <RoleSelect />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="external" /> Externe Person (z. B. externe Sifa, externer Prüfer)
          </label>
          </div>
        </ActionForm>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold">Mitglieder ({members.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 align-top">
                <td className="py-3 font-medium">
                  {m.user.name}
                  {m.external && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">extern</span>}
                </td>
                <td className="py-3">{m.user.email}</td>
                <td className="py-3">
                  <ActionForm action={changeMembership} submitLabel="Ändern" className="flex gap-2">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <RoleSelect defaultValue={m.role} />
                  </ActionForm>
                </td>
                <td className="py-3">{m.active ? "aktiv" : "deaktiviert"}</td>
                <td className="space-y-2 py-3">
                  {m.userId !== me.id && (
                    <ActionForm action={changeMembership} submitLabel={m.active ? "Deaktivieren" : "Aktivieren"} className="">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                    </ActionForm>
                  )}
                  {m.user.passwordHash && m.userId !== me.id && (
                    <ActionForm action={resetLink} submitLabel="Passwort-Link" className="">
                      <input type="hidden" name="userId" value={m.userId} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {invitations.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Offene Einladungen</h2>
          <ul className="space-y-1 text-sm">
            {invitations.map((i) => (
              <li key={i.id}>
                {i.email} · {ROLE_LABELS[i.role]} · gültig bis {i.expiresAt.toLocaleDateString("de-DE")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
