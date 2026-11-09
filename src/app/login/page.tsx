import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

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
      <LoginForm />
    </AuthCard>
  );
}
