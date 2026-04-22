// src/components/GraphBloomClone/GraphActions.jsx
import React from "react";

export default function GraphActions({ nodeId, expandKHops, fit }) {
  return (
    <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => expandKHops(nodeId, 1)}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#22c55e",
            color: "#0b1219",
            border: "1px solid #16a34a",
            fontWeight: 800,
          }}
        >
          Expand 1 Connection
        </button>
        <button
          onClick={() => expandKHops(nodeId, 2)}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#f59e0b",
            color: "#0b1219",
            border: "1px solid #d97706",
            fontWeight: 800,
          }}
        >
          Expand 2 Connections
        </button>
        <button
          onClick={fit}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#F47920",
            color: "#ffffff",
            border: "1px solid #D4621A",
            fontWeight: 800,
          }}
        >
          Fit view
        </button>
      </div>
      <p style={{ color: "#9aa3b2", fontSize: 12 }}>
        Expands neighbors from the selected node (like Neo4j Browser). Use your <i>Limit</i> input to cap results.
      </p>
    </div>
  );
}
