// import React from "react";

// export default function NodeDetailsTable({ t, propsObj }) {
//   const entries = Object.entries(propsObj || {});

//   const wrap = {
//     border: `1px solid ${t.border}`,
//     borderRadius: 12,
//     overflow: "hidden",
//     background: t.cardBg,
//   };

//   const row = (i) => ({
//     display: "grid",
//     gridTemplateColumns: "220px 1fr",
//     gap: 0,
//     alignItems: "stretch",
//     background: i % 2 ? t.panelBg : t.cardBg,
//     borderTop: i === 0 ? "none" : `1px dashed ${t.border}`,
//   });

//   const kCell = {
//     padding: "10px 12px",
//     fontWeight: 700,
//     color: t.text,                  // ← strong contrast
//     borderRight: `1px solid ${t.border}`,
//     wordBreak: "break-word",
//   };

//   const vCell = {
//     padding: "10px 12px",
//     color: t.text,                  // ← strong contrast (no faded gray)
//     opacity: 0.95,                  // tiny softening without losing contrast
//     wordBreak: "break-word",
//   };

//   // code-like presentation for arrays/objects
//   const renderVal = (v) => {
//     if (v === null) return <em style={{ color: t.subtext }}>null</em>;
//     if (v === undefined) return <em style={{ color: t.subtext }}>undefined</em>;
//     if (Array.isArray(v) || typeof v === "object") {
//       return (
//         <pre
//           style={{
//             margin: 0,
//             whiteSpace: "pre-wrap",
//             background: t.panelBg,
//             border: `1px solid ${t.border}`,
//             borderRadius: 8,
//             padding: 8,
//             color: t.text,
//             fontFamily:
//               "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
//             fontSize: 12,
//           }}
//         >
//           {JSON.stringify(v, null, 2)}
//         </pre>
//       );
//     }
//     return String(v);
//   };

//   return (
//     <div style={wrap}>
//       {entries.map(([k, v], i) => (
//         <div key={k} style={row(i)}>
//           <div style={kCell}>
//             {k}
//           </div>
//           <div style={vCell}>
//             {renderVal(v)}
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }
// src/components/GraphBloomClone/NodeDetailsTable.jsx
import React, { useMemo, useState, useEffect } from "react";

export default function NodeDetailsTable({
  t,
  propsObj = {},
  editable = false,          // NEW: show Edit/Save/Cancel if true
  onSave = null,             // NEW: async (newProps) => void
  onCancelEdit = null,       // optional
}) {
  const entries = useMemo(
    () => Object.entries(propsObj || {}).sort(([a], [b]) => a.localeCompare(b)),
    [propsObj]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(propsObj || {});
  const [busy, setBusy] = useState(false);

  // reset draft when node changes
  useEffect(() => {
    setDraft(propsObj || {});
    setIsEditing(false);
  }, [propsObj]);

  const wrap = { padding: "12px 16px", color: t?.text || "#e5e7eb" };

  const row = (i) => ({
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: 10,
    padding: "8px 0",
    borderTop: i === 0 ? `1px solid ${t?.border || "#2c313c"}` : undefined,
    borderBottom: `1px solid ${t?.border || "#2c313c"}`,
  });

  const kCell = {
    padding: "10px 12px",
    fontWeight: 700,
    color: t?.text || "#e5e7eb",
    borderRight: `1px solid ${t?.border || "#2c313c"}`,
    wordBreak: "break-word",
  };

  const vCell = {
    padding: "10px 12px",
    color: t?.text || "#e5e7eb",
    opacity: 0.95,
    wordBreak: "break-word",
  };

  const ctrlBar = {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  };

  const btn = {
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${t?.ctrlBr || "#374151"}`,
    background: t?.ctrlBg || "#0f1116",
    color: t?.text || "#e5e7eb",
    fontWeight: 700,
    cursor: "pointer",
    height: 32,
  };

  const input = {
    width: "100%",
    minHeight: 28,
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${t?.ctrlBr || "#374151"}`,
    background: t?.panelBg || "#0f1116",
    color: t?.text || "#e5e7eb",
    fontFamily: "inherit",
    fontSize: 13,
  };

  const renderVal = (v) => {
    if (!isEditing) {
      return typeof v === "object" ? <code>{JSON.stringify(v)}</code> : String(v);
    }
    // editing mode renders happen per-key via renderField
    return null;
  };

  const renderField = (k) => {
    const val = draft?.[k];
    const asText =
      typeof val === "object" ? JSON.stringify(val, null, 0) : String(val ?? "");
    return (
      <input
        style={input}
        value={asText}
        onChange={(e) => {
          const raw = e.target.value;
          let next = raw;
          try {
            if (/^[\[\{].*[\]\}]$/.test(raw.trim())) next = JSON.parse(raw);
            else if (raw === "true" || raw === "false") next = raw === "true";
            else if (!isNaN(Number(raw)) && raw.trim() !== "") next = Number(raw);
          } catch {
            // keep as string if JSON parse fails
          }
          setDraft((d) => ({ ...d, [k]: next }));
        }}
      />
    );
  };

  const handleStart = () => setIsEditing(true);

  const handleCancel = () => {
    setDraft(propsObj || {});
    setIsEditing(false);
    onCancelEdit?.();
  };

  const handleSave = async () => {
    if (!onSave) return;
    if (!window.confirm("Are you sure you want to save changes?")) return;
    try {
      setBusy(true);
      await onSave(draft); // parent ensures localStorage-only update
      setIsEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={wrap}>
      {editable && (
        <div style={ctrlBar}>
          {!isEditing ? (
            <button style={btn} onClick={handleStart}>Edit</button>
          ) : (
            <>
              <button style={btn} onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button style={btn} onClick={handleCancel} disabled={busy}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {!entries.length && <div style={{ opacity: 0.7 }}>No properties.</div>}

      {entries.map(([k, v], i) => (
        <div key={k} style={row(i)}>
          <div style={kCell}>{k}</div>
          <div style={vCell}>
            {isEditing ? renderField(k) : renderVal(v)}
          </div>
        </div>
      ))}
    </div>
  );
}
