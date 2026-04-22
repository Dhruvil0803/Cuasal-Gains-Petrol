import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useGraph } from "../context/GraphContext";

export default function SupplyChainUpload() {
  const nav = useNavigate();
  const { uploadFile, loadSample, loading, error } = useGraph();
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (f) => { if (!f) return; const d = await uploadFile(f); if (d) nav("/explore"); };
  const handleSample = async () => { const d = await loadSample(); if (d) nav("/explore"); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">
              Supply Chain Intelligence
            </p>
            <h1 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
              Causal Analysis Platform
            </h1>
            <p className="text-[13px] text-slate-400 mt-1.5">
              Upload your supply chain CSV to uncover cause-and-effect relationships
            </p>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 select-none py-10 px-6 mb-3 ${
              loading  ? "border-slate-200 bg-white cursor-not-allowed" :
              dragOver ? "border-orange-400 bg-orange-50 scale-[1.01]" :
                         "border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
            }`}
          >
            <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={e => handleFile(e.target.files?.[0])} />
            {loading ? (
              <>
                <div className="w-9 h-9 rounded-full border-4 border-slate-100 border-t-orange-500 animate-spin mb-3" />
                <p className="text-[13px] font-semibold text-slate-400">Processing…</p>
              </>
            ) : (
              <>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all ${dragOver ? "bg-orange-100" : "bg-slate-100"}`}>
                  <svg className={`w-5 h-5 transition-colors ${dragOver ? "text-orange-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-slate-700 mb-0.5">
                  {dragOver ? "Release to upload" : "Drop your CSV file here"}
                </p>
                <p className="text-[12px] text-slate-400">
                  or <span className="text-orange-500 font-medium">click to browse</span>
                </p>
                <p className="text-[11px] text-slate-300 mt-2">Supports .csv files</p>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Sample dataset */}
          <button
            onClick={handleSample}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] transition-all disabled:opacity-50 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125" />
            </svg>
            Try Sample Dataset
          </button>

        </div>
      </div>
    </Layout>
  );
}
