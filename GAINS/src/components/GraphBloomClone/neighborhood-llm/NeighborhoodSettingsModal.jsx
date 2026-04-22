// src/components/GraphBloomClone/neighborhood-llm/NeighborhoodSettingsModal.jsx
import React, { useState } from "react";

/**
 * Optional settings modal to tune caps, timeouts, model, redaction, etc.
 * You can wire it later; it's not required for the core flow.
 */
export default function NeighborhoodSettingsModal({
  isOpen,
  onClose,
  initial = {},
  onSave,
}) {
  const [form, setForm] = useState({
    maxNodes: initial.maxNodes ?? 1500,
    maxEdges: initial.maxEdges ?? 3000,
    timeoutSec: initial.timeoutSec ?? 12,
    model: initial.model ?? "fast-default",
  });

  if (!isOpen) return null;

  return (
    <div style={modalBackdrop}>
      <div style={modalCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Neighborhood Settings</strong>
          <button onClick={onClose} style={btn}>Close</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <L label="Max nodes">
            <I type="number" value={form.maxNodes} onChange={(e)=>setForm({...form, maxNodes:+e.target.value})} />
          </L>
          <L label="Max edges">
            <I type="number" value={form.maxEdges} onChange={(e)=>setForm({...form, maxEdges:+e.target.value})} />
          </L>
          <L label="Timeout (sec)">
            <I type="number" value={form.timeoutSec} onChange={(e)=>setForm({...form, timeoutSec:+e.target.value})} />
          </L>
          <L label="Model">
            <I value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} />
          </L>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button style={{ ...btn, background: "#111827", color: "#fff" }} onClick={() => onSave?.(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};
const modalCard = {
  width: 440,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,.2)",
};
const btn = { fontSize: 12, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", cursor: "pointer" };
function L({ label, children }) { return (<label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>{children}</label>); }
function I(props) { return (<input {...props} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }} />); }
