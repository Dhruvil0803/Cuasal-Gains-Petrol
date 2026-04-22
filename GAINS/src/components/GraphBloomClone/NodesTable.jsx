// // src/components/GraphBloomClone/NodesTable.jsx
// import React, { useEffect, useState } from "react";

// /**
//  * NodesTable
//  * - Live view of all nodes in Cytoscape instance
//  * - Clean, curated display of properties
//  * - Expand per row for full details
//  * - Toggle visibility via parent (Toolbar) or ❌ inside table
//  */
// export default function NodesTable({ cy, visible, setVisible }) {
//   const [rows, setRows] = useState([]);
//   const [expandedRow, setExpandedRow] = useState(null);

//   // Build a snapshot of current nodes
//   const buildSnapshot = () => {
//     if (!cy) return [];
//     return cy.nodes().map((n) => ({
//       id: n.id(),
//       labels: n.data("_labels") || [],
//       props: n.data(),
//       style: {
//         color: n.style("background-color"),
//         textColor: n.style("color"),
//         size: n.style("width"),
//       },
//     }));
//   };

//   // Subscribe to graph changes
//   useEffect(() => {
//     if (!cy) return;
//     const update = () => setRows(buildSnapshot());
//     update();
//     cy.on("add remove data style", update);
//     return () => {
//       cy.removeListener("add remove data style", update);
//     };
//   }, [cy]);

//   if (!visible) return null;

//   if (!rows.length) {
//     return (
//       <div
//         style={{
//           background: "#0f1116",
//           border: "1px solid #2c313c",
//           borderRadius: 10,
//           padding: 10,
//           fontSize: 13,
//           color: "#9aa3b2",
//         }}
//       >
//         No nodes in graph.
//         <button
//           onClick={() => setVisible(false)}
//           style={{
//             marginLeft: 10,
//             background: "transparent",
//             color: "#fca5a5",
//             border: "none",
//             cursor: "pointer",
//           }}
//         >
//           ×
//         </button>
//       </div>
//     );
//   }

//   // Curated props preview
//   function renderPropsPreview(props) {
//     if (!props) return "(none)";
//     const keys = Object.keys(props).filter((k) => !k.startsWith("_"));
//     if (!keys.length) return "(none)";

//     const preview = keys
//       .slice(0, 3)
//       .map((k) => `${k}: ${String(props[k])}`)
//       .join(", ");
//     const more = keys.length > 3 ? ` … (+${keys.length - 3} more)` : "";
//     return preview + more;
//   }

//   return (
//     <div
//       style={{
//         background: "#0f1116",
//         border: "1px solid #2c313c",
//         borderRadius: 10,
//         overflow: "hidden",
//         maxHeight: 320,
//         display: "flex",
//         flexDirection: "column",
//       }}
//     >
//       {/* Header with close */}
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           padding: "6px 10px",
//           background: "#1f2937",
//           borderBottom: "1px solid #2c313c",
//         }}
//       >
//         <span style={{ fontWeight: 600, fontSize: 13 }}>Nodes Table</span>
//         <button
//           onClick={() => setVisible(false)}
//           style={{
//             background: "transparent",
//             border: "none",
//             color: "#fca5a5",
//             fontSize: 16,
//             cursor: "pointer",
//             lineHeight: 1,
//           }}
//           title="Close table"
//         >
//           ×
//         </button>
//       </div>

//       {/* Table */}
//       <div style={{ overflowY: "auto", flex: 1 }}>
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             fontSize: 12,
//             color: "#e5e7eb",
//           }}
//         >
//           <thead style={{ background: "#111827" }}>
//             <tr>
//               <th style={{ padding: 6, textAlign: "left" }}>ID</th>
//               <th style={{ padding: 6, textAlign: "left" }}>Labels</th>
//               <th style={{ padding: 6, textAlign: "center" }}>Color</th>
//               <th style={{ padding: 6, textAlign: "center" }}>Size</th>
//               <th style={{ padding: 6, textAlign: "left" }}>Props</th>
//             </tr>
//           </thead>
//           <tbody>
//             {rows.map((row, idx) => (
//               <React.Fragment key={row.id}>
//                 <tr
//                   style={{
//                     background: idx % 2 === 0 ? "#111827" : "#1f2937",
//                   }}
//                 >
//                   <td style={{ padding: "6px 8px" }}>{row.id}</td>
//                   <td style={{ padding: "6px 8px" }}>
//                     {row.labels.join(", ") || "(none)"}
//                   </td>
//                   <td style={{ textAlign: "center" }}>
//                     <span
//                       style={{
//                         display: "inline-block",
//                         width: 16,
//                         height: 16,
//                         borderRadius: 4,
//                         background: row.style.color,
//                         border: "1px solid #374151",
//                       }}
//                     />
//                   </td>
//                   <td style={{ textAlign: "center" }}>{row.style.size}</td>
//                   <td style={{ padding: "6px 8px" }}>
//                     {renderPropsPreview(row.props)}
//                     <button
//                       onClick={() =>
//                         setExpandedRow(expandedRow === row.id ? null : row.id)
//                       }
//                       style={{
//                         marginLeft: 6,
//                         fontSize: 11,
//                         padding: "2px 6px",
//                         borderRadius: 6,
//                         border: "1px solid #374151",
//                         background: "#0f1116",
//                         color: "#93c5fd",
//                         cursor: "pointer",
//                       }}
//                     >
//                       {expandedRow === row.id ? "Hide" : "View"}
//                     </button>
//                   </td>
//                 </tr>
//                 {expandedRow === row.id && (
//                   <tr style={{ background: "#0b0f15" }}>
//                     <td colSpan={5} style={{ padding: "6px 10px" }}>
//                       <div style={{ fontSize: 12, lineHeight: 1.5 }}>
//                         {Object.entries(row.props)
//                           .filter(([k]) => !k.startsWith("_"))
//                           .map(([k, v]) => (
//                             <div key={k}>
//                               <b style={{ color: "#93c5fd" }}>{k}</b>:{" "}
//                               <span style={{ color: "#d1d5db" }}>
//                                 {typeof v === "object"
//                                   ? JSON.stringify(v)
//                                   : String(v)}
//                               </span>
//                             </div>
//                           ))}
//                       </div>
//                     </td>
//                   </tr>
//                 )}
//               </React.Fragment>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }
// src/components/GraphBloomClone/NodesTable.jsx
import React, { useEffect, useState } from "react";

/**
 * NodesTable
 * - Live view of all nodes in Cytoscape instance
 * - Clean, curated display of properties
 * - Expand per row for full details
 * - Toggle visibility via parent (Toolbar) or ❌ inside table
 */
export default function NodesTable({ cy, visible, setVisible, t }) {
  const [rows, setRows] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  // Build a snapshot of current nodes
  const buildSnapshot = () => {
    if (!cy) return [];
    return cy.nodes().map((n) => ({
      id: n.id(),
      labels: n.data("_labels") || [],
      props: n.data(),
      style: {
        color: n.style("background-color"),
        textColor: n.style("color"),
        size: n.style("width"),
      },
    }));
  };

  // Subscribe to graph changes
  useEffect(() => {
    if (!cy) return;
    const update = () => setRows(buildSnapshot());
    update();
    cy.on("add remove data style", update);
    return () => {
      cy.removeListener("add remove data style", update);
    };
  }, [cy]);

  if (!visible) return null;

  if (!rows.length) {
    return (
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          padding: 10,
          fontSize: 13,
          color: t.subtext,
        }}
      >
        No nodes in graph.
        <button
          onClick={() => setVisible(false)}
          style={{
            marginLeft: 10,
            background: "transparent",
            color: "#ef4444",
            border: "none",
            cursor: "pointer",
          }}
          title="Close table"
        >
          ×
        </button>
      </div>
    );
  }

  // Curated props preview
  function renderPropsPreview(props) {
    if (!props) return "(none)";
    const keys = Object.keys(props).filter((k) => !k.startsWith("_"));
    if (!keys.length) return "(none)";

    const preview = keys
      .slice(0, 3)
      .map((k) => `${k}: ${String(props[k])}`)
      .join(", ");
    const more = keys.length > 3 ? ` … (+${keys.length - 3} more)` : "";
    return preview + more;
  }

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    background: t.cardBg,
    borderBottom: `1px solid ${t.border}`,
    color: t.text,
  };

  const containerStyle = {
    background: t.panelBg,
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    overflow: "hidden",
    maxHeight: 320,
    display: "flex",
    flexDirection: "column",
    color: t.text,
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    color: t.text,
  };

  const headBg = t.cardBg;
  const rowBg = (idx) => (idx % 2 === 0 ? t.cardBg : t.panelBg);
  const expandedBg = t.cardBg;

  return (
    <div style={containerStyle}>
      {/* Header with close */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Nodes Table</span>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: "#ef4444",
            fontSize: 14,
            cursor: "pointer",
            lineHeight: 1,
            padding: "2px 8px",
          }}
          title="Close table"
        >
          ×
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        <table style={tableStyle}>
          <thead style={{ background: headBg }}>
            <tr>
              {/* <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>ID</th> */}
              <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>Labels</th>
              <th style={{ padding: 6, textAlign: "center", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>Color</th>
              <th style={{ padding: 6, textAlign: "center", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>Size</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>Props</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <React.Fragment key={row.id}>
                <tr style={{ background: rowBg(idx) }}>
                  {/* <td style={{ padding: "6px 8px", borderBottom: `1px dashed ${t.border}` }}>{row.id}</td> */}
                  <td style={{ padding: "6px 8px", borderBottom: `1px dashed ${t.border}` }}>
                    {row.labels.join(", ") || "(none)"}
                  </td>
                  <td style={{ textAlign: "center", borderBottom: `1px dashed ${t.border}` }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: row.style.color,
                        border: `1px solid ${t.border}`,
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "center", borderBottom: `1px dashed ${t.border}` }}>
                    {row.style.size}
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px dashed ${t.border}` }}>
                    {renderPropsPreview(row.props)}
                    <button
                      onClick={() =>
                        setExpandedRow(expandedRow === row.id ? null : row.id)
                      }
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 6,
                        border: `1px solid ${t.ctrlBr}`,
                        background: t.ctrlBg,
                        color: t.text,
                        cursor: "pointer",
                      }}
                    >
                      {expandedRow === row.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {expandedRow === row.id && (
                  <tr style={{ background: expandedBg }}>
                    <td colSpan={5} style={{ padding: "8px 10px", borderTop: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                        {Object.entries(row.props)
                          .filter(([k]) => !k.startsWith("_"))
                          .map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 2 }}>
                              <b style={{ color: t.text }}>{k}</b>:{" "}
                              <span style={{ color: t.subtext }}>
                                {typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
