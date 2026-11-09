import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";
import { ROLE_LABELS } from "@/lib/roles";
import { findOpenInvitation } from "@/lib/users";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { acceptInvite } from "../../actions/auth";

export const metadata = { title: "Einladung annehmen" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findOpenInvitation(token);
  if (!inv) {
    return (
      <AuthCard title="Einladung ungültig">
        <p className="text-sm text-slate-600">
          Der Link ist abgelaufen oder wurde bereits verwendet. Bitten Sie um eine neue Einladung.
        </p>
        <Link href="/login" className="btn mt-6">Zur Anmeldung</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Einladung: ${inv.organization.name}`}>
      <p className="mb-4 text-sm text-slate-600">
        Sie wurden als <strong>{ROLE_LABELS[inv.role]}</strong> eingeladen ({inv.email}). Legen Sie
        Ihren Namen und ein Passwort fest.
      </p>
      <ActionForm action={acceptInvite} submitLabel="Konto anlegen">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen, Buchstaben und Ziffern)</label>
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} className="input" autoComplete="new-password" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
