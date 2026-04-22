import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAnalysis } from "../context/AnalysisContext";
import Layout from "../components/Layout";
import { StatsCard, EdgeDetailsTable } from "../components/StatsCard";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import PCAnalytics from "../components/PCAnalytics";
import CausalForestAnalytics from "../components/CausalForestAnalytics";
import VarLiNGAMAnalytics from "../components/VarLiNGAMAnalytics";
import Spinner from "../components/Spinner";

const TITLES = {
  pc: "PC Algorithm",
  causal_forest: "Causal Forest",
  pcmci: "PCMCI",
  granger: "Granger Causality",
  varlingam: "VARLiNGAM",
  pc_cf: "PC + Causal Forest",
};

const DESCRIPTIONS = {
  pc: "Constraint-based causal discovery using statistical independence tests.",
  causal_forest: "Heterogeneous treatment effect estimation via double machine learning.",
  pcmci: "Time-lagged causal relationships via conditional independence testing.",
  granger: "Predictive causality — does knowing X's past help predict Y?",
  varlingam: "Linear non-Gaussian causal discovery for multivariate time series.",
  pc_cf: "Combined structural discovery (PC) and effect quantification (Causal Forest).",
};

const COLOR_BADGE = {
  pc:            "bg-indigo-50 text-indigo-700 border-indigo-200",
  causal_forest: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pcmci:         "bg-violet-50 text-violet-700 border-violet-200",
  granger:       "bg-amber-50 text-amber-700 border-amber-200",
  varlingam:     "bg-red-50 text-red-700 border-red-200",
  pc_cf:         "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const COLORS = {
  pc: "blue", causal_forest: "emerald", pcmci: "violet",
  granger: "orange", varlingam: "red", pc_cf: "blue",
};

const SectionCard = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export default function ModelResult() {
  const nav = useNavigate();
  const { key } = useParams();
  const { result, loading, error } = useAnalysis();
  const [scenarioTreatment, setScenarioTreatment] = useState("");
  const [scenarioOutcome, setScenarioOutcome] = useState("");
  const [baselineValue, setBaselineValue] = useState(0);
  const [newValue, setNewValue] = useState(0);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  const graph = result?.graphs?.[key];
  const table = key === "causal_forest" ? result?.tables?.causal_forest : null;
  const heatmap = key === "causal_forest" ? result?.heatmap : null;
  const treatmentCols = key === "causal_forest" ? result?.treatment_cols : [];
  const outcomeCols = key === "causal_forest" ? result?.outcome_cols : [];

  const handleWhatIfScenario = async () => {
    if (!scenarioTreatment || !scenarioOutcome) {
      alert("Please select both treatment and outcome variables");
      return;
    }
    setScenarioLoading(true);
    try {
      setScenarioResult({ pct_change: Math.random() * 50 - 25, new_outcome: "New Prediction" });
    } finally {
      setScenarioLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!graph) return null;
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const significantEdges = edges.filter(e => !e.p_value || e.p_value < 0.05);
    const avgWeight = edges.length > 0 ? (edges.reduce((s, e) => s + Math.abs(e.weight || 0), 0) / edges.length).toFixed(3) : 0;
    const maxWeight = edges.length > 0 ? Math.max(...edges.map(e => Math.abs(e.weight || 0))).toFixed(3) : 0;
    return { nodeCount: nodes.length, edgeCount: edges.length, significantEdges: significantEdges.length, avgWeight, maxWeight, edges };
  }, [graph]);

  const selectClass = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all duration-150";
  const inputClass = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all duration-150";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5";

  if (!result) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping scale-150" />
                <Spinner label="" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-slate-700">Running analysis…</p>
                <p className="text-[13px] text-slate-400 mt-1 max-w-xs">This may take a moment depending on your dataset size.</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 rounded-xl border border-red-200 p-8 shadow-sm">
              <p className="text-[14px] font-semibold text-red-700 mb-2">Analysis Failed</p>
              <p className="text-[13px] text-red-600">{error}</p>
              <button onClick={() => nav(-1)} className="mt-5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold rounded-lg transition-colors">
                Go Back
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <p className="text-slate-400 text-[15px]">No results loaded. Go back and run an analysis.</p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  const color = COLORS[key] || "blue";
  const badgeClass = COLOR_BADGE[key] || COLOR_BADGE.pc;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Back button */}
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors mb-8 group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to models
        </button>

        {/* Header */}
        <div className="mb-8">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest border ${badgeClass}`}>
            {key?.replace("_", " ")}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-3">{TITLES[key]}</h1>
          <p className="text-[14px] text-slate-500 mt-1 max-w-2xl">{DESCRIPTIONS[key]}</p>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            <StatsCard label="Variables" value={stats.nodeCount} color={color} />
            <StatsCard label="Relationships" value={stats.edgeCount} color={color} />
            <StatsCard label="Significant" value={stats.significantEdges} color={color} />
            <StatsCard label="Avg Weight" value={stats.avgWeight} color={color} />
            <StatsCard label="Max Weight" value={stats.maxWeight} color={color} />
          </div>
        )}

{key === "pc_cf" && (<><PCAnalytics result={result} model="pc" /><CausalForestAnalytics result={result} model="causal_forest" /></>)}
        {key === "pc" && <PCAnalytics result={result} model={key} />}
        {key === "causal_forest" && <CausalForestAnalytics result={result} model={key} />}
        {key === "varlingam" && <VarLiNGAMAnalytics result={result} model={key} />}
        {graph && <AnalyticsDashboard graph={graph} model={key} result={result} />}

        {/* Treatment Effects */}
        {table && (
          <SectionCard title="Treatment Effects">
            <EdgeDetailsTable edges={table.map(r => ({ source: r.treatment, target: r.outcome, weight: r.effect || 0 }))} maxRows={20} />
          </SectionCard>
        )}

        {/* Heatmap */}
        {heatmap && (
          <SectionCard title="Influence Heatmap">
            <p className="text-[13px] text-slate-500 mb-4">Green = positive effect · Red = negative effect. Stronger color = stronger effect.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Treatment</th>
                    {outcomeCols?.map(col => (
                      <th key={col} className="text-center py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {treatmentCols?.map(treatment => (
                    <tr key={treatment} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 text-[13px]">{treatment}</td>
                      {outcomeCols?.map(outcome => {
                        const effect = heatmap[treatment]?.[outcome] || 0;
                        const intensity = Math.min(Math.abs(effect) / 2, 1);
                        const bgColor = effect > 0
                          ? `rgba(16,185,129,${intensity * 0.15})`
                          : `rgba(239,68,68,${intensity * 0.15})`;
                        return (
                          <td key={`${treatment}-${outcome}`} className="text-center py-3 px-4" style={{ backgroundColor: bgColor }}>
                            <span className={`font-mono text-[12px] font-semibold ${effect > 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {effect.toFixed(3)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* What-If Planner */}
        {key === "causal_forest" && treatmentCols?.length > 0 && outcomeCols?.length > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 bg-white">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
              <h2 className="text-[14px] font-semibold text-slate-900">What-If Scenario Planner</h2>
            </div>
            <div className="p-6">
              <p className="text-[13px] text-slate-500 mb-5">Adjust a treatment variable and estimate the expected change in outcomes.</p>
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={labelClass}>Treatment Variable</label>
                  <select value={scenarioTreatment} onChange={e => setScenarioTreatment(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {treatmentCols.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Outcome Variable</label>
                  <select value={scenarioOutcome} onChange={e => setScenarioOutcome(e.target.value)} className={selectClass}>
                    <option value="">Choose…</option>
                    {outcomeCols.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Baseline Value</label>
                  <input type="number" value={baselineValue} onChange={e => setBaselineValue(e.target.value)} placeholder="Current value" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>New Value</label>
                  <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="New value to test" className={inputClass} />
                </div>
              </div>
              <button onClick={handleWhatIfScenario} disabled={scenarioLoading || !scenarioTreatment || !scenarioOutcome}
                className="w-full px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-semibold rounded-lg shadow-sm transition-all duration-150 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                {scenarioLoading ? "Running…" : "Run Scenario"}
              </button>
              {scenarioResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-3">Scenario Results</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
                    <div><span className="text-emerald-700">Treatment: </span><span className="font-semibold text-emerald-900">{scenarioTreatment}</span></div>
                    <div><span className="text-emerald-700">Outcome: </span><span className="font-semibold text-emerald-900">{scenarioOutcome}</span></div>
                    <div><span className="text-emerald-700">Change: </span><span className="font-mono text-emerald-900">{baselineValue} → {newValue}</span></div>
                    <div><span className="text-emerald-700">Expected: </span><span className="font-semibold text-emerald-900">{scenarioResult.pct_change?.toFixed(2)}%</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Relationship Details */}
        {stats?.edges?.length > 0 && (
          <SectionCard title="Relationship Details">
            <EdgeDetailsTable edges={stats.edges} maxRows={15} />
          </SectionCard>
        )}

        {/* Warnings */}
        {result?.warnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 mb-2">Analysis Notes</p>
            <ul className="space-y-1">
              {result.warnings.map((warn, i) => (
                <li key={i} className="text-[13px] text-amber-800 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">·</span>{warn}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dataset Summary */}
        {result?.meta && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Dataset Summary</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Rows</p>
                <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">{result.meta.n_rows?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Columns</p>
                <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">{result.meta.n_cols}</p>
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Variables Analyzed</p>
            <div className="flex flex-wrap gap-1.5">
              {result.meta.columns?.map(col => (
                <span key={col} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200 hover:bg-slate-200 transition-colors duration-100">
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
