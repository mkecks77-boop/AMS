import QRCode from "qrcode";
import { ActionForm } from "@/components/ActionForm";
import { requireUser } from "@/lib/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { otpauthUri } from "@/lib/totp";
import { changePassword, confirmTotp, disableTotp, saveNotifications, startTotp } from "./actions";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { user } = await requireUser();
  const pending = !user.totpEnabled && user.totpSecret;
  const uri = pending ? otpauthUri(user.totpSecret!, user.email) : null;
  const qr = uri ? await QRCode.toDataURL(uri, { margin: 1, width: 200 }) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <p className="text-sm text-slate-600">{user.name} · {user.email}</p>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Zwei-Faktor-Anmeldung</h2>
        {user.totpEnabled ? (
          <>
            <p className="mb-4 text-sm text-emerald-700">Aktiv – bei jeder Anmeldung wird zusätzlich ein Code aus Ihrer Authenticator-App abgefragt.</p>
            <ActionForm action={disableTotp} submitLabel="Deaktivieren" buttonClassName="btn-secondary" className="flex flex-wrap items-end gap-3">
              <div><label className="label">Aktueller Code</label><input name="code" inputMode="numeric" maxLength={6} required className="input w-36" /></div>
            </ActionForm>
          </>
        ) : pending ? (
          <div className="space-y-4 text-sm">
            <p>1. Scannen Sie den QR-Code mit einer Authenticator-App (z. B. Microsoft Authenticator, Google Authenticator, FreeOTP) oder geben Sie den Schlüssel manuell ein.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR-Code für die Authenticator-App" width={200} height={200} />}
            <p className="font-mono text-xs break-all">{user.totpSecret}</p>
            <p>2. Geben Sie den angezeigten Code ein:</p>
            <ActionForm action={confirmTotp} submitLabel="Aktivieren" className="flex flex-wrap items-end gap-3">
              <div><label className="label">Code</label><input name="code" inputMode="numeric" maxLength={6} required className="input w-36" /></div>
            </ActionForm>
          </div>
        ) : (
          <form action={startTotp}>
            <p className="mb-4 text-sm text-slate-600">Schützt Ihr Konto zusätzlich mit einem Einmal-Code – empfohlen für Admins und externe Fachkräfte mit Zugriff auf mehrere Unternehmen.</p>
            <button className="btn">Einrichten</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Passwort ändern</h2>
        <ActionForm action={changePassword} submitLabel="Passwort ändern">
          <div><label className="label">Aktuelles Passwort</label><input name="current" type="password" required autoComplete="current-password" className="input" /></div>
          <div><label className="label">Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen, Buchstaben und Ziffern)</label><input name="next" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="input" /></div>
          <div><label className="label">Wiederholung</label><input name="repeat" type="password" required autoComplete="new-password" className="input" /></div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Benachrichtigungen</h2>
        <ActionForm action={saveNotifications} submitLabel="Speichern">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailDigest" defaultChecked={user.emailDigest} /> E-Mail mit überfälligen und bald fälligen Fristen (für Admin, Sifa, Führungskräfte)</label>
        </ActionForm>
      </section>
    </div>
  );
}
