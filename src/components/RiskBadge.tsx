import { riskLevel, riskScore, RISK_LABELS, type RiskLevel } from "@/lib/risk";

const STYLE: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-200 text-orange-900",
  very_high: "bg-red-600 text-white",
};

export function RiskBadge({ p, s }: { p: number | null; s: number | null }) {
  if (p == null || s == null) return <span className="text-xs text-slate-400">nicht bewertet</span>;
  const l = riskLevel(p, s);
  return <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLE[l]}`}>{riskScore(p, s)} · {RISK_LABELS[l]}</span>;
}

/** 5×5-Matrix mit Anzahl der Gefährdungen je Feld */
export function RiskMatrix({ points }: { points: { p: number; s: number }[] }) {
  const cell = (p: number, s: number) => STYLE[riskLevel(p, s)];
  return (
    <div className="inline-block text-xs">
      <div className="grid grid-cols-[auto_repeat(5,2.5rem)] gap-0.5">
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="contents">
            <span className="pr-2 text-right leading-10 text-slate-500">W{p}</span>
            {[1, 2, 3, 4, 5].map((s) => {
              const n = points.filter((x) => x.p === p && x.s === s).length;
              return <span key={s} className={`h-10 w-10 rounded text-center text-sm font-semibold leading-10 ${cell(p, s)}`}>{n || ""}</span>;
            })}
          </div>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map((s) => <span key={s} className="text-center text-slate-500">S{s}</span>)}
      </div>
      <p className="mt-1 text-slate-500">W = Wahrscheinlichkeit, S = Schadensschwere</p>
    </div>
  );
}
