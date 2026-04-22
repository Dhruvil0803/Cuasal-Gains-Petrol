export function StatsCard({ label, value, unit = "", color = "blue", trend = null }) {
  const accentClass = {
    blue:    "border-l-indigo-500",
    emerald: "border-l-emerald-500",
    violet:  "border-l-violet-500",
    orange:  "border-l-amber-500",
    red:     "border-l-red-500",
    sky:     "border-l-sky-500",
    rose:    "border-l-rose-500",
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${accentClass[color]} shadow-sm p-3.5 overflow-hidden`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <p className="text-xl font-bold text-slate-900 tracking-tight">{value}</p>
        {unit && <p className="text-xs text-slate-500">{unit}</p>}
      </div>
      {trend && <p className="text-[11px] text-slate-400 mt-2">{trend}</p>}
    </div>
  );
}

export function EdgeDetailsTable({ edges, maxRows = 10 }) {
  const sortedEdges = [...edges].sort((a, b) => Math.abs(b.weight || 0) - Math.abs(a.weight || 0));
  const displayEdges = sortedEdges.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Source</th>
            <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Target</th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Strength</th>
            {edges.some(e => e.lag) && <th className="text-center py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Lag</th>}
          </tr>
        </thead>
        <tbody>
          {displayEdges.map((edge, idx) => {
            const sourceLabel = typeof edge.source === "string" ? edge.source : (edge.source?.label || edge.source?.id || String(edge.source));
            const targetLabel = typeof edge.target === "string" ? edge.target : (edge.target?.label || edge.target?.id || String(edge.target));
            return (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors duration-100">
                <td className="py-3 px-4 font-medium text-slate-900 text-[13px]">{sourceLabel}</td>
                <td className="py-3 px-4 text-slate-600 text-[13px]">{targetLabel}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[12px] font-mono font-semibold ${
                    Math.abs(edge.weight || 0) > 0.5
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {typeof edge.weight === "number" ? edge.weight.toFixed(3) : "—"}
                  </span>
                </td>
{edges.some(e => e.lag) && (
                  <td className="py-3 px-4 text-center text-slate-600 text-[12px]">{edge.lag || "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedEdges.length > maxRows && (
        <p className="text-[11px] text-slate-400 mt-2 px-4 pb-3">
          Showing {maxRows} of {sortedEdges.length} relationships
        </p>
      )}
    </div>
  );
}

export default StatsCard;
