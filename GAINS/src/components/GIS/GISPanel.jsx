// src/components/GIS/GISPanel.jsx
import React, { useState } from "react";
import StatusBanner from "../GraphBloomClone/StatusBanner.jsx";

export default function GISPanel({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function testConnection({ runCreateUser }) {
    setBusy(true);
    setStatus("Connecting to Snowflake…");
    try {
      const body = {
        runCreateUser: !!runCreateUser,
        createUserSql: `
CREATE USER snow_map_user
  PASSWORD = 'SnowMapTest@148'
  DEFAULT_ROLE = 'PUBLIC'
  DEFAULT_WAREHOUSE = 'SEDONA'
  MUST_CHANGE_PASSWORD = FALSE;
`.trim(),
      };

      const resp = await fetch("/api/snowflake/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

      if (data?.ok) {
        setStatus(
          runCreateUser
            ? "Connected to Snowflake. CREATE USER executed."
            : `Connected to Snowflake. Version: ${data.version || "unknown"}`
        );
      } else {
        throw new Error(data?.error || "Unknown Snowflake error");
      }
    } catch (e) {
      setStatus(`Error: ${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 68,
        width: 420,
        zIndex: 1000,
        background: "#0f1116",
        color: "#e5e7eb",
        border: "1px solid #2c313c",
        borderRadius: 12,
        boxShadow: "0 12px 30px rgba(0,0,0,.25)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 800 }}>GIS (Snowflake Connection)</div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#15171d",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <StatusBanner status={status} />
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => testConnection({ runCreateUser: false })}
          disabled={busy}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #065f46",
            background: busy ? "#0b3b2f" : "#064e3b",
            color: "#d1fae5",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {busy ? "Checking…" : "Test connection (safe)"}
        </button>

        <button
          onClick={() => testConnection({ runCreateUser: true })}
          disabled={busy}
          title="Runs the CREATE USER statement you provided"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #7f1d1d",
            background: busy ? "#2b1010" : "#1b0f0f",
            color: "#fecaca",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {busy ? "Running…" : "Run CREATE USER (dangerous)"}
        </button>

        <div style={{ fontSize: 12, color: "#9aa3b2" }}>
          Tip: Use the safe test first. The CREATE USER action is optional and
          requires an admin role in Snowflake.
        </div>
      </div>
    </div>
  );
}
