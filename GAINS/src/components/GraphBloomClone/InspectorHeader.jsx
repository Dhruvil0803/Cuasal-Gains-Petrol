// // src/components/GraphBloomClone/InspectorHeader.jsx
// import React from "react";

// export default function InspectorHeader({
//   nodeDetails,
//   hudCat,
//   setHudCat,
//   openHudForCategory,
// }) {
//   return (
//     <div
//       style={{
//         padding: "12px 16px",
//         borderBottom: "1px solid #2c313c",
//         background: "linear-gradient(135deg,#2a2d35 0%,#20232a 100%)",
//         borderTopLeftRadius: 14,
//         borderTopRightRadius: 14,
//       }}
//     >
//       <div style={{ fontSize: 13, color: "#9aa3b2", marginBottom: 6 }}>
//         elementId: <code style={{ color: "#e5e7eb" }}>{nodeDetails.id}</code>
//       </div>

//       {!!nodeDetails.labels?.length && nodeDetails.labels[0] !== "Loading…" && (
//         <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
//           {nodeDetails.labels.map((lb) => {
//             const active = hudCat === lb;
//             return (
//               <button
//                 key={lb}
//                 onClick={() => {
//                   openHudForCategory(lb);
//                   setHudCat(lb);
//                 }}
//                 title="Style this label"
//                 style={{
//                   fontSize: 11,
//                   fontWeight: 700,
//                   color: "#ffd166",
//                   background: active ? "#1e293b" : "#3a2f1a",
//                   border: active ? "1px solid #3b82f6" : "1px solid #5c4521",
//                   padding: "2px 10px",
//                   borderRadius: 999,
//                   cursor: "pointer",
//                 }}
//               >
//                 {lb}
//               </button>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }
// src/components/GraphBloomClone/InspectorHeader.jsx
import React from "react";

export default function InspectorHeader({
  t,                  // ← THEME TOKENS
  nodeDetails,
  hudCat,
  setHudCat,
  openHudForCategory,
}) {
  const headerWrap = {
    padding: "12px 16px",
    borderBottom: `1px solid ${t.border}`,
    // soft gradient that adapts to theme
    background:
      t === undefined
        ? "#fff"
        : `linear-gradient(135deg, ${t.cardBg} 0%, ${t.panelBg} 100%)`,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    color: t.text,
  };

  const meta = { fontSize: 13, color: t.subtext, marginBottom: 6 };
  const code = {
    padding: "0 4px",
    borderRadius: 6,
    background: t.cardBg,
    border: `1px solid ${t.border}`,
    color: t.text,
  };

  // label “chips”
  const chip = (active) => ({
    fontSize: 11,
    fontWeight: 700,
    color: active ? t.text : "#b26b00",         // warm accent for inactive
    background: active ? t.accent1 || t.cardBg : (t.cardBg),
    border: `1px solid ${active ? (t.ctrlBr || t.border) : t.border}`,
    padding: "2px 10px",
    borderRadius: 999,
    cursor: "pointer",
  });

  return (
    <div style={headerWrap}>
      <div style={meta}>
        {/* elementId: <code style={code}>{nodeDetails.id}</code> */}
      </div>

      {!!nodeDetails.labels?.length && nodeDetails.labels[0] !== "Loading…" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {nodeDetails.labels.map((lb) => {
            const active = hudCat === lb;
            return (
              <button
                key={lb}
                onClick={() => {
                  openHudForCategory(lb);
                  setHudCat(lb);
                }}
                title="Style this label"
                style={chip(active)}
              >
                {lb}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
