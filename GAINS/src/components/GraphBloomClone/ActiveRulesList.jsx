// src/components/GraphBloomClone/ActiveRulesList.jsx
import React from "react";

export default function ActiveRulesList({ rules, removeRule }) {
  if (!rules?.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Active rules</div>
      <div style={{ display: "grid", gap: 6 }}>
        {rules.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              background: "#13151b",
              border: "1px solid #2c313c",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            <span style={{ padding: "2px 6px", borderRadius: 6, background: "#222733", color: "#cbd5e1" }}>
              {r.target}
            </span>
            <span>{r.category}</span>
            <span>·</span>
            <span>{r.prop}</span>
            <span>·</span>
            <span>{r.mode.replace("-", " ")}</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => removeRule(r.id)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #374151",
                background: "#0f1116",
                color: "#e5e7eb",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
