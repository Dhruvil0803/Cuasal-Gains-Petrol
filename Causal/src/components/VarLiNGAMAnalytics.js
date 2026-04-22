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

export default function VarLiNGAMAnalytics({ result, model }) {
  const graph = result?.graphs?.varlingam;
  const table = result?.tables?.varlingam;
  const nVars  = table?.n_variables || (graph?.nodes?.length ?? 0);
  const nEdges = table?.n_edges    || (graph?.edges?.length ?? 0);

  const sorted = useMemo(() => {
    const edges = graph?.edges || [];
    return [...edges].filter(e => typeof e.weight === "number").sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  }, [graph]);

  if (!result || model !== "varlingam") return null;

  const maxAbs = sorted.length ? Math.abs(sorted[0].weight) : 1;

  return (
    <div className="space-y-2 mb-3">
      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-3">
        <StatsCard label="Variables"    value={nVars}  color="violet" />
        <StatsCard label="Causal Links" value={nEdges} color="violet" />
      </div>

      {/* Relationships */}
      {sorted.length > 0 && (
        <Card title="Causal Relationships Found">
          <div className="space-y-1.5">
            {sorted.slice(0, 15).map((e, i) => {
              const positive = e.weight >= 0;
              const barW = maxAbs > 0 ? Math.abs(e.weight) / maxAbs * 100 : 0;
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
                      <div className={`h-full rounded-full ${positive ? "bg-violet-400" : "bg-rose-400"}`} style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[12px] font-bold font-mono ${positive ? "text-violet-600" : "text-rose-500"}`}>
                    {positive ? "+" : ""}{e.weight.toFixed(3)}
                  </span>
                </div>
              );
            })}
            {sorted.length > 15 && (
              <p className="text-[11px] text-slate-400 px-1 pt-1">Showing 15 of {sorted.length} relationships</p>
            )}
          </div>
        </Card>
      )}

      {/* Edges without weights */}
      {graph?.edges?.length > 0 && sorted.length === 0 && (
        <Card title="Causal Relationships Found">
          <div className="space-y-1.5">
            {(graph.edges || []).slice(0, 15).map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.source)}</span>
                  <Arrow />
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.target)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Adjacency matrix */}
      {table?.adjacency_matrix && (
        <Card>
          <details className="group">
            <summary className="cursor-pointer text-[12px] font-bold text-slate-400 hover:text-slate-700 select-none list-none flex items-center gap-2">
              <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Adjacency Matrix
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="text-xs border-collapse">
                <tbody>
                  {table.adjacency_matrix.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((v, j) => (
                        <td key={`${i}-${j}`} className="px-2.5 py-2 text-center text-slate-700 font-mono text-[11px] border-r border-slate-100">
                          {typeof v === "number" ? v.toFixed(3) : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
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
            VARLiNGAM · Linear Non-Gaussian Acyclic Model for time series · Edge weight = causal strength coefficient
          </div>
        </details>
      </Card>
    </div>
  );
}
