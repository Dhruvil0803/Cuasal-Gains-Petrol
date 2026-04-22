// src/components/GraphBloomClone/neighborhood-llm/NeighborhoodSyncStatus.jsx
import React from "react";
import { useGraph } from "./GraphContext";

/**
 * Small status badge to show sync state next to your Reload button.
 * Reads state from GraphContext, no props required.
 */
export default function NeighborhoodSyncStatus({ compact = true }) {
  const { syncState } = useGraph();
  const { status, error } = syncState || {};

  let label = "Idle";
  if (status === "analyzing") label = "Analyzing…";
  else if (status === "fresh") label = "Fresh";
  else if (status === "error") label = error || "Error";

  const bg =
    status === "fresh" ? "#d1fae5" :
    status === "analyzing" ? "#e5e7eb" :
    status === "error" ? "#fee2e2" :
    "#f3f4f6";

  return (
    <span
      title="Neighborhood analysis status"
      style={{
        fontSize: compact ? 12 : 13,
        padding: "2px 6px",
        borderRadius: 6,
        background: bg,
        color: "#111827",
        border: "1px solid #e5e7eb",
      }}
    >
      {label}
    </span>
  );
}
