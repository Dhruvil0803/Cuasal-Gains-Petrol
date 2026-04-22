// src/components/GraphBloomClone/neighborhood-llm/NeighborhoodChatLauncher.jsx
import React from "react";
import { useGraph } from "./GraphContext";

/**
 * Button to open the Neighborhood Q&A panel.
 * It sets a fresh contextId so the chat binds to the latest snapshot.
 */
export default function NeighborhoodChatLauncher() {
  const { setChatState } = useGraph();

  return (
    <button
      onClick={() => {
        const contextId = `ctx_${Date.now()}`;
        setChatState((s) => ({ ...s, isOpen: true, contextId }));
      }}
      title="Ask about this neighborhood"
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        cursor: "pointer",
      }}
    >
      Ask about this neighborhood
    </button>
  );
}
