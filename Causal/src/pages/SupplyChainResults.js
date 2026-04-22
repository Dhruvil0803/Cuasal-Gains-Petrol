import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGraph } from "../context/GraphContext";
import PCAnalytics from "../components/PCAnalytics";
import CausalForestAnalytics from "../components/CausalForestAnalytics";
import VarLiNGAMAnalytics from "../components/VarLiNGAMAnalytics";
import PCMCIAnalytics from "../components/PCMCIAnalytics";
import GrangerAnalytics from "../components/GrangerAnalytics";
import SimulateInline from "../components/SimulateInline";
import Layout from "../components/Layout";

const MODEL_META = [
  { key: "pc",            label: "Causal Map",        color: "indigo",  tabActive: "border-indigo-500 text-indigo-700"  },
  { key: "causal_forest", label: "Impact Analysis",   color: "emerald", tabActive: "border-emerald-500 text-emerald-700" },
  { key: "varlingam",     label: "Time Patterns",     color: "violet",  tabActive: "border-violet-500 text-violet-700"  },
  { key: "pcmci",         label: "Time Links",        color: "sky",     tabActive: "border-sky-500 text-sky-700"        },
  { key: "granger",       label: "Predictive Links",  color: "rose",    tabActive: "border-rose-500 text-rose-700"      },
  { key: "simulate",      label: "Simulate",          color: "orange",  tabActive: "border-orange-500 text-orange-700"  },
];

export default function SupplyChainResults() {
  const nav = useNavigate();
  const { causalResults, loading, file } = useGraph();
  const [activeTab, setActiveTab] = useState(null);

  const availableTabs = MODEL_META.filter(t => {
    if (t.key === "pc")            return !!causalResults?.graphs?.pc;
    if (t.key === "causal_forest") return !!(causalResults?.graphs?.causal_forest || causalResults?.tables?.causal_forest);
    if (t.key === "varlingam")     return !!causalResults?.graphs?.varlingam;
    if (t.key === "pcmci")         return !!causalResults?.graphs?.pcmci;
    if (t.key === "granger")       return !!causalResults?.graphs?.granger;
    if (t.key === "simulate")      return true;
    return false;
  });

  const currentTab = (activeTab && availableTabs.find(t => t.key === activeTab)) ? activeTab : availableTabs[0]?.key;

  const pcEdges     = causalResults?.graphs?.pc?.edges || [];
  const driverCount = {};
  pcEdges.forEach(e => { driverCount[e.source] = (driverCount[e.source] || 0) + 1; });
  const topDriver = Object.entries(driverCount).sort((a, b) => b[1] - a[1])[0];
  const cfRows    = causalResults?.tables?.causal_forest || [];
  const maxEffect = cfRows.length ? Math.max(...cfRows.filter(r => r.effect != null).map(r => Math.abs(r.effect))).toFixed(3) : null;
  const nVars     = causalResults?.meta?.n_cols;

  if (!causalResults) {
    return (
      <Layout>
        <div className="bg-slate-900 min-h-screen flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
          </div>
          <h2 className="text-[22px] font-bold text-white mb-6">{loading ? "Running analysis…" : "No results yet"}</h2>
          <button onClick={() => nav("/explore")} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[14px] font-semibold hover:bg-indigo-500 transition-colors">
            Back to Explorer
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header zone — dark, with inline KPIs */}
      <div className="bg-slate-900">
        <div className="max-w-screen-xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Analysis Complete</p>
              <h1 className="text-[28px] font-bold text-white tracking-tight">Causal Results</h1>
            </div>
            <button
              onClick={() => nav("/explore")}
              className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-[13px] font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-all mt-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Explorer
            </button>
          </div>

          {/* Inline KPI strip */}
          <div className="flex items-center gap-0 border border-slate-700 rounded-xl overflow-hidden">
            {[
              { label: "Top Driver",   value: topDriver ? topDriver[0].replace(/_/g, " ") : "—" },
              { label: "Causal Links", value: pcEdges.length },
              { label: "Largest Impact", value: maxEffect ?? "—" },
              { label: "Variables",    value: nVars ?? "—" },
            ].map((kpi, i) => (
              <div key={kpi.label} className={`flex-1 px-4 py-3.5 ${i < 3 ? "border-r border-slate-700" : ""}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{kpi.label}</p>
                <p className="text-[18px] font-bold text-white leading-none capitalize">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Model pills + warnings */}
          <div className="flex flex-col gap-1.5 mt-3">
            {availableTabs.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {availableTabs.map(t => (
                  <span key={t.key} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">{t.label}</span>
                ))}
              </div>
            )}
            {causalResults.warnings?.length > 0 && (
              <div className="flex flex-col gap-1">
                {causalResults.warnings.map((w, i) => (
                  <span key={i} className="text-[11px] text-amber-400">⚠ {w}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content zone — light */}
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <div className="grid grid-cols-1">

            {/* Analytics — full width */}
            <div>
              {availableTabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-slate-200 rounded-2xl bg-white">
                  <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-bold text-slate-800 mb-1">No model results available</p>
                  <p className="text-[12px] text-slate-500 mb-4 max-w-xs">
                    All selected models failed or returned no output. Check the warnings above for details.
                  </p>
                  <button
                    onClick={() => nav("/explore")}
                    className="px-4 py-2 bg-slate-900 text-white text-[12px] font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Back to Explorer
                  </button>
                </div>
              ) : (
                <>
                  {availableTabs.length > 1 && (
                    <div className="flex border-b border-slate-200 mb-3">
                      {availableTabs.map(t => (
                        <button
                          key={t.key}
                          onClick={() => setActiveTab(t.key)}
                          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-all -mb-px ${
                            currentTab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <PCAnalytics           result={causalResults} model={currentTab === "pc"            ? "pc"            : "__none__"} />
                  <CausalForestAnalytics result={causalResults} model={currentTab === "causal_forest" ? "causal_forest" : "__none__"} />
                  <VarLiNGAMAnalytics    result={causalResults} model={currentTab === "varlingam"     ? "varlingam"     : "__none__"} />
                  <PCMCIAnalytics        result={causalResults} model={currentTab === "pcmci"         ? "pcmci"         : "__none__"} />
                  <GrangerAnalytics      result={causalResults} model={currentTab === "granger"       ? "granger"       : "__none__"} />
                  {currentTab === "simulate" && (
                    <SimulateInline file={file} />
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
