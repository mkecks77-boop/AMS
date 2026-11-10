import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { isRequired } from "@/lib/trainings";

export const metadata = { title: "Teilnehmerliste" };

/** Unterweisungsnachweis zum Unterschreiben (Inhalt + Teilnehmerliste der Zielgruppe). */
export default async function PrintTraining({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("trainings.view");
  const { id } = await params;
  const t = await db.trainingTopic.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { requirements: true } });
  if (!t) notFound();
  const employees = (await db.employee.findMany({ where: { organizationId: ctx.organization.id, active: true }, include: { department: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }))
    .filter((e) => t.requirements.length === 0 || isRequired(t.requirements, e));
  const blanks = 5;
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-sm text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <p className="text-xs">{ctx.organization.name}</p>
      <h1 className="text-xl font-bold">Nachweis der Unterweisung</h1>
      <p className="mb-4">{t.legalBasis ?? "§ 12 ArbSchG, § 4 DGUV Vorschrift 1"}</p>
      <table className="mb-4 w-full border border-black text-left">
        <tbody>
          <tr><th className="w-40 border border-black p-1">Thema</th><td className="border border-black p-1">{t.title}</td></tr>
          <tr><th className="border border-black p-1">Datum / Uhrzeit</th><td className="border border-black p-1">&nbsp;</td></tr>
          <tr><th className="border border-black p-1">Unterweisende Person</th><td className="border border-black p-1">&nbsp;</td></tr>
          <tr><th className="border border-black p-1">Ort</th><td className="border border-black p-1">&nbsp;</td></tr>
        </tbody>
      </table>
      {t.content && (<><h2 className="font-bold">Inhalte</h2><p className="mb-4 whitespace-pre-line text-xs">{t.content}</p></>)}
      <p className="mb-2 text-xs">Mit meiner Unterschrift bestätige ich, dass ich an der Unterweisung teilgenommen und die Inhalte verstanden habe.</p>
      <table className="w-full border border-black text-left">
        <thead><tr><th className="border border-black p-1">Name, Vorname</th><th className="border border-black p-1">Abteilung</th><th className="w-56 border border-black p-1">Unterschrift</th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}><td className="border border-black p-2">{e.lastName}, {e.firstName}</td><td className="border border-black p-2">{e.department?.name ?? ""}</td><td className="border border-black p-2" /></tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => <tr key={`b${i}`}><td className="border border-black p-3" /><td className="border border-black p-3" /><td className="border border-black p-3" /></tr>)}
        </tbody>
      </table>
      <p className="mt-8">Unterschrift unterweisende Person: ______________________________</p>
    </main>
  );
}
