import { incidentStats } from "@/lib/incidents";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Unfallkennzahlen" };

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireOrg("incidents.view");
  const year = Number((await searchParams).year) || new Date().getUTCFullYear();
  const [s, prev] = await Promise.all([incidentStats(ctx.organization.id, year), incidentStats(ctx.organization.id, year - 1)]);
  const max = Math.max(1, ...s.byMonth.map((m) => m.accidents + m.nearMisses));
  const tiles: [string, string | number, string | number][] = [
    ["Arbeitsunfälle", s.accidents, prev.accidents],
    ["davon meldepflichtig", s.reportable, prev.reportable],
    ["Ausfalltage", s.lostDays, prev.lostDays],
    ["1000-Mann-Quote", s.thousandRate ?? "–", prev.thousandRate ?? "–"],
    ["Wegeunfälle", s.commuting, prev.commuting],
    ["Beinaheunfälle", s.nearMisses, prev.nearMisses],
    ["Unsichere Zustände", s.unsafe, prev.unsafe],
    ["Verbandbuch-Einträge", s.firstAid, prev.firstAid],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Unfallkennzahlen {year}</h1>
        <form className="flex gap-2">
          <select name="year" defaultValue={String(year)} className="input w-auto">{Array.from({ length: 6 }, (_, i) => new Date().getUTCFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
          <button className="btn-secondary">Anzeigen</button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, v, p]) => (
          <div key={label} className="card !p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-semibold">{v}</p>
            <p className="text-xs text-slate-500">Vorjahr: {p}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">1000-Mann-Quote = meldepflichtige Arbeitsunfälle je 1000 Beschäftigte (Näherung über aktive Beschäftigte, {s.employees}). Je mehr Beinaheunfälle gemeldet werden, desto besser die Präventionskultur.</p>
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Verlauf nach Monat</h2>
        <div className="flex h-48 items-end gap-2">
          {s.byMonth.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col justify-end" style={{ height: "160px" }}>
                <div title={`${m.nearMisses} Beinaheunfälle`} className="w-full rounded-t bg-amber-300" style={{ height: `${(m.nearMisses / max) * 100}%` }} />
                <div title={`${m.accidents} Unfälle`} className="w-full bg-red-500" style={{ height: `${(m.accidents / max) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs"><span className="flex items-center gap-1"><span className="h-3 w-3 bg-red-500" /> Arbeitsunfälle</span><span className="flex items-center gap-1"><span className="h-3 w-3 bg-amber-300" /> Beinaheunfälle</span></div>
      </section>
    </div>
  );
}
