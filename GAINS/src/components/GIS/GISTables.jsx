// src/components/GIS/GISTables.jsx
import React, { useEffect, useMemo, useState } from "react";

function fmtBytes(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0,
    x = Number(n);
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function GISTables({ onOpenDetails }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tables, setTables] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/snowflake/tables");
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        setTables(data.tables || []);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = (q || "").toLowerCase();
    if (!t) return tables;
    return tables.filter((row) =>
      `${row.database}.${row.schema}.${row.name}.${row.type}.${row.owner}`
        .toLowerCase()
        .includes(t)
    );
  }, [tables, q]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0e14", overflow: "auto" }}>
      <div style={{ padding: 16, color: "#e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#c7d2fe" }}>GIS · Snowflake Tables</div>
          <div style={{ flex: 1 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tables…"
            style={{
              background: "#0f1116",
              color: "#e5e7eb",
              border: "1px solid #2c313c",
              borderRadius: 8,
              padding: "8px 10px",
              width: 300,
            }}
          />
        </div>

        {loading && <div>Loading tables…</div>}
        {!!err && <div style={{ color: "#fecaca" }}>Error: {err}</div>}

        {!loading && !err && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0f1116", color: "#9aa3b2" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Database</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Schema</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Table</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Type</th>
                <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Rows</th>
                <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Size</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={`${r.database}.${r.schema}.${r.name}-${i}`}
                  onClick={() => onOpenDetails?.(r)}
                  style={{
                    cursor: "pointer",
                    background: i % 2 ? "#0e131b" : "#0b0f16",
                  }}
                  title={`${r.database}.${r.schema}.${r.name}`}
                >
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22" }}>{r.database}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22" }}>{r.schema}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22", fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22" }}>{r.type}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22", textAlign: "right" }}>
                    {r.rows ?? ""}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22", textAlign: "right" }}>
                    {fmtBytes(r.bytes)}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #161a22" }}>{r.owner ?? ""}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "#9aa3b2", padding: 16 }}>
                    No tables match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
