import { PrintButton } from "@/components/PrintButton";
import { annualReport } from "@/lib/annual";
import { formatDate } from "@/lib/dates";
import { requireOrg } from "@/lib/session";
import { formatHours, TIME_CATEGORIES } from "@/lib/timelog";

export const metadata = { title: "Jahresbericht" };

/** Jahresbericht der Fachkraft für Arbeitssicherheit (§ 5 ASiG) – zugleich Grundlage der Managementbewertung */
export default async function AnnualReport({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireOrg("reports.view");
  const year = Number((await searchParams).year) || new Date().getUTCFullYear() - 1;
  const [r, p] = await Promise.all([annualReport(ctx.organization.id, year), annualReport(ctx.organization.id, year - 1)]);
  const Row = ({ label, value, prev }: { label: string; value: string | number | null; prev?: string | number | null }) => (
    <tr><th className="w-2/3 border border-black p-1 text-left font-normal">{label}</th><td className="border border-black p-1 text-right font-semibold">{value ?? "–"}</td>{prev !== undefined && <td className="border border-black p-1 text-right text-slate-600">{prev ?? "–"}</td>}</tr>
  );
  return (
    <main className="mx-auto max-w-[800px] bg-white p-6 text-sm text-black print:p-0">
      <div className="mb-4 flex justify-end gap-3 print:hidden">
        <form className="flex gap-2"><select name="year" defaultValue={String(year)} className="input w-auto">{Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - i).map((y) => <option key={y}>{y}</option>)}</select><button className="btn-secondary">Jahr</button></form>
        <PrintButton />
      </div>
      <p className="text-xs">{ctx.organization.name}</p>
      <h1 className="text-xl font-bold">Jahresbericht Arbeitssicherheit {year}</h1>
      <p className="mb-4 text-xs">Bericht der Fachkraft für Arbeitssicherheit nach § 5 ASiG · erstellt am {formatDate(new Date())}</p>

      <h2 className="mt-4 font-bold">1. Unfallgeschehen</h2>
      <table className="w-full border border-black"><thead><tr><th className="border border-black p-1" /><th className="border border-black p-1 text-right">{year}</th><th className="border border-black p-1 text-right">Vorjahr</th></tr></thead>
        <tbody>
          <Row label="Arbeitsunfälle" value={r.incidents.accidents} prev={p.incidents.accidents} />
          <Row label="davon meldepflichtig (> 3 Tage AU)" value={r.incidents.reportable} prev={p.incidents.reportable} />
          <Row label="Ausfalltage" value={r.incidents.lostDays} prev={p.incidents.lostDays} />
          <Row label="1000-Mann-Quote" value={r.incidents.thousandRate} prev={p.incidents.thousandRate} />
          <Row label="Wegeunfälle" value={r.incidents.commuting} prev={p.incidents.commuting} />
          <Row label="Beinaheunfälle / unsichere Zustände" value={r.incidents.nearMisses + r.incidents.unsafe} prev={p.incidents.nearMisses + p.incidents.unsafe} />
          <Row label="Einträge im Verbandbuch" value={r.incidents.firstAid} prev={p.incidents.firstAid} />
        </tbody>
      </table>

      <h2 className="mt-4 font-bold">2. Gefährdungen und Prüfungen</h2>
      <table className="w-full border border-black"><tbody>
        <Row label="Freigegebene Gefährdungsbeurteilungen" value={r.risks} />
        <Row label="davon Überprüfung überfällig" value={r.risksOverdue} />
        <Row label="Durchgeführte Begehungen / mittlerer Erfüllungsgrad" value={`${r.walkthroughs} / ${r.avgCompliance != null ? `${r.avgCompliance} %` : "–"}`} />
        <Row label="Durchgeführte Prüfungen von Arbeitsmitteln / davon nicht bestanden" value={`${r.inspections} / ${r.inspectionsFailed}`} />
        <Row label="Derzeit überfällige Prüfpflichten" value={r.overdueObligations} />
        <Row label="Gefahrstoffe im Verzeichnis / davon CMR" value={`${r.substances} / ${r.cmrSubstances}`} />
        <Row label="Freigegebene Betriebsanweisungen" value={r.instructionsReleased} />
      </tbody></table>

      <h2 className="mt-4 font-bold">3. Maßnahmen, Unterweisung, Organisation</h2>
      <table className="w-full border border-black"><tbody>
        <Row label="Neue Maßnahmen / erledigte Maßnahmen" value={`${r.actionsCreated} / ${r.actionsDone}`} />
        <Row label="Derzeit überfällige Maßnahmen" value={r.actionsOpenOverdue} />
        <Row label="Erfüllungsquote Unterweisungen (aktuell)" value={`${r.trainingRate} %`} />
        <Row label="Ersthelfer/innen mit gültigem Nachweis" value={r.firstAiders} />
        <Row label="Sitzungen des Arbeitsschutzausschusses" value={`${r.asaMeetings} (Soll: 4)`} />
      </tbody></table>

      <h2 className="mt-4 font-bold">4. Einsatzzeit der Fachkraft für Arbeitssicherheit</h2>
      <table className="w-full border border-black"><tbody>
        {r.time.byCategory.map((c) => <Row key={c.category} label={TIME_CATEGORIES[c.category]} value={formatHours(c.minutes)} />)}
        <Row label="Summe" value={`${formatHours(r.time.total)}${r.organization.sifaHoursTarget ? ` von ${r.organization.sifaHoursTarget} h Soll` : ""}`} />
      </tbody></table>

      <h2 className="mt-4 font-bold">5. Bewertung und Empfehlungen</h2>
      <div className="h-40 border border-black" />
      <div className="mt-12 grid grid-cols-2 gap-10 text-xs"><p className="border-t border-black pt-1">Fachkraft für Arbeitssicherheit</p><p className="border-t border-black pt-1">Kenntnisnahme Unternehmensleitung</p></div>
    </main>
  );
}
