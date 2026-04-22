import { useMemo } from "react";
import { StatsCard } from "./StatsCard";

function friendly(label) {
  if (!label) return "";
  return String(label).replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}

const Card = ({ title, children }) => (
  <div className="py-3 border-t border-slate-200">
    {title && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</p>}
    {children}
  </div>
);

const Arrow = () => (
  <svg className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

export default function CausalForestAnalytics({ result, model }) {
  const cfData = useMemo(() => result?.tables?.causal_forest || [], [result]);

  const sorted = useMemo(() =>
    [...cfData].filter(r => typeof r.effect === "number").sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
    [cfData]
  );

  const treatmentCols = useMemo(() => {
    const fromResult = result?.treatment_cols || [];
    if (fromResult.length) return fromResult;
    return [...new Set(cfData.map(r => r.treatment).filter(Boolean))];
  }, [result, cfData]);

  const outcomeCols = useMemo(() => {
    const fromResult = result?.outcome_cols || [];
    if (fromResult.length) return fromResult;
    return [...new Set(cfData.map(r => r.outcome).filter(Boolean))];
  }, [result, cfData]);

  const maxAbs = sorted.length ? Math.abs(sorted[0].effect) : 1;
  const avgMagnitude = cfData.length
    ? (cfData.reduce((s, r) => s + Math.abs(r.effect || 0), 0) / cfData.length).toFixed(3)
    : "0.000";

  if (!result || model !== "causal_forest") return null;

  return (
    <div className="space-y-2 mb-3">
      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-3">
        <StatsCard label="Variables Tested"  value={treatmentCols.length} color="emerald" />
        <StatsCard label="Outcomes Measured" value={outcomeCols.length}   color="emerald" />
        <StatsCard label="Relationships"     value={cfData.length}        color="emerald" />
        <StatsCard label="Avg Impact"         value={avgMagnitude}         color="emerald" />
      </div>

      {/* Relationships */}
      {sorted.length > 0 && (
        <Card title="How Variables Affect Each Other">
          <div className="space-y-1.5">
            {sorted.slice(0, 12).map((r, i) => {
              const positive = r.effect >= 0;
              const barW = maxAbs > 0 ? Math.abs(r.effect) / maxAbs * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(r.treatment)}</span>
                      <Arrow />
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(r.outcome)}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${positive ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[12px] font-bold font-mono ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                    {positive ? "+" : ""}{r.effect.toFixed(3)}
                  </span>
                </div>
              );
            })}
            {sorted.length > 12 && (
              <p className="text-[11px] text-slate-400 px-1 pt-1">Showing top 12 of {sorted.length} relationships</p>
            )}
          </div>
        </Card>
      )}

      {/* Technical details */}
      <Card>
        <details className="group">
          <summary className="cursor-pointer text-[12px] font-bold text-slate-400 hover:text-slate-700 select-none list-none flex items-center gap-2">
            <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Technical Details
          </summary>
          <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 font-mono text-[11px] text-slate-600">
            Causal Forest (Double ML) · 100 trees · Effect = Average Treatment Effect (ATE) · Positive = increasing input raises outcome
          </div>
        </details>
      </Card>
    </div>
  );
}
