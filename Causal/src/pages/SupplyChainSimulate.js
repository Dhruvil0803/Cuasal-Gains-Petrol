import { useState, useRef, useCallback } from "react";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import API_BASE from "../config";

// Friendly display names for known planning variables
const VAR_META = {
  forecast:            { label: "Forecast",             desc: "Planned demand for the period",                  group: "Planning",     color: "indigo"  },
  receipts:            { label: "Receipts",              desc: "Units received from suppliers",                  group: "Planning",     color: "indigo"  },
  shipments:           { label: "Shipments",             desc: "Units shipped to customers",                     group: "Planning",     color: "indigo"  },
  inventory:           { label: "Inventory",             desc: "Current on-hand stock level",                    group: "Planning",     color: "indigo"  },
  inventory_turn:      { label: "Inventory Turn",        desc: "How often inventory cycles per year",            group: "Performance",  color: "violet"  },
  days_on_hand:        { label: "Days on Hand",          desc: "Days of supply currently available",             group: "Performance",  color: "violet"  },
  marketing_spend:     { label: "Marketing Spend",       desc: "Investment in marketing activities",             group: "Marketing",    color: "rose"    },
  marketing_index:     { label: "Marketing Index",       desc: "Effectiveness of marketing efforts",             group: "Marketing",    color: "rose"    },
  composite_index:     { label: "Composite Index",       desc: "Combined demand signal indicator",               group: "Marketing",    color: "rose"    },
  spm:                 { label: "Sales per Machine",     desc: "Sales efficiency per unit of equipment",         group: "Marketing",    color: "rose"    },
  supplier_fill_rate:  { label: "Supplier Fill Rate",    desc: "% of orders fulfilled on time by supplier",      group: "Supplier",     color: "amber"   },
  supplier_lead_time:  { label: "Supplier Lead Time",    desc: "Days from order placement to delivery",          group: "Supplier",     color: "amber"   },
  rdc_inventory:       { label: "RDC Inventory",         desc: "Stock held at distribution centers",             group: "Operations",   color: "sky"     },
  dealer_inventory:    { label: "Dealer Inventory",      desc: "Units stocked across the dealer network",        group: "Dealer",       color: "emerald" },
};

// Group color styles
const GROUP_COLORS = {
  Planning:    { dot: "bg-indigo-500",  badge: "bg-indigo-50 text-indigo-700 border-indigo-200",  ring: "ring-indigo-400 bg-indigo-50/50 border-indigo-200"  },
  Performance: { dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 border-violet-200",  ring: "ring-violet-400 bg-violet-50/50 border-violet-200"  },
  Marketing:   { dot: "bg-rose-500",    badge: "bg-rose-50 text-rose-700 border-rose-200",        ring: "ring-rose-400 bg-rose-50/50 border-rose-200"        },
  Supplier:    { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",     ring: "ring-amber-400 bg-amber-50/50 border-amber-200"     },
  Operations:  { dot: "bg-sky-500",     badge: "bg-sky-50 text-sky-700 border-sky-200",           ring: "ring-sky-400 bg-sky-50/50 border-sky-200"           },
  Dealer:      { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200",ring: "ring-emerald-400 bg-emerald-50/50 border-emerald-200"},
  Other:       { dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200",    ring: "ring-slate-300 bg-slate-50 border-slate-200"        },
};

// Quick-start scenario templates
const TEMPLATES = [
  { label: "Forecast goes up 10%",         variable: "forecast",           delta:  10 },
  { label: "Supplier delays increase",      variable: "supplier_lead_time", delta:  20 },
  { label: "Marketing spend increases",     variable: "marketing_spend",    delta:  15 },
  { label: "Inventory reduced by 15%",      variable: "inventory",          delta: -15 },
  { label: "Supplier fill rate drops",      variable: "supplier_fill_rate", delta: -10 },
  { label: "Shipments increase 10%",        variable: "shipments",          delta:  10 },
];

function getMeta(col) {
  return VAR_META[col] || {
    label: col.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    desc:  col.replace(/_/g, " "),
    group: "Other",
    color: "slate",
  };
}

function formatValue(val, col) {
  if (col === "supplier_fill_rate") return `${(val * 100).toFixed(1)}%`;
  if (col === "marketing_spend")    return `$${val.toLocaleString()}`;
  if (Math.abs(val) > 999)          return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function ImpactLevel({ pct }) {
  const abs = Math.abs(pct);
  if (abs >= 10) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">High Impact</span>;
  if (abs >= 3)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Moderate</span>;
  return              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Minor</span>;
}

export default function SupplyChainSimulate() {
  const fileRef = useRef(null);

  const [file, setFile]           = useState(null);
  const [fileName, setFileName]   = useState("");
  const [columns, setColumns]     = useState([]);
  const [colStats, setColStats]   = useState({});
  const [nRows, setNRows]         = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  const [selectedVar, setSelectedVar] = useState(null);
  const [deltaPct, setDeltaPct]       = useState(10);
  const [running, setRunning]         = useState(false);
  const [results, setResults]         = useState(null);
  const [runError, setRunError]       = useState(null);

  // Upload and detect columns
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setUploading(true);
    setUploadErr(null);
    setResults(null);
    setSelectedVar(null);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch(`${API_BASE}/sim/columns`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFile(f);
      setFileName(f.name);
      setColumns(data.columns || []);
      setColStats(data.column_stats || {});
      setNRows(data.n_rows || 0);
    } catch (e) {
      setUploadErr(e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const loadSample = useCallback(async () => {
    setUploading(true);
    setUploadErr(null);
    try {
      const res = await fetch("/sample_planning_data.csv");
      const blob = await res.blob();
      const f = new File([blob], "sample_planning_data.csv", { type: "text/csv" });
      await handleFile(f);
    } catch (e) {
      setUploadErr("Could not load sample data");
      setUploading(false);
    }
  }, [handleFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  // Apply template
  const applyTemplate = (tpl) => {
    if (columns.includes(tpl.variable)) {
      setSelectedVar(tpl.variable);
      setDeltaPct(tpl.delta);
      setResults(null);
    }
  };

  // Run simulation
  const runSimulation = async () => {
    if (!file || !selectedVar) return;
    setRunning(true);
    setRunError(null);
    setResults(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("config_json", JSON.stringify({ treatment_col: selectedVar, delta_pct: deltaPct }));
    try {
      const res = await fetch(`${API_BASE}/simulate`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // Group columns
  const grouped = {};
  columns.forEach(col => {
    const g = getMeta(col).group;
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(col);
  });




  // ─── Upload screen ───────────────────────────────────────────────────────────
  if (!file || columns.length === 0) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-56px)] bg-slate-50 flex items-center">
          <div className="max-w-screen-md mx-auto px-8 py-16 w-full">

            <div className="mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500 mb-3">Simulation Studio</p>
              <h1 className="text-[36px] font-bold text-slate-900 leading-tight mb-3">What-If Analysis</h1>
              <p className="text-[15px] text-slate-500 max-w-md">
                Upload your planning data and explore how changes to one factor ripple across your entire supply chain — instantly.
              </p>
            </div>

            {/* Upload zone */}
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/30 cursor-pointer transition-all py-14 mb-4"
            >
              <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={e => handleFile(e.target.files?.[0])} />
              {uploading ? (
                <><div className="w-9 h-9 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin mb-3" /><p className="text-[13px] text-slate-400">Reading your data…</p></>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-[15px] font-semibold text-slate-700 mb-1">Drop your planning data here</p>
                  <p className="text-[13px] text-slate-400">or <span className="text-orange-500 font-medium">click to browse</span></p>
                  <p className="text-[11px] text-slate-300 mt-2">CSV files only</p>
                </>
              )}
            </div>

            {uploadErr && <p className="text-[13px] text-red-500 mb-4 text-center">{uploadErr}</p>}

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              onClick={loadSample}
              disabled={uploading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Try with Sample Planning Data
            </button>

          </div>
        </div>
      </Layout>
    );
  }

  // ─── Simulation builder ──────────────────────────────────────────────────────
  return (
    <Layout>
      <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 h-[52px] flex items-center gap-4">
          <button onClick={() => { setFile(null); setColumns([]); setResults(null); }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <p className="text-[13px] font-bold text-slate-900 leading-none">Simulation Studio</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600">
              {nRows} <span className="font-normal text-slate-400">weeks</span>
            </span>
            <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600">
              {columns.length} <span className="font-normal text-slate-400">variables</span>
            </span>
            <span className="text-[11px] text-slate-400 ml-1">{fileName}</span>
          </div>
          <button
            onClick={runSimulation}
            disabled={running || !selectedVar}
            className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              selectedVar && !running ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm" : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {running
              ? <><Spinner label="" /><span>Running…</span></>
              : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>Run Simulation</>
            }
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden bg-slate-50">

          {/* Left — variable picker + configurator */}
          <div className="flex-shrink-0 w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">What would you like to change?</p>

              {/* Variable list by group */}
              {Object.entries(grouped).map(([group, cols]) => {
                const gc2 = GROUP_COLORS[group] || GROUP_COLORS.Other;
                return (
                  <div key={group} className="mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${gc2.dot}`} />{group}
                    </p>
                    <div className="space-y-0.5">
                      {cols.map(col => {
                        const meta = getMeta(col);
                        const active = selectedVar === col;
                        return (
                          <button
                            key={col}
                            onClick={() => { setSelectedVar(col); setResults(null); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                              active
                                ? `ring-2 ring-offset-0 ${gc2.ring} border-transparent`
                                : "border-transparent hover:bg-slate-50 hover:border-slate-100"
                            }`}
                          >
                            <p className={`text-[12px] font-semibold ${active ? "text-slate-900" : "text-slate-700"}`}>{meta.label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{meta.desc}</p>
                            {colStats[col] && (
                              <p className="text-[10px] text-slate-300 mt-0.5 font-mono">avg {formatValue(colStats[col].mean, col)}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Change configurator (pinned at bottom when variable selected) */}
            {selectedVar && (
              <div className="flex-shrink-0 border-t border-slate-100 p-4 bg-white">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">By how much?</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-slate-600">Change amount</span>
                  <span className={`text-[18px] font-bold font-mono ${deltaPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {deltaPct >= 0 ? "+" : ""}{deltaPct}%
                  </span>
                </div>
                <input
                  type="range" min="-50" max="50" step="1"
                  value={deltaPct}
                  onChange={e => { setDeltaPct(parseInt(e.target.value)); setResults(null); }}
                  className="w-full accent-orange-500 mb-2"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>−50% decrease</span><span>+50% increase</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {[-20, -10, 10, 20].map(v => (
                    <button key={v} onClick={() => { setDeltaPct(v); setResults(null); }}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        deltaPct === v ? "bg-orange-500 text-white border-orange-500" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300"
                      }`}
                    >
                      {v > 0 ? "+" : ""}{v}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — results / placeholder */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* No variable selected */}
            {!selectedVar && !running && !results && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center py-10 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <p className="text-[15px] font-bold text-slate-700 mb-2">Pick a variable on the left to get started</p>
                  <p className="text-[13px] text-slate-400">Or try one of these ready-made scenarios below</p>
                </div>

                {/* Template quick-starts */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Scenarios</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {TEMPLATES.filter(t => columns.includes(t.variable)).map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => applyTemplate(tpl)}
                        className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-all group"
                      >
                        <p className="text-[13px] font-semibold text-slate-800 group-hover:text-slate-900 mb-1">{tpl.label}</p>
                        <p className="text-[11px] text-slate-400">
                          {getMeta(tpl.variable).label} · <span className={tpl.delta > 0 ? "text-emerald-500" : "text-red-500"}>{tpl.delta > 0 ? "+" : ""}{tpl.delta}%</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {running && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin mb-4" />
                <p className="text-[14px] font-semibold text-slate-600">Calculating impacts…</p>
                <p className="text-[12px] text-slate-400 mt-1">Analysing how changes ripple across your supply chain</p>
              </div>
            )}

            {/* Error */}
            {runError && !running && (
              <div className="max-w-lg mx-auto mt-8 bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-[13px] font-semibold text-red-700 mb-1">Simulation failed</p>
                <p className="text-[12px] text-red-500">{runError}</p>
              </div>
            )}

            {/* Results */}
            {results && !running && (
              <div className="max-w-3xl mx-auto">
                {/* Summary header */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Simulation Summary</p>
                  <h2 className="text-[20px] font-bold text-slate-900 mb-1">
                    If <span className="text-orange-500">{getMeta(results.treatment).label}</span> changes by{" "}
                    <span className={results.delta_pct >= 0 ? "text-emerald-600" : "text-red-500"}>
                      {results.delta_pct >= 0 ? "+" : ""}{results.delta_pct}%
                    </span>
                  </h2>
                  <p className="text-[13px] text-slate-500">
                    From <span className="font-semibold text-slate-700">{formatValue(results.baseline_treatment, results.treatment)}</span> → <span className="font-semibold text-slate-700">{formatValue(results.new_treatment, results.treatment)}</span>
                  </p>
                  <div className="flex gap-3 mt-4">
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <p className="text-[22px] font-bold text-slate-900 leading-none">{results.impacts.filter(i => Math.abs(i.pct_change) >= 10).length}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">High Impact</p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <p className="text-[22px] font-bold text-slate-900 leading-none">{results.impacts.filter(i => Math.abs(i.pct_change) >= 3 && Math.abs(i.pct_change) < 10).length}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Moderate</p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <p className="text-[22px] font-bold text-slate-900 leading-none">{results.impacts.filter(i => Math.abs(i.pct_change) < 3).length}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Minor</p>
                    </div>
                  </div>
                </div>

                {/* Impact cards */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Impact on Each Area</p>
                <div className="space-y-2">
                  {results.impacts.map((impact, i) => {
                    const meta = getMeta(impact.variable);
                    const gc2 = GROUP_COLORS[meta.group] || GROUP_COLORS.Other;
                    const up = impact.pct_change >= 0;
                    return (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 transition-all">
                        {/* Color dot */}
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${gc2.dot}`} />

                        {/* Name + desc */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[13px] font-bold text-slate-900">{meta.label}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${gc2.badge}`}>{meta.group}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{formatValue(impact.baseline, impact.variable)} → {formatValue(impact.new_value, impact.variable)}</p>
                        </div>

                        {/* Impact level */}
                        <ImpactLevel pct={impact.pct_change} />

                        {/* % change */}
                        <div className={`flex items-center gap-1.5 flex-shrink-0 ${up ? "text-emerald-600" : "text-red-500"}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            {up
                              ? <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                              : <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941" />
                            }
                          </svg>
                          <span className="text-[15px] font-bold font-mono">{up ? "+" : ""}{impact.pct_change.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Run another */}
                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setResults(null); setSelectedVar(null); }}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-[13px] font-semibold rounded-xl hover:border-orange-300 hover:text-orange-500 transition-all"
                  >
                    Run Another Simulation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
