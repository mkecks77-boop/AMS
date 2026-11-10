import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Alarmplan" };

/** Alarmplan als Aushang (A4), angelehnt an die übliche Gestaltung „Verhalten im Brandfall“ (DIN 14096 Teil A) */
export default async function PrintEmergency({ params }: { params: Promise<{ siteId: string }> }) {
  const ctx = await requireOrg("emergency.view");
  const { siteId } = await params;
  const p = await db.emergencyPlan.findFirst({ where: { siteId, organizationId: ctx.organization.id }, include: { site: true } });
  if (!p) notFound();
  const Box = ({ color, title, children }: { color: string; title: string; children: React.ReactNode }) => (
    <section className="mb-3 border-4" style={{ borderColor: color }}>
      <h2 className="px-3 py-1 text-lg font-extrabold uppercase text-white" style={{ backgroundColor: color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>{title}</h2>
      <div className="space-y-1 p-3 text-base">{children}</div>
    </section>
  );
  return (
    <main className="mx-auto max-w-[760px] bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <h1 className="text-center text-3xl font-black">ALARMPLAN</h1>
      <p className="mb-4 text-center">{ctx.organization.name} · {p.site.name}{p.site.address && ` · ${p.site.address}`}</p>
      <Box color="#c4161c" title="Notruf">
        <p className="text-2xl font-black">Feuerwehr / Rettungsdienst: {p.fireBrigade}</p>
        {p.internalEmergency && <p className="text-xl font-bold">Interner Notruf: {p.internalEmergency}</p>}
        <p>Wer meldet? · Was ist passiert? · Wo ist es passiert? · Wie viele Verletzte? · Warten auf Rückfragen!</p>
        {p.poisonCenter && <p>Giftnotruf: {p.poisonCenter}</p>}
      </Box>
      <Box color="#c4161c" title="Brand melden – in Sicherheit bringen">
        <p>Feuermelder betätigen bzw. Notruf wählen{p.alarmSignal && ` · Alarmsignal: ${p.alarmSignal}`}</p>
        <p>Gefährdete Personen warnen, Hilflose mitnehmen, Türen schließen.</p>
        <p>Gekennzeichneten Fluchtwegen folgen. <strong>Aufzug nicht benutzen!</strong></p>
        <p className="text-xl font-bold">Sammelplatz: {p.assemblyPoint}</p>
        <p>Löschversuch nur ohne Eigengefährdung unternehmen.</p>
      </Box>
      <Box color="#008a4b" title="Erste Hilfe">
        <p>Ersthelfer verständigen{p.firstAidRooms && ` · Erste Hilfe / Verbandkasten: ${p.firstAidRooms}`}</p>
        {p.aedLocations && <p>Defibrillator (AED): {p.aedLocations}</p>}
        {p.dArzt && <p>Durchgangsarzt: {p.dArzt}</p>}
        {p.doctorOnDuty && <p>Betriebsarzt / Notdienst: {p.doctorOnDuty}</p>}
      </Box>
      {(p.evacuationHelpers || p.notes) && (
        <Box color="#1d5fa8" title="Organisation">
          {p.evacuationHelpers && <p>Räumungs- / Brandschutzhelfer: {p.evacuationHelpers}</p>}
          {p.notes && <p className="whitespace-pre-line">{p.notes}</p>}
        </Box>
      )}
      <p className="text-right text-xs">Stand: {formatDate(p.reviewedAt)}</p>
    </main>
  );
}
