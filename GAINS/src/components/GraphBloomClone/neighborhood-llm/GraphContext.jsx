// src/components/GraphBloomClone/neighborhood-llm/GraphContext.js
import React, { createContext, useContext, useMemo, useState } from "react";

const GraphContext = createContext(null);

/**
 * Holds the CURRENT neighborhood snapshot + sync/chat UI state.
 * Other components (sync agent, chat) will read from here.
 */
export function GraphProvider({ children }) {
  // The authoritative, current neighborhood snapshot (we'll populate it later)
  const [snapshot, setSnapshot] = useState(null);

  // LLM sync status badge uses this
  const [syncState, setSyncState] = useState({
    status: "idle",       // "idle" | "analyzing" | "fresh" | "error"
    error: null,
    result: null,         // optional: last analysis JSON
    updatedAt: null,
  });

  // Chat panel UI-only state (chat always sends the full snapshot each turn)
  const [chatState, setChatState] = useState({
    isOpen: false,
    contextId: null,      // bumps when user clicks Re-sync
    lastAnswer: null,
  });

  const value = useMemo(
    () => ({ snapshot, setSnapshot, syncState, setSyncState, chatState, setChatState }),
    [snapshot, syncState, chatState]
  );

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraph() {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error("useGraph must be used within GraphProvider");
  return ctx;
}
