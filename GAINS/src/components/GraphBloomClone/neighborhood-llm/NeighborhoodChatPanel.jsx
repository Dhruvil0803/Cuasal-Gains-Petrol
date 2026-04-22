// src/components/GraphBloomClone/neighborhood-llm/NeighborhoodChatPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGraph } from "./GraphContext";
import { chatNeighborhood } from "./LLMClient";
import ProvenanceChips from "./ProvenanceChips";

/**
 * Docked chat that scopes every question to the CURRENT snapshot only.
 * Shows a "Context updated — Re-sync" button when the global snapshot changes.
 */
export default function NeighborhoodChatPanel({ onHighlightById }) {
  const { snapshot, chatState, setChatState } = useGraph();
  const { isOpen, contextId } = chatState || {};

  // Local messages are UI state only; each send still includes the full snapshot
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', text, provenance? }
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [warning, setWarning] = useState(null);

  // Track whether the global snapshot changed since last contextId
  const lastSnapshotRef = useRef(null);
  const contextStale = useMemo(() => {
    if (!lastSnapshotRef.current || !snapshot) return false;
    // New object reference signals a new neighborhood
    return lastSnapshotRef.current !== snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!isOpen) return;
    // When contextId changes (via launcher Re-sync), bind the current snapshot
    lastSnapshotRef.current = snapshot;
  }, [isOpen, contextId, snapshot]);

  if (!isOpen) return null;

  const handleClose = () => setChatState((s) => ({ ...s, isOpen: false }));
  const handleResync = () => {
    lastSnapshotRef.current = snapshot;
    setChatState((s) => ({ ...s, contextId: `ctx_${Date.now()}` }));
  };

  const send = async () => {
    const question = input.trim();
    if (!question) return;
    if (!lastSnapshotRef.current) {
      setWarning("No context. Re-sync and try again.");
      return;
    }
    setWarning(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setStatus("working");
    try {
      const answer = await chatNeighborhood({
        message: question,
        snapshot: lastSnapshotRef.current,
      });
      const text = answer?.text || "(no answer)";
      const provenance = answer?.provenance || { nodes: [], edges: [] };
      setMessages((m) => [...m, { role: "assistant", text, provenance }]);
      setStatus("idle");
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Error: ${e?.message || "Chat failed"}` },
      ]);
      setStatus("idle");
    }
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Neighborhood Q&A</strong>
          <span style={scopePill}>Scope: Current snapshot only</span>
          {contextStale && (
            <button
              style={pillBtn}
              onClick={handleResync}
              title="Bind chat to the latest neighborhood"
            >
              Context updated — Re-sync
            </button>
          )}
        </div>
        <button onClick={handleClose} style={pillBtn}>
          Close
        </button>
      </div>

      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Ask about what you see: counts, relationships, isolated nodes, geo
            proximity…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            {m.provenance && (
              <ProvenanceChips
                nodes={m.provenance.nodes}
                edges={m.provenance.edges}
                onClickId={onHighlightById}
              />
            )}
          </div>
        ))}
      </div>

      <div style={inputRowStyle}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Count suppliers connected to DCs"
          style={inputStyle}
        />
        <button onClick={send} disabled={status === "working"} style={sendBtnStyle}>
          {status === "working" ? "Asking…" : "Ask"}
        </button>
      </div>

      {warning && (
        <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{warning}</div>
      )}
    </div>
  );
}

const panelStyle = {
  position: "fixed",
  right: 16,
  bottom: 16,
  width: 420,
  height: 520,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,.15)",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};

const scopePill = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 999,
  background: "#FEF3E8",
  border: "1px solid #e5e7eb",
};

const pillBtn = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  cursor: "pointer",
};

const messagesStyle = { flex: 1, overflow: "auto", padding: "6px 2px" };
const inputRowStyle = { display: "flex", gap: 6, marginTop: 6 };
const inputStyle = { flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" };
const sendBtnStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "8px 12px",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};
