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

export default function GrangerAnalytics({ result, model }) {
  const edges = useMemo(() => result?.graphs?.granger?.edges || [], [result]);

  const sorted = useMemo(() =>
    [...edges].sort((a, b) => (a.p_value ?? 1) - (b.p_value ?? 1)),
    [edges]
  );

  if (!result || model !== "granger") return null;

  const nVars  = result?.meta?.n_cols ?? 0;
  const nEdges = edges.length;
  const avgWeight = edges.length
    ? (edges.reduce((s, e) => s + (e.weight ?? 0), 0) / edges.length).toFixed(3)
    : "0.000";

  const maxWeight = sorted.length ? Math.max(...sorted.map(e => Math.abs(e.weight ?? 0))) : 1;

  return (
    <div className="space-y-2 mb-3">
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        <StatsCard label="Variables"        value={nVars}      color="rose" />
        <StatsCard label="Causal Links"     value={nEdges}     color="rose" />
        <StatsCard label="Avg Strength"     value={avgWeight}  color="rose" />
      </div>

      {nEdges === 0 && (
        <div className="py-6 text-center text-[13px] text-slate-400 border border-slate-100 rounded-xl bg-slate-50">
          No significant Granger-causal relationships found at the current α threshold.
        </div>
      )}

      {/* Relationships */}
      {sorted.length > 0 && (
        <Card title="Predictive Relationships Found">
          <div className="space-y-1.5">
            {sorted.slice(0, 15).map((e, i) => {
              const strength = e.weight ?? 0;
              const barW = maxWeight > 0 ? Math.abs(strength) / maxWeight * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.source)}</span>
                      <Arrow />
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.target)}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                      Lag {e.lag}
                    </span>
                  </div>
                </div>
              );
            })}
            {sorted.length > 15 && (
              <p className="text-[11px] text-slate-400 px-1 pt-1">Showing 15 of {sorted.length} relationships</p>
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
            Granger causality · F-test (SSR) · X predicts Y if past values of X improve prediction of Y beyond Y's own past
          </div>
        </details>
      </Card>
    </div>
  );
}
