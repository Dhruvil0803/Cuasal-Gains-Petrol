// // src/components/GraphBloomClone/ControlsRow.jsx
// import React from "react";

// export default function ControlsRow({ limit, setLimit, fit, clearGraph }) {
//   return (
//     <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
//       <input
//         type="number"
//         value={limit}
//         onChange={(e) => setLimit(Math.max(0, parseInt(e.target.value || 0, 10)))}
//         style={{
//           width: 90,
//           padding: "8px 10px",
//           border: "1px solid #374151",
//           borderRadius: 8,
//           background: "#0f1116",
//           color: "#e5e7eb",
//         }}
//       />
//       <button
//         onClick={fit}
//         style={{
//           padding: "8px 12px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#0f1116",
//           color: "#e5e7eb",
//         }}
//       >
//         Fit
//       </button>
//       <button
//         onClick={clearGraph}
//         style={{
//           padding: "8px 12px",
//           borderRadius: 8,
//           border: "1px solid #7f1d1d",
//           background: "#1b0f0f",
//           color: "#fecaca",
//           fontWeight: 700,
//         }}
//       >
//         Clear Graph
//       </button>
//     </div>
//   );
// }
// src/components/GraphBloomClone/ControlsRow.jsx
import React from "react";

export default function ControlsRow({ limit, setLimit, fit, clearGraph, t }) {
  // Fallbacks in case your theme object doesn't define warn tokens
  const isLight = (t?.appBg || "#ffffff").toLowerCase() === "#ffffff";
  const warnBg = t?.warnBg ?? (isLight ? "#fff1f2" : "#1b0f0f");
  const warnBr = t?.warnBr ?? (isLight ? "#fecdd3" : "#7f1d1d");
  const warnText = isLight ? "#7f1d1d" : "#fecaca";

  const ctrlBase = {
    height: 36,
    borderRadius: 8,
    border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
    background: t?.ctrlBg || "#ffffff",
    color: t?.text || "#0b1219",
    outline: "none",
  };

  const btn = {
    ...ctrlBase,
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      {/* <input
        type="number"
        value={limit}
        onChange={(e) =>
          setLimit(Math.max(0, parseInt(e.target.value || 0, 10)))
        }
        style={{
          ...ctrlBase,
          width: 100,
          padding: "0 10px",
        }}
      /> */}
      <input
  type="number"
  step={1}
  min={0}
  value={Number.isFinite(limit) ? limit : 0}
  onChange={(e) =>
    setLimit(Math.max(0, Math.trunc(Number(e.target.value) || 0)))
  }
  onWheel={(e) => e.currentTarget.blur()} // prevents accidental scroll changes
  style={{
    ...ctrlBase,
    width: 100,
    padding: "0 10px",
  }}
/>

      <button onClick={fit} style={btn}>
        Fit
      </button>

      <button
        onClick={clearGraph}
        style={{
          ...btn,
          background: warnBg,
          border: `1px solid ${warnBr}`,
          color: warnText,
        }}
      >
        Clear Graph
      </button>
    </div>
  );
}
