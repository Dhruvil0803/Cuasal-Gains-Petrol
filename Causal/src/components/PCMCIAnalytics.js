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

export default function PCMCIAnalytics({ result, model }) {
  const edges = useMemo(() => result?.graphs?.pcmci?.edges || [], [result]);

  const sorted = useMemo(() =>
    [...edges].sort((a, b) => (a.p_value ?? 1) - (b.p_value ?? 1)),
    [edges]
  );

  const byLag = useMemo(() => {
    const m = {};
    edges.forEach(e => { const l = e.lag ?? 1; if (!m[l]) m[l] = 0; m[l]++; });
    return m;
  }, [edges]);

  if (!result || model !== "pcmci") return null;

  const nVars  = result?.meta?.n_cols ?? 0;
  const nEdges = edges.length;
  const lags   = edges.map(e => e.lag).filter(Boolean);
  const maxLag = lags.length ? Math.max(...lags) : 0;
  return (
    <div className="space-y-2 mb-3">
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        <StatsCard label="Variables"        value={nVars}   color="sky" />
        <StatsCard label="Causal Links"     value={nEdges}  color="sky" />
        <StatsCard label="Time Periods"     value={maxLag}  color="sky" />
      </div>

      {nEdges === 0 && (
        <div className="py-6 text-center text-[13px] text-slate-400 border border-slate-100 rounded-xl bg-slate-50">
          No significant time-lagged relationships found at the current α threshold.
        </div>
      )}

      {/* Relationships */}
      {sorted.length > 0 && (
        <Card title="Time-Lagged Relationships Found">
          <div className="space-y-1.5">
            {sorted.slice(0, 15).map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.source)}</span>
                  <Arrow />
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.target)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100">
                    Lag {e.lag}
                  </span>
                </div>
              </div>
            ))}
            {sorted.length > 15 && (
              <p className="text-[11px] text-slate-400 px-1 pt-1">Showing 15 of {sorted.length} relationships</p>
            )}
          </div>
        </Card>
      )}

      {/* By lag */}
      {Object.keys(byLag).length > 0 && (
        <Card title="Links by Time Lag">
          <div className="flex flex-wrap gap-2">
            {Object.entries(byLag).sort(([a], [b]) => Number(a) - Number(b)).map(([lag, count]) => (
              <div key={lag} className="flex-1 min-w-[80px] bg-white border border-slate-100 rounded-lg px-3 py-2.5 text-center">
                <p className="text-[18px] font-bold text-sky-600 leading-none mb-1">{count}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lag {lag}</p>
              </div>
            ))}
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
            PCMCI · Conditional independence test: ParCorr · X at t-k causes Y means past X helps explain Y beyond Y's own history
          </div>
        </details>
      </Card>
    </div>
  );
}
