import { useState, useEffect } from "react";
import Spinner from "./Spinner";
import API_BASE from "../config";

const VAR_META = {
  forecast:           { label: "Forecast",           desc: "Planned demand",                group: "Planning"    },
  receipts:           { label: "Receipts",            desc: "Units received from suppliers", group: "Planning"    },
  shipments:          { label: "Shipments",           desc: "Units shipped to customers",    group: "Planning"    },
  inventory:          { label: "Inventory",           desc: "Current on-hand stock",         group: "Planning"    },
  inventory_turn:     { label: "Inventory Turn",      desc: "How often inventory cycles",    group: "Performance" },
  days_on_hand:       { label: "Days on Hand",        desc: "Days of supply available",      group: "Performance" },
  marketing_spend:    { label: "Marketing Spend",     desc: "Investment in marketing",       group: "Marketing"   },
  marketing_index:    { label: "Marketing Index",     desc: "Marketing effectiveness",       group: "Marketing"   },
  composite_index:    { label: "Composite Index",     desc: "Combined demand signal",        group: "Marketing"   },
  spm:                { label: "Sales per Machine",   desc: "Sales efficiency per unit",     group: "Marketing"   },
  supplier_fill_rate: { label: "Supplier Fill Rate",  desc: "% orders fulfilled on time",    group: "Supplier"    },
  supplier_lead_time: { label: "Supplier Lead Time",  desc: "Days from order to delivery",   group: "Supplier"    },
  rdc_inventory:      { label: "RDC Inventory",       desc: "Stock at distribution centers", group: "Operations"  },
  dealer_inventory:   { label: "Dealer Inventory",    desc: "Units across dealer network",   group: "Dealer"      },
};

function getMeta(col) {
  if (!col) return { label: "Unknown", desc: "", group: "Other" };
  return VAR_META[col] || {
    label: col.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    desc: "",
    group: "Other",
  };
}


export default function SimulateInline({ file }) {
  const [columns, setColumns]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadErr, setLoadErr]     = useState(null);
  const [selectedVar, setSelectedVar] = useState(null);
  const [deltaPct, setDeltaPct]   = useState(10);
  const [running, setRunning]     = useState(false);
  const [results, setResults]     = useState(null);
  const [runError, setRunError]   = useState(null);

  // Auto-fetch numeric columns from the already-uploaded file
  useEffect(() => {
    if (!file) {
      setLoading(false);
      setLoadErr("No data file found. Please go back and upload your data first.");
      return;
    }
    setLoading(true);
    setLoadErr(null);
    const fd = new FormData();
    fd.append("file", file);
    fetch(`${API_BASE}/sim/columns`, { method: "POST", body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setColumns((data.columns || []).filter(Boolean));
      })
      .catch(e => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, [file]);

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

  const selectedMeta = selectedVar ? getMeta(selectedVar) : null;
  const impactList   = results?.impacts || [];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-7 h-7 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-slate-400">Loading variables…</p>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px] text-red-500">{loadErr}</p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Step 1 — Pick a variable */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Step 1 — What would you like to change?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map(col => {
            const meta   = getMeta(col);
            const active = selectedVar === col;
            return (
              <button
                key={col}
                onClick={() => { setSelectedVar(col); setResults(null); setRunError(null); }}
                className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Set change amount */}
      {selectedVar && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Step 2 — By how much?
          </p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-slate-800">{selectedMeta?.label}</p>
            <span className={`text-[20px] font-bold font-mono ${deltaPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {deltaPct >= 0 ? "+" : ""}{deltaPct}%
            </span>
          </div>

          <input
            type="range" min={-50} max={50} step={1}
            value={deltaPct}
            onChange={e => { setDeltaPct(Number(e.target.value)); setResults(null); }}
            className="w-full mb-3 accent-orange-500"
          />

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[-20, -10, +10, +20].map(v => (
              <button
                key={v}
                onClick={() => { setDeltaPct(v); setResults(null); }}
                className={`py-1.5 rounded-lg text-[12px] font-bold border transition-all ${
                  deltaPct === v
                    ? v >= 0 ? "bg-emerald-500 text-white border-emerald-500" : "bg-red-500 text-white border-red-500"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                }`}
              >
                {v >= 0 ? "+" : ""}{v}%
              </button>
            ))}
          </div>

          <button
            onClick={runSimulation}
            disabled={running}
            className={`w-full py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
              running
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
            }`}
          >
            {running
              ? <><Spinner label="" /><span>Running simulation…</span></>
              : <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  See what happens
                </>
            }
          </button>
        </div>
      )}

      {runError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-600">
          {runError}
        </div>
      )}

      {/* Step 3 — Results */}
      {impactList.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Step 3 — Predicted impact of {deltaPct >= 0 ? "+" : ""}{deltaPct}% in {selectedMeta?.label}
          </p>
          <div className="space-y-1.5">
            {impactList.map((r, i) => {
              const meta     = getMeta(r.variable);
              const positive = (r.delta ?? 0) >= 0;
              const pct      = r.pct_change ?? 0;
              const maxAbs   = Math.max(...impactList.map(x => Math.abs(x.delta ?? 0)), 1);
              const barW     = Math.min(Math.abs(r.delta ?? 0) / maxAbs * 100, 100);
              return (
                <div key={i} className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 flex items-center gap-3 hover:border-slate-200 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-slate-900 truncate">{meta.label}</p>
                      <span className={`text-[12px] font-bold font-mono flex-shrink-0 ml-2 ${positive ? "text-emerald-600" : "text-red-500"}`}>
                        {positive ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${positive ? "bg-emerald-400" : "bg-red-400"}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results && impactList.length === 0 && (
        <div className="py-8 text-center text-[13px] text-slate-400 border border-slate-100 rounded-xl bg-slate-50">
          No measurable impact found for this variable.
        </div>
      )}

    </div>
  );
}
