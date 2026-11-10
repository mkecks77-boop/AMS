import { requireOrg } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = { title: "Übersicht" };

const MODULES = [
  "Arbeitsunfälle & Verbandbuch",
  "Schulungen & Qualifikationen",
  "Gefahrstoffverzeichnis",
  "Betriebsanweisungen",
  "Anlagen & Maschinen",
  "Prüfungen & Fristenkalender",
  "Gefährdungsbeurteilungen",
  "Maßnahmen",
];

export default async function Dashboard() {
  const { organization } = await requireOrg("dashboard.view");
  const members = await db.membership.count({ where: { organizationId: organization.id, active: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{organization.name}</h1>
      <div className="card">
        <p className="text-sm text-slate-500">Aktive Nutzer</p>
        <p className="text-3xl font-semibold">{members}</p>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Module (in Vorbereitung)</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <li key={m} className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">{m}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
