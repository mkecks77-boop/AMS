import { requireOrg } from "@/lib/session";
import { SubstanceForm } from "../SubstanceForm";

export const metadata = { title: "Gefahrstoff beantragen" };

export default async function NewSubstance() {
  await requireOrg("substances.edit");
  return (
    <div className="card">
      <h1 className="mb-2 text-2xl font-semibold">Neuen Gefahrstoff beantragen</h1>
      <p className="mb-6 text-sm text-slate-500">
        Angaben aus dem Sicherheitsdatenblatt (Abschnitte 2, 7, 8 und 15) übernehmen. Die Fachkraft für Arbeitssicherheit prüft und gibt frei.
      </p>
      <SubstanceForm />
    </div>
  );
}
