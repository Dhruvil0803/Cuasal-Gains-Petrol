// src/components/GraphBloomClone/neighborhood-llm/ProvenanceChips.jsx
import React from "react";

/**
 * Renders clickable chips for node/edge IDs used in an answer.
 * onClickId(id) can highlight in the graph if you wire it later.
 */
export default function ProvenanceChips({ nodes = [], edges = [], onClickId }) {
  if ((!nodes || nodes.length === 0) && (!edges || edges.length === 0)) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {nodes.map((id) => (
        <button
          key={`n-${id}`}
          onClick={() => onClickId?.(id)}
          style={chipStyle}
          title={`Node ${id}`}
        >
          node:{short(id)}
        </button>
      ))}
      {edges.map((id) => (
        <button
          key={`e-${id}`}
          onClick={() => onClickId?.(id)}
          style={chipStyle}
          title={`Edge ${id}`}
        >
          edge:{short(id)}
        </button>
      ))}
    </div>
  );
}

const chipStyle = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
};

const short = (s) => (s?.length > 8 ? s.slice(0, 4) + "…" + s.slice(-3) : s);
