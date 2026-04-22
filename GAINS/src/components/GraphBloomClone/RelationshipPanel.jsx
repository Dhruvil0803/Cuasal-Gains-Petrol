// // src/components/GraphBloomClone/RelationshipPanel.jsx
// import React from "react";

// export default function RelationshipPanel({
//   relTypes,
//   selectedRel,
//   setSelectedRel,
//   loadRelationships,
//   rColor,
//   setRColor,
//   applyRules,
//   clearRules,
//   hasRules,
// }) {
//   return (
//     <div style={{ marginBottom: 22, paddingBottom: 12, borderBottom: "1px solid #2c313c" }}>
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Relationship Types</div>
//       <select
//         value={selectedRel}
//         onChange={(e) => setSelectedRel(e.target.value)}
//         style={{
//           width: "100%",
//           padding: "10px 12px",
//           border: "1px solid #374151",
//           borderRadius: 8,
//           background: "#0f1116",
//           color: "#e5e7eb",
//         }}
//       >
//         <option value="">— Select a type —</option>
//         {relTypes.map((t) => (
//           <option key={t} value={t}>
//             {t}
//           </option>
//         ))}
//       </select>

//       <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
//         <button
//           onClick={loadRelationships}
//           disabled={!selectedRel}
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

//       {selectedRel && (
//         <div
//           style={{
//             marginTop: 12,
//             background: "#0f1116",
//             border: "1px solid #2c313c",
//             borderRadius: 10,
//             padding: 12,
//           }}
//         >
//           <div style={{ fontWeight: 700, marginBottom: 8 }}>Arrow color for “{selectedRel}”</div>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 2 }}>
//             <label style={{ fontSize: 12, color: "#9aa3b2", display: "flex", alignItems: "center", gap: 6 }}>
//               Color <input type="color" value={rColor} onChange={(e) => setRColor(e.target.value)} />
//             </label>
//           </div>

//           <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
//             <button
//               onClick={applyRules}
//               disabled={!selectedRel}
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
//               disabled={!hasRules}
//               style={{
//                 padding: "8px 12px",
//                 borderRadius: 8,
//                 background: "#1b0f0f",
//                 color: "#fecaca",
//                 border: "1px solid #7f1d1d",
//                 fontWeight: 800,
//               }}
//             >
//               Clear node rules
//             </button>
//           </div>
//           <p style={{ color: "#9aa3b2", fontSize: 12 }}>
//             Applies only the color to edges/arrows of this relationship type.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }
// src/components/GraphBloomClone/RelationshipPanel.jsx
import React from "react";

export default function RelationshipPanel({
  relTypes,
  selectedRel,
  setSelectedRel,
  loadRelationships,
  rColor,
  setRColor,
  applyRules,
  clearRules,
  hasRules,

  // THEME
  t,
}) {
  const isLight = (t?.appBg || "#ffffff").toLowerCase() === "#ffffff";
  const warnBg = t?.warnBg ?? (isLight ? "#fff1f2" : "#1b0f0f");
  const warnBr = t?.warnBr ?? (isLight ? "#fecdd3" : "#7f1d1d");
  const warnText = isLight ? "#7f1d1d" : "#fecaca";

  const sectionRuleCard = {
    marginTop: 12,
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

  const hint = { fontSize: 12, color: t?.subtext || "#334155" };

  const btn = {
    padding: "10px 16px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        marginBottom: 22,
        paddingBottom: 12,
        borderBottom: `1px solid ${t?.border || "#e5e7eb"}`,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: t?.text || "#0b1219" }}>
        Relationship Types
      </div>

      {/* Type selector */}
      <select
        value={selectedRel}
        onChange={(e) => setSelectedRel(e.target.value)}
        style={ctrl}
      >
        <option value="">— Select a type —</option>
        {relTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          onClick={loadRelationships}
          disabled={!selectedRel}
          style={{
            ...btn,
            background: "#F47920",
            color: "#ffffff",
            border: "1px solid #D4621A",
            opacity: selectedRel ? 1 : 0.6,
          }}
        >
          Load
        </button>
      </div>

      {selectedRel && (
        <div style={sectionRuleCard}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: t?.text || "#0b1219" }}>
            Arrow color for “{selectedRel}”
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 2 }}>
            <label style={{ ...hint, display: "flex", alignItems: "center", gap: 6 }}>
              Color <input type="color" value={rColor} onChange={(e) => setRColor(e.target.value)} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={applyRules}
              disabled={!selectedRel}
              style={{
                ...btn,
                background: "#F47920",
                color: "#ffffff",
                border: "1px solid #D4621A",
                opacity: selectedRel ? 1 : 0.6,
              }}
            >
              Apply
            </button>

            <button
              onClick={clearRules}
              disabled={!hasRules}
              style={{
                ...btn,
                background: warnBg,
                border: `1px solid ${warnBr}`,
                color: warnText,
                opacity: hasRules ? 1 : 0.6,
              }}
            >
              Clear node rules
            </button>
          </div>

          <p style={{ ...hint, marginTop: 8 }}>
            Applies only the color to edges/arrows of this relationship type.
          </p>
        </div>
      )}
    </div>
  );
}
