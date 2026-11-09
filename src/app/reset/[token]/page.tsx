import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { setNewPassword } from "../../actions/auth";

export const metadata = { title: "Neues Passwort" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthCard title="Neues Passwort festlegen">
      <ActionForm action={setNewPassword} submitLabel="Passwort speichern">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="password">Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen, Buchstaben und Ziffern)</label>
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} className="input" autoComplete="new-password" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
