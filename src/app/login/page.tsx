import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { ActionForm } from "@/components/ActionForm";
import { ssoLogin } from "../actions/auth";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; sso_error?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { reset, sso_error } = await searchParams;
  return (
    <AuthCard title="Anmelden">
      {reset && (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Neues Passwort gespeichert. Bitte melden Sie sich an.
        </p>
      )}
      {sso_error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{sso_error}</p>}
      <LoginForm />
      <details className="mt-6 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">Mit Unternehmenskonto anmelden (z. B. Microsoft)</summary>
        <ActionForm action={ssoLogin} submitLabel="Weiter zum Anmeldedienst" className="mt-3 space-y-3">
          <input name="email" type="email" required placeholder="name@firma.de" autoComplete="username" className="input" />
        </ActionForm>
      </details>
    </AuthCard>
  );
}
