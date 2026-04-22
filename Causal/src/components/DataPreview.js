import React, { useState, useEffect } from "react";

export default function DataPreview({ file }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const fileName = file.name.toLowerCase();
        let data = [], columns = [];
        if (fileName.endsWith(".csv")) {
          const lines = content.split("\n").filter(l => l.trim());
          if (lines.length > 0) {
            columns = lines[0].split(",").map(c => c.trim());
            for (let i = 1; i < Math.min(6, lines.length); i++) {
              const values = lines[i].split(",").map(v => v.trim());
              const row = {};
              columns.forEach((col, idx) => { row[col] = values[idx] || "—"; });
              data.push(row);
            }
          }
        } else if (fileName.endsWith(".json")) {
          const jsonData = JSON.parse(content);
          let records = Array.isArray(jsonData) ? jsonData : Object.values(jsonData).filter(v => Array.isArray(v))[0] || [jsonData];
          if (records.length > 0) {
            const allKeys = new Set();
            records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
            columns = Array.from(allKeys);
            data = records.slice(0, 5).map(record => {
              const row = {};
              columns.forEach(col => { const v = record[col]; row[col] = v != null ? String(v).substring(0, 50) : "—"; });
              return row;
            });
          }
        }
        setPreview({ fileName: file.name, fileSize: (file.size / 1024).toFixed(2), columns, preview: data });
      } catch (err) {
        setError(`Error reading file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => { setError("Failed to read file"); setLoading(false); };
    reader.readAsText(file);
  }, [file]);

  if (!file) return null;

  if (loading) return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mt-5 flex items-center gap-3 shadow-sm">
      <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full flex-shrink-0" />
      <p className="text-[13px] text-slate-500">Reading file…</p>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-5">
      <p className="text-[13px] text-red-600">{error}</p>
    </div>
  );

  if (!preview) return null;

  return (
    <div className="mt-5 space-y-4">
      {/* Metadata */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">File Details</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Filename", value: preview.fileName },
            { label: "Size", value: `${preview.fileSize} KB` },
            { label: "Columns", value: preview.columns.length },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
              <p className="text-[14px] font-semibold text-slate-800 truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Preview table */}
      {preview.preview.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 pt-4 pb-3">
            Data Preview · First {preview.preview.length} rows
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  {preview.columns.slice(0, 10).map(col => (
                    <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      {col.substring(0, 20)}
                    </th>
                  ))}
                  {preview.columns.length > 10 && (
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400">+{preview.columns.length - 10}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    {preview.columns.slice(0, 10).map(col => (
                      <td key={col} className="px-4 py-2.5 text-slate-600 whitespace-nowrap truncate max-w-[180px] font-mono text-[11px]">
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column tags */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">All Columns</p>
        <div className="flex flex-wrap gap-1.5">
          {preview.columns.map(col => (
            <span key={col} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors duration-100 cursor-default">
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
