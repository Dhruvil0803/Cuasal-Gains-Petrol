import React, { useEffect, useMemo, useState } from "react";

function fmtBytes(n) {
  if (n == null) return "";
  const u = ["B","KB","MB","GB","TB"]; let i=0, x=Number(n);
  while (x >= 1024 && i < u.length-1) { x/=1024; i++; }
  return `${x.toFixed(x >= 10 || i===0 ? 0 : 1)} ${u[i]}`;
}

function toCSV({ rows, columns }) {
  const headers = columns.map(c => c.name);
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replaceAll(`"`, `""`)}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map(r => headers.map(h => escape(r[h] ?? r[h.toUpperCase()] ?? r[h.toLowerCase()])).join(",")),
  ];
  return lines.join("\n");
}

export default function GISTableDetails({ tableRef, onBack }) {
  const { database, schema, name } = tableRef || {};
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(null);
  const [columns, setColumns] = useState([]);

  // data preview state
  const [limit, setLimit] = useState(100);
  const [rows, setRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataErr, setDataErr] = useState("");

  // Load table metadata + columns
  useEffect(() => {
    if (!database || !schema || !name) return;
    (async () => {
      setLoading(true); setErr("");
      try {
        const url = `/api/snowflake/table-details?db=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(name)}`;
        const r = await fetch(url);
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        setInfo(data.info);
        setColumns(data.columns || []);
      } catch (e) { setErr(e.message || String(e)); }
      finally { setLoading(false); }
    })();
  }, [database, schema, name]);

  // Load table data (preview)
  async function loadData() {
    if (!database || !schema || !name) return;
    setDataLoading(true); setDataErr(""); setRows([]);
    try {
      const url = `/api/snowflake/table-data?db=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(name)}&limit=${encodeURIComponent(limit)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      // data.rows is an array of objects
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setDataErr(e.message || String(e));
    } finally {
      setDataLoading(false);
    }
  }

  // auto-load on open + when limit changes
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database, schema, name, limit]);

  // Decide headers to display (prefer Snowflake column order from `columns`)
  const headers = useMemo(() => {
    if (columns?.length) return columns.map(c => c.name);
    // Fallback: infer from first row keys
    const first = rows?.[0];
    return first ? Object.keys(first) : [];
  }, [columns, rows]);

  const hasData = rows.length > 0;

  function handleExport() {
    const csv = toCSV({ rows, columns: headers.map(h => ({ name: h })) });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${database}.${schema}.${name}.preview.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0e14", overflow: "auto" }}>
      <div style={{ padding: 16, color: "#e5e7eb" }}>
        <div style={{ display: "flex", alignItems:"center", gap: 10, marginBottom: 12 }}>
          <button
            onClick={onBack}
            style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #334155", background:"#15171d", color:"#e5e7eb", cursor:"pointer" }}
          >
            ← Back
          </button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {database}.{schema}.{name}
          </div>
          <div style={{ flex: 1 }} />
        </div>

        {loading && <div>Loading…</div>}
        {!!err && <div style={{ color:"#fecaca" }}>Error: {err}</div>}

        {!loading && !err && info && (
          <>
            {/* METADATA */}
            <div style={{ marginBottom: 12, color:"#9aa3b2" }}>
              <b>Type:</b> {info.type || "TABLE"} · <b>Rows:</b> {info.rows ?? "?"} · <b>Size:</b> {fmtBytes(info.bytes)} · <b>Owner:</b> {info.owner || "-"} · <b>Created:</b> {info.created || "-"}
              {info.comment ? <> · <b>Comment:</b> {info.comment}</> : null}
            </div>

            {/* COLUMNS */}
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, marginBottom: 20 }}>
              <thead>
                <tr style={{ background:"#0f1116", color:"#9aa3b2" }}>
                  <th style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c" }}>Column</th>
                  <th style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c" }}>Type</th>
                  <th style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c" }}>Nullable</th>
                  <th style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c" }}>Default</th>
                  <th style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c" }}>Comment</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c, i) => (
                  <tr key={c.name || i} style={{ background: i % 2 ? "#0e131b" : "#0b0f16" }}>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #161a22", fontWeight:700 }}>{c.name}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #161a22" }}>{c.type}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #161a22" }}>{c.nullable ? "YES" : "NO"}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #161a22" }}>{c.default ?? ""}</td>
                    <td style={{ padding:"10px 12px", borderBottom:"1px solid #161a22" }}>{c.comment ?? ""}</td>
                  </tr>
                ))}
                {columns.length === 0 && (
                  <tr><td colSpan={5} style={{ color:"#9aa3b2", padding:16 }}>No columns found.</td></tr>
                )}
              </tbody>
            </table>

            {/* DATA PREVIEW */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ fontWeight:800, color:"#c7d2fe" }}>Data preview</div>
              <div style={{ flex:1 }} />
              <label style={{ fontSize:12, color:"#9aa3b2" }}>
                Rows:&nbsp;
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                  style={{ width:80, padding:"6px 8px", borderRadius:8, border:"1px solid #2c313c", background:"#0f1116", color:"#e5e7eb" }}
                />
              </label>
              <button
                onClick={loadData}
                disabled={dataLoading}
                style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #334155", background:"#15171d", color:"#e5e7eb", cursor:"pointer" }}
              >
                {dataLoading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={handleExport}
                disabled={!hasData}
                style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #065f46", background:"#064e3b", color:"#d1fae5", cursor: hasData ? "pointer" : "not-allowed" }}
              >
                Export CSV
              </button>
            </div>

            {dataErr && <div style={{ color:"#fecaca", marginBottom:8 }}>Error: {dataErr}</div>}
            {!dataLoading && !dataErr && !hasData && (
              <div style={{ color:"#9aa3b2", marginBottom:16 }}>No rows to show (table empty or 0 returned).</div>
            )}

            <div style={{ border:"1px solid #161a22", borderRadius:8, overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#0f1116", color:"#9aa3b2" }}>
                    {headers.map((h) => (
                      <th key={h} style={{ textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #2c313c", position:"sticky", top:0 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 ? "#0e131b" : "#0b0f16" }}>
                      {headers.map((h) => {
                        const v = r[h] ?? r[h?.toUpperCase?.()] ?? r[h?.toLowerCase?.()];
                        return (
                          <td key={h} style={{ padding:"8px 10px", borderBottom:"1px solid #161a22", whiteSpace:"nowrap", textOverflow:"ellipsis", overflow:"hidden", maxWidth: 360 }}>
                            {v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {dataLoading && <div style={{ padding:12, color:"#9aa3b2" }}>Loading rows…</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
