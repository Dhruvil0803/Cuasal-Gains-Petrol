import React, { useMemo, useState } from "react";
import { StatsCard, EdgeDetailsTable } from "./StatsCard";

const Card = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
    {title && (
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

function AnalyticsDashboard({ graph, model, result }) {
  const [selectedOutcomes, setSelectedOutcomes] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [scenarioMode, setScenarioMode] = useState("percentage");
  const [scenarioValue, setScenarioValue] = useState(0);
  const [scenarioResults, setScenarioResults] = useState(null);

  const stats = useMemo(() => {
    if (!graph) return null;
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const getNodeId = (node) => {
      if (typeof node === "string") return node;
      if (typeof node === "object" && node !== null) return node.id || node.label || String(node);
      return String(node);
    };
    const getSourceId = e => getNodeId(e.source);
    const getTargetId = e => getNodeId(e.target);
    const significantEdges = edges.filter(e => !e.p_value || e.p_value < 0.05);
    const weights = edges.map(e => Math.abs(e.weight || 0));
    const avgWeight = weights.length > 0 ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(3) : 0;
    const maxWeight = weights.length > 0 ? Math.max(...weights).toFixed(3) : 0;
    const minWeight = weights.length > 0 ? Math.min(...weights).toFixed(3) : 0;
    const maxPossibleEdges = nodes.length * (nodes.length - 1);
    const density = maxPossibleEdges > 0 ? (edges.length / maxPossibleEdges).toFixed(3) : 0;
    const degrees = nodes.map(node => {
      const nodeId = getNodeId(node);
      return edges.filter(e => getSourceId(e) === nodeId || getTargetId(e) === nodeId).length;
    });
    const avgDegree = degrees.length > 0 ? (degrees.reduce((a, b) => a + b, 0) / degrees.length).toFixed(2) : 0;
    return { nodeCount: nodes.length, edgeCount: edges.length, significantEdges: significantEdges.length, avgWeight, maxWeight, minWeight, density, avgDegree, edges, nodes, getNodeId, getSourceId, getTargetId };
  }, [graph]);

  const topRelationships = useMemo(() => {
    if (!stats?.edges) return [];
    return [...stats.edges].sort((a, b) => Math.abs(b.weight || 0) - Math.abs(a.weight || 0)).slice(0, 10);
  }, [stats]);

  const nodeCentrality = useMemo(() => {
    if (!stats?.edges || !stats?.nodes) return [];
    const { getNodeId, getSourceId, getTargetId } = stats;
    return stats.nodes.map(node => {
      const nodeId = getNodeId(node);
      const inDegree = stats.edges.filter(e => getTargetId(e) === nodeId).length;
      const outDegree = stats.edges.filter(e => getSourceId(e) === nodeId).length;
      const totalStrength = stats.edges.filter(e => getSourceId(e) === nodeId || getTargetId(e) === nodeId).reduce((s, e) => s + Math.abs(e.weight || 0), 0);
      return { node: nodeId, inDegree, outDegree, totalDegree: inDegree + outDegree, totalStrength: totalStrength.toFixed(3) };
    }).sort((a, b) => b.totalDegree - a.totalDegree);
  }, [stats]);

  const influenceTable = useMemo(() => {
    if (!stats?.edges) return [];
    const { getSourceId, getTargetId } = stats;
    return stats.edges.map(e => ({
      from: getSourceId(e), to: getTargetId(e),
      strength: Math.abs(e.weight || 0).toFixed(3),
      direction: (e.weight || 0) > 0 ? "Positive" : "Negative",
      significant: e.p_value && e.p_value < 0.05 ? "Yes" : "No",
      pValue: e.p_value ? e.p_value.toFixed(4) : "N/A",
    }));
  }, [stats]);

  const runScenario = () => {
    if (!selectedDrivers.length || !selectedOutcomes.length) {
      alert("Select at least one driver and one outcome");
      return;
    }
    const results = [];
    selectedDrivers.forEach(driver => {
      selectedOutcomes.forEach(outcome => {
        const directEdge = stats.edges.find(e => e.source === driver && e.target === outcome);
        if (directEdge) {
          const baselineChange = parseFloat(directEdge.weight || 0);
          const impactMultiplier = scenarioMode === "percentage" ? scenarioValue / 100 : scenarioValue;
          results.push({ driver, outcome, baselineImpact: baselineChange.toFixed(3), predictedOutcome: (baselineChange * impactMultiplier).toFixed(3), confidence: directEdge.p_value && directEdge.p_value < 0.05 ? "High" : "Low" });
        }
      });
    });
    setScenarioResults(results);
  };

  if (!stats || !graph) return null;

  const selectClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all duration-150";
  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all duration-150";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5";

  return (
    <div className="space-y-0 mt-2">
      {/* Network Overview */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Network Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatsCard label="Variables" value={stats.nodeCount} color="blue" />
          <StatsCard label="Relationships" value={stats.edgeCount} color="emerald" />
          <StatsCard label="Significant" value={stats.significantEdges} color="violet" />
          <StatsCard label="Avg Degree" value={stats.avgDegree} color="orange" />
          <StatsCard label="Density" value={stats.density} color="red" />
        </div>
      </div>

      {/* Edge Weights */}
      <Card title="Edge Weight Statistics">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Maximum", value: stats.maxWeight, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Average", value: stats.avgWeight, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Minimum", value: stats.minWeight, color: "text-violet-600", bg: "bg-violet-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-lg p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
              <p className={`text-2xl font-bold ${color} tracking-tight mt-1 font-mono`}>{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Node Centrality */}
      <Card title="Node Centrality">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Variable", "Incoming", "Outgoing", "Total", "Strength"].map((h, i) => (
                  <th key={h} className={`py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500 ${i === 0 ? "text-left" : "text-center"} ${h === "Strength" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodeCentrality.map((n, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/60"}`}>
                  <td className="py-3 px-4 font-medium text-slate-900 text-[13px]">{n.node}</td>
                  <td className="py-3 px-4 text-center text-slate-600 text-[13px]">{n.inDegree}</td>
                  <td className="py-3 px-4 text-center text-slate-600 text-[13px]">{n.outDegree}</td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-900 text-[13px]">{n.totalDegree}</td>
                  <td className="py-3 px-4 text-right font-mono text-[12px] font-semibold text-indigo-600">{n.totalStrength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">Incoming = "affected by others" · Outgoing = "affects others"</p>
      </Card>

      {/* Top Relationships */}
      <Card title="Top Relationships by Strength">
        <EdgeDetailsTable edges={topRelationships} maxRows={10} />
      </Card>

      {/* Influence Matrix */}
      <Card title="Complete Influence Matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["From", "To", "Strength", "Direction", "P-Value", "Sig."].map((h, i) => (
                  <th key={h} className={`py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 ${i < 2 ? "text-left" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {influenceTable.slice(0, 25).map((row, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-slate-50/40" : "bg-white"}`}>
                  <td className="py-2 px-3 font-medium text-slate-800 text-[13px]">{row.from}</td>
                  <td className="py-2 px-3 font-medium text-slate-800 text-[13px]">{row.to}</td>
                  <td className="py-2 px-3 text-center font-mono text-[12px] font-semibold text-indigo-600">{row.strength}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.direction === "Positive" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.direction}</span>
                  </td>
                  <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{row.pValue}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[11px] font-semibold ${row.significant === "Yes" ? "text-emerald-600" : "text-slate-400"}`}>{row.significant}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* What-If */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
          <p className="text-[13px] font-semibold text-slate-900">What-If Scenario Planner</p>
        </div>
        <div className="p-5">
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className={labelClass}>Input Factors (Drivers)</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-1.5 bg-white">
                {stats.nodes.map(node => {
                  const nodeId = stats.getNodeId(node);
                  return (
                    <label key={nodeId} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={selectedDrivers.includes(nodeId)}
                        onChange={e => setSelectedDrivers(e.target.checked ? [...selectedDrivers, nodeId] : selectedDrivers.filter(d => d !== nodeId))}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span className="text-[13px] text-slate-700 group-hover:text-slate-900">{nodeId}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={labelClass}>Outcomes</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-1.5 bg-white">
                {stats.nodes.map(node => {
                  const nodeId = stats.getNodeId(node);
                  return (
                    <label key={nodeId} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={selectedOutcomes.includes(nodeId)}
                        onChange={e => setSelectedOutcomes(e.target.checked ? [...selectedOutcomes, nodeId] : selectedOutcomes.filter(o => o !== nodeId))}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span className="text-[13px] text-slate-700 group-hover:text-slate-900">{nodeId}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className={labelClass}>Change Mode</label>
              <select value={scenarioMode} onChange={e => setScenarioMode(e.target.value)} className={selectClass}>
                <option value="percentage">Percentage Change (%)</option>
                <option value="absolute">Absolute Change</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Value {scenarioMode === "percentage" ? "(%)" : ""}</label>
              <input type="number" value={scenarioValue} onChange={e => setScenarioValue(parseFloat(e.target.value))} placeholder={scenarioMode === "percentage" ? "e.g., 10" : "e.g., 0.5"} className={inputClass} />
            </div>
          </div>
          <button onClick={runScenario} className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-semibold rounded-lg shadow-sm hover:shadow-md hover:shadow-indigo-500/20 transition-all duration-150">
            Run Scenario
          </button>
          {scenarioResults?.length > 0 && (
            <div className="mt-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700 mb-3">Results</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-indigo-200">
                      {["Driver", "Outcome", "Predicted Change", "Confidence"].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResults.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-indigo-100/50" : "bg-indigo-50"}>
                        <td className="py-2 px-2 font-medium text-indigo-900 text-[13px]">{r.driver}</td>
                        <td className="py-2 px-2 font-medium text-indigo-900 text-[13px]">{r.outcome}</td>
                        <td className="py-2 px-2 font-mono text-[12px] font-semibold text-indigo-700">{r.predictedOutcome}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.confidence === "High" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 mb-3">Insights</p>
        <ul className="space-y-2 text-[13px] text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">·</span>
            <span><span className="text-slate-800 font-semibold">Most Connected:</span> {nodeCentrality[0]?.node} — {nodeCentrality[0]?.totalDegree} connections</span>
          </li>
          {topRelationships[0] && (
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">·</span>
              <span>
                <span className="text-slate-800 font-semibold">Strongest Link:</span>{" "}
                {stats.getSourceId(topRelationships[0])} → {stats.getTargetId(topRelationships[0])}{" "}
                <span className="font-mono text-[11px] text-slate-500">(strength: {topRelationships[0]?.weight?.toFixed(3)})</span>
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">·</span>
            <span><span className="text-slate-800 font-semibold">Network Density:</span> {(stats.density * 100).toFixed(1)}%</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">·</span>
            <span><span className="text-slate-800 font-semibold">Significant:</span> {stats.significantEdges} of {stats.edgeCount} relationships ({((stats.significantEdges / (stats.edgeCount || 1)) * 100).toFixed(0)}%)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
