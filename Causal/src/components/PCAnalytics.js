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

export default function PCAnalytics({ result, model }) {
  const pcData = result?.tables?.pc;
  const graph  = result?.graphs?.pc;

  const business = useMemo(() => {
    if (!graph) return { topDrivers: [], topImpacted: [], isolated: [] };
    const edges = graph.edges || [];
    const out = {}, inn = {};
    edges.forEach(e => { out[e.source] = (out[e.source] || 0) + 1; inn[e.target] = (inn[e.target] || 0) + 1; });
    return {
      topDrivers:  Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => friendly(k)),
      topImpacted: Object.entries(inn).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => friendly(k)),
      isolated:    (graph.nodes || []).map(n => n.id).filter(id => !out[id] && !inn[id]).slice(0, 3).map(friendly),
    };
  }, [graph]);

  if (!result || model !== "pc") return null;
  if (!pcData || !graph) return null;
  const { n_variables, n_edges } = pcData;

  return (
    <div className="space-y-2 mb-3">
      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-3">
        <StatsCard label="Variables Analysed" value={n_variables} color="indigo" />
        <StatsCard label="Causal Links Found"  value={n_edges}    color="indigo" />
      </div>

      {/* Key variables */}
      <Card title="Key Variables">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { heading: "Most Influential", items: business.topDrivers,  desc: "Drive changes in other variables" },
            { heading: "Most Affected",    items: business.topImpacted, desc: "Shaped by other variables" },
            { heading: "Independent",      items: business.isolated,    desc: "No direct causal connections" },
          ].map(({ heading, items, desc }) => (
            <div key={heading} className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
              <p className="text-[11px] font-bold text-slate-700 mb-0.5">{heading}</p>
              <p className="text-[10px] text-slate-400 mb-2">{desc}</p>
              {items.length
                ? items.map((n, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[12px] text-slate-700 mb-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{n}
                    </div>
                  ))
                : <span className="text-[12px] text-slate-300">—</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Relationships */}
      {graph?.edges?.length > 0 && (
        <Card title="Causal Relationships Found">
          <div className="space-y-1.5">
            {graph.edges.slice(0, 15).map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.source)}</span>
                  <Arrow />
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{friendly(e.target)}</span>
                </div>
                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Causal
                </span>
              </div>
            ))}
            {graph.edges.length > 15 && (
              <p className="text-[11px] text-slate-400 px-1 pt-1">Showing 15 of {graph.edges.length} relationships</p>
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
            PC Algorithm · Fisher-Z independence test · Results show statistically significant conditional dependencies
          </div>
        </details>
      </Card>
    </div>
  );
}
