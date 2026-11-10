import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Protokoll" };

const LABELS: Record<string, string> = {
  login: "Anmeldung",
  "member.added": "Mitglied hinzugefügt",
  "member.invited": "Person eingeladen",
  "member.updated": "Mitgliedschaft geändert",
  "invitation.accepted": "Einladung angenommen",
  "password.reset_link_created": "Passwort-Link erstellt",
  "organization.created": "Unternehmen angelegt",
  "organization.activated": "Unternehmen aktiviert",
  "organization.deactivated": "Unternehmen deaktiviert",
};

export default async function AuditPage() {
  const { organization } = await requireOrg("audit.view");
  const logs = await db.auditLog.findMany({
    where: { organizationId: organization.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="card overflow-x-auto">
      <h1 className="mb-4 text-2xl font-semibold">Protokoll</h1>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500"><tr><th className="py-2">Zeitpunkt</th><th>Person</th><th>Aktion</th><th>Details</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="py-2 whitespace-nowrap">{l.createdAt.toLocaleString("de-DE")}</td>
              <td className="py-2">{l.user?.name ?? "–"}</td>
              <td className="py-2">{LABELS[l.action] ?? l.action}</td>
              <td className="py-2 font-mono text-xs text-slate-500">{l.details ? JSON.stringify(l.details) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
