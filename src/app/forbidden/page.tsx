import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export default function Forbidden() {
  return (
    <AuthCard title="Keine Berechtigung">
      <p className="text-sm text-slate-600">Für diese Seite fehlt Ihnen die nötige Rolle.</p>
      <Link href="/" className="btn mt-6">Zur Startseite</Link>
    </AuthCard>
  );
}
