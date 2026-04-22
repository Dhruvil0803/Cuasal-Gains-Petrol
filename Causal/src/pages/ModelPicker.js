import React, { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalysis } from "../context/AnalysisContext";
import Spinner from "../components/Spinner";
import Layout from "../components/Layout";
import DataPreview from "../components/DataPreview";

export default function ModelPicker() {
  const nav = useNavigate();
  const { run, loading, error } = useAnalysis();
  const [file, setFile] = useState(null);
  const [alpha, setAlpha] = useState(0.05);
  const [yCols, setYCols] = useState("");
  const [tCols, setTCols] = useState("");
  const [timeColumn, setTimeColumn] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const config = useMemo(() => ({
    models: ["pc", "causal_forest"],
    alpha,
    time_column: null,
    y_cols: yCols ? yCols.split(",").map(s => s.trim()).filter(Boolean) : null,
    t_cols: tCols ? tCols.split(",").map(s => s.trim()).filter(Boolean) : null,
  }), [alpha, yCols, tCols]);

  const runCombined = async () => {
    if (!file) return alert("Please select a CSV/JSON file first.");
    await run(file, config);
    nav("/model/pc_cf");
  };

  const runVarLiNGAM = async () => {
    if (!file) return alert("Please select a CSV/JSON file first.");
    await run(file, { ...config, models: ["varlingam"], time_column: timeColumn || null });
    nav("/model/varlingam");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const inputClass = "mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all duration-150";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1";

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-16">

        {/* Hero */}
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 mb-3">
            Causal Analysis Platform
          </p>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Configure your analysis
          </h1>
          <p className="text-slate-500 mt-2 text-[15px] max-w-xl leading-relaxed">
            Upload a dataset and select a model to discover causal structure and quantify effect sizes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {/* Left: Dataset & Config */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                01 — Data Source
              </p>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200 select-none ${
                  dragOver
                    ? "border-indigo-400 bg-indigo-50"
                    : file
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/40"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                {file ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-semibold text-emerald-700">{file.name}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-700">Drop a file or click to browse</p>
                    <p className="text-[11px] text-slate-400 mt-1">Supports CSV and JSON</p>
                  </>
                )}
              </div>
            </div>

            {/* Parameters */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                02 — Parameters
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Alpha</label>
                  <input type="number" step="0.01" min="0" max="1" value={alpha}
                    onChange={(e) => setAlpha(parseFloat(e.target.value || "0"))}
                    className={inputClass} placeholder="0.05" />
                  <p className="text-[11px] text-slate-400 mt-1">Significance threshold for PC (default 0.05)</p>
                </div>
                <div>
                  <label className={labelClass}>
                    Outcome Columns <span className="text-slate-400 normal-case font-normal tracking-normal">(optional)</span>
                  </label>
                  <input value={yCols} onChange={(e) => setYCols(e.target.value)}
                    placeholder="e.g., revenue, margin" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>
                    Driver Columns <span className="text-slate-400 normal-case font-normal tracking-normal">(optional)</span>
                  </label>
                  <input value={tCols} onChange={(e) => setTCols(e.target.value)}
                    placeholder="e.g., marketing, cost" className={inputClass} />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3.5">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-[13px] text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Right: Model Selection */}
          <div className="space-y-5">
            {/* PC + Causal Forest */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                03 — Cross-Sectional Model
              </p>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-[13px] font-semibold text-slate-900">PC + Causal Forest</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  PC discovers causal structure via conditional independence tests. Causal Forest estimates effect sizes using double machine learning.
                </p>
              </div>
              <button
                onClick={runCombined}
                disabled={!file || loading}
                className={`w-full px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-150 flex items-center justify-center gap-2 ${
                  file && !loading
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md hover:shadow-indigo-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {loading ? <><Spinner label="" /><span>Running…</span></> : "Run Analysis"}
              </button>
            </div>

            {/* VARLiNGAM */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                04 — Time Series Model
              </p>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 mb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                  <span className="text-[13px] font-semibold text-slate-900">VARLiNGAM</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Learns directed causal relations in multivariate time series under linear, non-Gaussian assumptions.
                </p>
              </div>
              <div className="mb-4">
                <label className={labelClass}>
                  Time Column <span className="text-slate-400 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <input value={timeColumn} onChange={(e) => setTimeColumn(e.target.value)}
                  placeholder="e.g., timestamp, date" className={inputClass} />
                <p className="text-[11px] text-slate-400 mt-1">Sorted then dropped before modeling</p>
              </div>
              <button
                onClick={runVarLiNGAM}
                disabled={!file || loading}
                className={`w-full px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-150 flex items-center justify-center gap-2 ${
                  file && !loading
                    ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:shadow-md hover:shadow-violet-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {loading ? <><Spinner label="" /><span>Running…</span></> : "Run VARLiNGAM"}
              </button>
            </div>
          </div>
        </div>

        {file && <DataPreview file={file} />}
      </div>
    </Layout>
  );
}
