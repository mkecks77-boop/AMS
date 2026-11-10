import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";
import { getSession } from "@/lib/session";
import { login } from "../actions/auth";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { reset } = await searchParams;
  return (
    <AuthCard title="Anmelden">
      {reset && (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Neues Passwort gespeichert. Bitte melden Sie sich an.
        </p>
      )}
      <ActionForm action={login} submitLabel="Anmelden">
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
