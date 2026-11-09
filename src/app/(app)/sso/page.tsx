import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { callbackUrl } from "@/lib/sso";
import { requireOrg } from "@/lib/session";
import { save } from "./actions";

export const metadata = { title: "Single Sign-on" };

export default async function SsoPage() {
  const ctx = await requireOrg("users.manage");
  const cfg = await db.ssoConfig.findUnique({ where: { organizationId: ctx.organization.id } });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Single Sign-on (Unternehmenskonto)</h1>
      <section className="card space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Einrichtung bei Microsoft Entra ID</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Im Entra Admin Center: <em>App-Registrierungen → Neue Registrierung</em>, Kontotyp „Nur Konten in diesem Organisationsverzeichnis“.</li>
          <li>Umleitungs-URI (Web): <code className="rounded bg-slate-100 px-1">{callbackUrl()}</code></li>
          <li><em>Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel</em>; Wert unten als Client-Secret eintragen.</li>
          <li>Issuer: <code className="rounded bg-slate-100 px-1">https://login.microsoftonline.com/&lt;Verzeichnis-ID&gt;/v2.0</code>, Client-ID = Anwendungs-ID.</li>
          <li>Unter <em>Tokenkonfiguration</em> den optionalen Anspruch <code>email</code> hinzufügen (sonst wird <code>preferred_username</code> verwendet).</li>
        </ol>
        <p className="text-slate-500">Andere Anbieter (Google Workspace, Keycloak, Okta …) funktionieren ebenso über OpenID Connect.</p>
      </section>
      <section className="card">
        <ActionForm action={save} submitLabel="Speichern">
          <div><label className="label">Issuer *</label><input name="issuer" required defaultValue={cfg?.issuer ?? ""} placeholder="https://login.microsoftonline.com/…/v2.0" className="input" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Client-ID *</label><input name="clientId" required defaultValue={cfg?.clientId ?? ""} className="input" /></div>
            <div><label className="label">Client-Secret {cfg ? "(leer = unverändert)" : "*"}</label><input name="clientSecret" type="password" autoComplete="off" className="input" /></div>
          </div>
          <div><label className="label">E-Mail-Domains * (durch Komma getrennt)</label><input name="emailDomains" required defaultValue={cfg?.emailDomains.join(", ") ?? ""} placeholder="firma.de, firma.com" className="input" /></div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={cfg?.enabled ?? true} /> aktiviert</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="autoProvision" defaultChecked={cfg?.autoProvision} /> neue Personen beim ersten Login automatisch als Mitarbeiter/in anlegen</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="enforce" defaultChecked={cfg?.enforce} /> Passwort-Anmeldung für diese Domains sperren (nur noch Unternehmenskonto)</label>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
