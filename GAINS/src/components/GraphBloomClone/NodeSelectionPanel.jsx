// // src/components/GraphBloomClone/NodeSelectionPanel.jsx
// import React from "react";

// export default function NodeSelectionPanel({
//   // label selection + load
//   labels,
//   selectedLabel,
//   setSelectedLabel,
//   loadNodesByLabel,

//   // node rule UI state
//   nodeProps,
//   nProp,
//   setNProp,
//   nMode,
//   setNMode,
//   nEqualsVal,
//   setNEqualsVal,
//   nRangeMin,
//   setNRangeMin,
//   nRangeMax,
//   setNRangeMax,
//   nColor,
//   setNColor,
//   nSize,
//   setNSize,
//   nTextColor,
//   setNTextColor,
//   nDistinct,
//   nValueOptions,

//   // actions
//   addRule,
//   applyRules,
//   clearRules,

//   // rules list (for disabling Clear rules button)
//   rules,
// }) {
//   return (
//     <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid #2c313c" }}>
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Node Selection</div>

//       <select
//         value={selectedLabel}
//         onChange={(e) => setSelectedLabel(e.target.value)}
//         style={{
//           width: "100%",
//           padding: "10px 12px",
//           border: "1px solid #374151",
//           borderRadius: 8,
//           background: "#0f1116",
//           color: "#e5e7eb",
//         }}
//       >
//         <option value="">— Select a label —</option>
//         {labels.map((l) => (
//           <option key={l} value={l}>
//             {l}
//           </option>
//         ))}
//       </select>

//       <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
//         <button
//           onClick={loadNodesByLabel}
//           disabled={!selectedLabel}
//           style={{
//             padding: "10px 16px",
//             borderRadius: 8,
//             background: "#3b82f6",
//             color: "#fff",
//             border: "1px solid #3b82f6",
//             fontWeight: 700,
//           }}
//         >
//           Load
//         </button>
//       </div>

//       {selectedLabel && (
//         <div
//           style={{
//             marginTop: 12,
//             background: "#0f1116",
//             border: "1px solid #2c313c",
//             borderRadius: 10,
//             padding: 12,
//           }}
//         >
//           <div style={{ fontWeight: 700, marginBottom: 8 }}>Style “{selectedLabel}”</div>

//           <select
//             value={nProp}
//             onChange={(e) => setNProp(e.target.value)}
//             style={{
//               width: "100%",
//               padding: "8px 10px",
//               border: "1px solid #374151",
//               borderRadius: 8,
//               background: "#15171d",
//               color: "#e5e7eb",
//             }}
//           >
//             <option value="">— Select a property —</option>
//             {nodeProps.map((p) => (
//               <option key={p} value={p}>
//                 {p}
//               </option>
//             ))}
//           </select>

//           <div
//             style={{
//               display: "flex",
//               gap: 10,
//               flexWrap: "wrap",
//               alignItems: "center",
//               marginTop: 8,
//             }}
//           >
//             {[
//               ["single-equals", "Single • equals"],
//               ["single-exists", "Single • exists"],
//               ["range", "Range"],
//               ["unique", "Unique values"],
//             ].map(([v, lab]) => (
//               <label key={v} style={{ display: "flex", gap: 6, alignItems: "center" }}>
//                 <input type="radio" checked={nMode === v} onChange={() => setNMode(v)} />
//                 <span style={{ fontSize: 12 }}>{lab}</span>
//               </label>
//             ))}
//           </div>

//           {nMode === "single-equals" && (
//             <div style={{ marginTop: 8 }}>
//               <select
//                 value={
//                   (nValueOptions.findIndex((v) => Object.is(v, nEqualsVal)) ?? "") // index mapping
//                 }
//                 onChange={(e) => {
//                   const i = e.target.value === "" ? -1 : Number(e.target.value);
//                   setNEqualsVal(i >= 0 ? nValueOptions[i] : null);
//                 }}
//                 disabled={!nProp || nValueOptions.length === 0}
//                 style={{
//                   width: "100%",
//                   padding: "8px 10px",
//                   border: "1px solid #374151",
//                   borderRadius: 8,
//                   background: "#15171d",
//                   color: "#e5e7eb",
//                 }}
//               >
//                 <option value="">
//                   {nValueOptions.length ? "— Select a value —" : "No values found"}
//                 </option>
//                 {nValueOptions.map((v, i) => (
//                   <option key={i} value={String(i)}>
//                     {typeof v === "object" ? JSON.stringify(v) : String(v)}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}

//           {nMode === "range" && (
//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 8,
//                 marginTop: 8,
//               }}
//             >
//               <input
//                 type="number"
//                 value={nRangeMin}
//                 onChange={(e) => setNRangeMin(e.target.value)}
//                 placeholder="Min"
//                 style={{
//                   padding: "8px 10px",
//                   border: "1px solid #374151",
//                   borderRadius: 8,
//                   background: "#15171d",
//                   color: "#e5e7eb",
//                 }}
//               />
//               <input
//                 type="number"
//                 value={nRangeMax}
//                 onChange={(e) => setNRangeMax(e.target.value)}
//                 placeholder="Max"
//                 style={{
//                   padding: "8px 10px",
//                   border: "1px solid #374151",
//                   borderRadius: 8,
//                   background: "#15171d",
//                   color: "#e5e7eb",
//                 }}
//               />
//             </div>
//           )}

//           {nMode === "unique" && (
//             <div style={{ marginTop: 8, fontSize: 12, color: "#9aa3b2" }}>
//               <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
//                 {nDistinct.slice(0, 20).map((v, i) => (
//                   <span
//                     key={i}
//                     style={{
//                       padding: "2px 6px",
//                       borderRadius: 999,
//                       border: "1px solid #2c313c",
//                       background: "#15171d",
//                     }}
//                   >
//                     {typeof v === "object" ? JSON.stringify(v) : String(v)}
//                   </span>
//                 ))}
//                 {nDistinct.length > 20 && <span>+{nDistinct.length - 20}…</span>}
//               </div>
//             </div>
//           )}

//           <div
//             style={{
//               display: "grid",
//               gridTemplateColumns: "110px 110px 1fr",
//               gap: 10,
//               marginTop: 10,
//             }}
//           >
//             <label style={{ fontSize: 12, color: "#9aa3b2", display: "flex", alignItems: "center", gap: 6 }}>
//               Color <input type="color" value={nColor} onChange={(e) => setNColor(e.target.value)} />
//             </label>
//             <label style={{ fontSize: 12, color: "#9aa3b2", display: "flex", alignItems: "center", gap: 6 }}>
//               Size{" "}
//               <input
//                 type="number"
//                 min="0"
//                 value={nSize}
//                 onChange={(e) => setNSize(e.target.value)}
//                 style={{
//                   width: 70,
//                   padding: "4px 6px",
//                   border: "1px solid #374151",
//                   borderRadius: 6,
//                   background: "#15171d",
//                   color: "#e5e7eb",
//                 }}
//               />
//             </label>
//             <label style={{ fontSize: 12, color: "#9aa3b2", display: "flex", alignItems: "center", gap: 6 }}>
//               Text <input type="color" value={nTextColor} onChange={(e) => setNTextColor(e.target.value)} />
//             </label>
//           </div>

//           <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
//             <button
//               onClick={() => addRule("node")}
//               disabled={!nProp}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: 8,
//                 background: "#22c55e",
//                 color: "#0b1219",
//                 border: "1px solid #16a34a",
//                 fontWeight: 800,
//               }}
//             >
//               Add rule
//             </button>
//             <button
//               onClick={applyRules}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: 8,
//                 background: "#3b82f6",
//                 color: "#fff",
//                 border: "1px solid #3b82f6",
//                 fontWeight: 800,
//               }}
//             >
//               Apply
//             </button>
//             <button
//               onClick={clearRules}
//               disabled={!rules.length}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: 8,
//                 background: "#1b0f0f",
//                 color: "#fecaca",
//                 border: "1px solid #7f1d1d",
//                 fontWeight: 800,
//               }}
//             >
//               Clear rules
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
// src/components/GraphBloomClone/NodeSelectionPanel.jsx
import React from "react";

export default function NodeSelectionPanel({
  // label selection + load
  labels,
  selectedLabel,
  setSelectedLabel,
  loadNodesByLabel,

  // node rule UI state
  nodeProps,
  nProp,
  setNProp,
  nMode,
  setNMode,
  nEqualsVal,
  setNEqualsVal,
  nRangeMin,
  setNRangeMin,
  nRangeMax,
  setNRangeMax,
  nColor,
  setNColor,
  nSize,
  setNSize,
  nTextColor,
  setNTextColor,
  nDistinct,
  nValueOptions,

  // actions
  addRule,
  applyRules,
  clearRules,

  // rules list (for disabling Clear rules button)
  rules,

  // THEME
  t,

  captionByLabel,    // ⬅️ NEW
  setCaptionPref,//NEW
}) {
  const isLight = (t?.appBg || "#ffffff").toLowerCase() === "#ffffff";
  const warnBg = t?.warnBg ?? (isLight ? "#fff1f2" : "#1b0f0f");
  const warnBr = t?.warnBr ?? (isLight ? "#fecdd3" : "#7f1d1d");
  const warnText = isLight ? "#7f1d1d" : "#fecaca";

  const sectionCard = {
    background: t?.panelBg || "#f8fafc",
    border: `1px solid ${t?.border || "#e5e7eb"}`,
    borderRadius: 10,
    padding: 12,
  };

  const ctrl = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
    borderRadius: 8,
    background: t?.ctrlBg || "#ffffff",
    color: t?.text || "#0b1219",
    outline: "none",
  };

  const ctrlSm = {
    padding: "8px 10px",
    border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
    borderRadius: 8,
    background: t?.ctrlBg || "#ffffff",
    color: t?.text || "#0b1219",
    outline: "none",
  };

  const hint = { fontSize: 12, color: t?.subtext || "#334155" };

  const btn = {
    padding: "10px 16px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  };

  //NEW
const captionValue = selectedLabel
  ? (captionByLabel?.[selectedLabel] ?? "<auto>")
  : "<auto>";


  return (
    <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: `1px solid ${t?.border || "#e5e7eb"}` }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: t?.text || "#0b1219" }}>
        Node Selection
      </div>

      {/* Label selector */}
      <select
        value={selectedLabel}
        onChange={(e) => setSelectedLabel(e.target.value)}
        style={ctrl}
      >
        <option value="">— Select a label —</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      {/* Caption chooser (what to show on node labels) */}
<div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
  <label
    style={{
      fontWeight: 600,
      fontSize: 12,
      opacity: 0.9,
      whiteSpace: "nowrap",
      minWidth: 64,
    }}
  >
    Caption:
  </label>

  <select
    disabled={!selectedLabel}
    value={captionValue}
    onChange={(e) => {
      const field = e.target.value; // "<auto>", "<label>", "<id>", or a real property
      if (selectedLabel) setCaptionPref(selectedLabel, field);
    }}
    style={{
      flex: 1,
      padding: "6px 8px",
      borderRadius: 8,
      border: `1px solid ${t.border}`,
      background: t.ctrlBg,
      color: t.text,
    }}
    title="Choose which value appears on nodes"
  >
    {/* Smart default */}
    <option value="<auto>">Properties</option>

    {/* Special */}
    <option value="<label>">&lt;label&gt; (first label)</option>
    <option value="<id>">&lt;id&gt; (elementId)</option>

    {/* Concrete properties for this label */}
    {Array.isArray(nodeProps) &&
      nodeProps.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
  </select>
</div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          onClick={loadNodesByLabel}
          disabled={!selectedLabel}
          style={{
            ...btn,
            background: "#22c55e",
            border: "1px solid #16a34a",
            color: "#0b1219",
            opacity: selectedLabel ? 1 : 0.6,
          }}
        >
          Load
        </button>
      </div>

      {selectedLabel && (
        <div style={{ marginTop: 12, ...sectionCard }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: t?.text || "#0b1219" }}>
            Style “{selectedLabel}”
          </div>

          {/* Property selector */}
          <select
            value={nProp}
            onChange={(e) => setNProp(e.target.value)}
            style={ctrlSm}
          >
            <option value="">— Select a property —</option>
            {nodeProps.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Mode radios */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            {[
              ["single-equals", "Single • equals"],
              ["single-exists", "Single • exists"],
              ["range", "Range"],
              ["unique", "Unique values"],
            ].map(([v, lab]) => (
              <label key={v} style={{ display: "flex", gap: 6, alignItems: "center", ...hint }}>
                <input type="radio" checked={nMode === v} onChange={() => setNMode(v)} />
                <span>{lab}</span>
              </label>
            ))}
          </div>

          {/* Equals value selector */}
          {nMode === "single-equals" && (
            <div style={{ marginTop: 8 }}>
              <select
                value={
                  nValueOptions.findIndex((v) => Object.is(v, nEqualsVal)) ?? ""
                }
                onChange={(e) => {
                  const i = e.target.value === "" ? -1 : Number(e.target.value);
                  setNEqualsVal(i >= 0 ? nValueOptions[i] : null);
                }}
                disabled={!nProp || nValueOptions.length === 0}
                style={ctrlSm}
              >
                <option value="">
                  {nValueOptions.length ? "— Select a value —" : "No values found"}
                </option>
                {nValueOptions.map((v, i) => (
                  <option key={i} value={String(i)}>
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Range inputs */}
          {nMode === "range" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <input
                type="number"
                value={nRangeMin}
                onChange={(e) => setNRangeMin(e.target.value)}
                placeholder="Min"
                style={ctrlSm}
              />
              <input
                type="number"
                value={nRangeMax}
                onChange={(e) => setNRangeMax(e.target.value)}
                placeholder="Max"
                style={ctrlSm}
              />
            </div>
          )}

          {/* Unique preview */}
          {nMode === "unique" && (
            <div style={{ marginTop: 8, ...hint }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {nDistinct.slice(0, 20).map((v, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: `1px solid ${t?.border || "#e5e7eb"}`,
                      background: t?.ctrlBg || "#ffffff",
                      color: t?.text || "#0b1219",
                    }}
                  >
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </span>
                ))}
                {nDistinct.length > 20 && <span>+{nDistinct.length - 20}…</span>}
              </div>
            </div>
          )}

          {/* Color/size/text controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 110px 1fr",
              gap: 10,
              marginTop: 10,
            }}
          >
            <label style={{ ...hint, display: "flex", alignItems: "center", gap: 6 }}>
              Color <input type="color" value={nColor} onChange={(e) => setNColor(e.target.value)} />
            </label>
            <label style={{ ...hint, display: "flex", alignItems: "center", gap: 6 }}>
              Size{" "}
              <input
                type="number"
                min="0"
                value={nSize}
                onChange={(e) => setNSize(e.target.value)}
                style={{
                  width: 70,
                  padding: "4px 6px",
                  border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
                  borderRadius: 6,
                  background: t?.ctrlBg || "#ffffff",
                  color: t?.text || "#0b1219",
                  outline: "none",
                }}
              />
            </label>
            <label style={{ ...hint, display: "flex", alignItems: "center", gap: 6 }}>
              Text <input type="color" value={nTextColor} onChange={(e) => setNTextColor(e.target.value)} />
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={() => addRule("node")}
              disabled={!nProp}
              style={{
                ...btn,
                background: "#22c55e",
                color: "#0b1219",
                border: "1px solid #16a34a",
                opacity: nProp ? 1 : 0.6,
              }}
            >
              Add rule
            </button>
            <button
              onClick={applyRules}
              style={{
                ...btn,
                background: "#F47920",
                color: "#ffffff",
                border: "1px solid #D4621A",
              }}
            >
              Apply
            </button>
            <button
              onClick={clearRules}
              disabled={!rules.length}
              style={{
                ...btn,
                background: warnBg,
                border: `1px solid ${warnBr}`,
                color: warnText,
                opacity: rules.length ? 1 : 0.6,
              }}
            >
              Clear rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
