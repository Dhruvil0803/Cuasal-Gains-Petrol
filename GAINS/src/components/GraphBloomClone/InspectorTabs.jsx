// import React from "react";

// export default function InspectorTabs({ inspectorTab, setInspectorTab }) {
//   const tabs = ["details", "graph", "style"]; // ← added "style"

//   return (
//     <>
//       {tabs.map((tab) => (
//         <button
//           key={tab}
//           onClick={() => setInspectorTab(tab)}
//           style={{
//             padding: "8px 12px",
//             borderRadius: 8,
//             border: inspectorTab === tab ? "1px solid #3b82f6" : "1px solid #2c313c",
//             background: inspectorTab === tab ? "#1e293b" : "#0f1116",
//             color: inspectorTab === tab ? "#dbeafe" : "#e5e7eb",
//             fontWeight: 700,
//             marginRight: 8
//           }}
//         >
//           {tab === "details" ? "Details" : tab === "graph" ? "Graph" : "Rule styling"}
//         </button>
//       ))}
//     </>
//   );
// }
// src/components/GraphBloomClone/InspectorTabs.jsx
import React from "react";

export default function InspectorTabs({ t, inspectorTab, setInspectorTab }) {
  const tabs = ["details", "graph", "style"];

  const tabBtn = (active) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? (t.ctrlBr || t.border) : t.border}`,
    background: active ? (t.cardBg) : (t.panelBg),
    color: t.text,
    fontWeight: 700,
    marginRight: 8,
    cursor: "pointer",
  });

  const label = (tab) =>
    tab === "details" ? "Details" : tab === "graph" ? "Graph" : "Rule styling";

  return (
    <>
      {tabs.map((tab) => {
        const active = inspectorTab === tab;
        return (
          <button
            key={tab}
            onClick={() => setInspectorTab(tab)}
            style={tabBtn(active)}
          >
            {label(tab)}
          </button>
        );
      })}
    </>
  );
}
