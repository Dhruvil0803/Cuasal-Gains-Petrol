// // src/components/GraphBloomClone/Toolbar.jsx
// import React from "react";

// export default function Toolbar({
//   toolbarStyle,

//   // layout & zoom
//   fullGraph,
//   setFullGraph,
//   layoutName,
//   setLayoutName,
//   runLayout,
//   zoomIn,
//   zoomOut,
//   fit,

//   // toggles
//   showEdgeLabels,
//   setShowEdgeLabels,
//   showArrows,
//   setShowArrows,

//   // counts
//   counts,

//   // what-if / scenarios
//   isWhatIf,
//   enterWhatIf,
//   exitWhatIf,
//   deleteSelection,
//   scenarioName,
//   setScenarioName,
//   saveScenario,

//   // compare
//   scenarios,
//   selectedScenarioId,
//   setSelectedScenarioId,
//   isCompare,
//   setIsCompare,
//   deleteScenario,

//   // 👇 NEW props for table
//   showLeftTable,
//   setShowLeftTable,
//   showRightTable,
//   setShowRightTable,

//   targetMode, setTargetMode,
// }) {
//   return (
//     <div style={toolbarStyle}>
//       {/* Fullscreen toggle */}
//       <button
//         onClick={() => setFullGraph((v) => !v)}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//           fontWeight: 700,
//         }}
//       >
//         {fullGraph ? "Exit Fullscreen" : "Fullscreen"}
//       </button>

//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />
//       {/* Target pane selector */}
// <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginRight: 8 }}>
//   <span style={{ fontSize: 12, color: "#9aa3b2" }}>Target</span>
//   <select
//     value={targetMode}
//     onChange={(e) => setTargetMode(e.target.value)}
//     style={{
//       padding: "6px 8px",
//       border: "1px solid #374151",
//       borderRadius: 8,
//       background: "#15171d",
//       color: "#e5e7eb",
//       minWidth: 96
//     }}
//   >
//     <option value="auto">Auto</option>
//     <option value="left">Left</option>
//     <option value="right" disabled={!isCompare}>Right</option>
//     <option value="both" disabled={!isCompare}>Both</option>
//   </select>
// </div>


//       {/* Layout controls */}
//       <span style={{ fontSize: 12, color: "#9aa3b2" }}>Layout</span>
//       <select
//         value={layoutName}
//         onChange={(e) => setLayoutName(e.target.value)}
//         style={{
//           padding: "6px 8px",
//           border: "1px solid #374151",
//           borderRadius: 8,
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         <option value="cose">cose</option>
//         <option value="breadthfirst">breadthfirst</option>
//         <option value="concentric">concentric</option>
//         <option value="circle">circle</option>
//         <option value="grid">grid</option>
//       </select>
//       <button
//         onClick={runLayout}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         Run layout
//       </button>

//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />

//       {/* Zoom controls */}
//       <button
//         onClick={zoomOut}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         −
//       </button>
//       <button
//         onClick={fit}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         Fit
//       </button>
//       <button
//         onClick={zoomIn}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         +
//       </button>

//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />

//       {/* Edge labels & arrows toggles */}
//       <label
//         style={{
//           display: "flex",
//           gap: 6,
//           alignItems: "center",
//           fontSize: 12,
//           color: "#9aa3b2",
//         }}
//       >
//         <input
//           type="checkbox"
//           checked={showEdgeLabels}
//           onChange={(e) => setShowEdgeLabels(e.target.checked)}
//         />
//         Edge labels
//       </label>
//       <label
//         style={{
//           display: "flex",
//           gap: 6,
//           alignItems: "center",
//           fontSize: 12,
//           color: "#9aa3b2",
//         }}
//       >
//         <input
//           type="checkbox"
//           checked={showArrows}
//           onChange={(e) => setShowArrows(e.target.checked)}
//         />
//         Arrows
//       </label>

//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />

//       {/* Node counts */}
//       <span style={{ fontSize: 12, color: "#9aa3b2" }}>
//         {counts.n} nodes · {counts.e} rels · {counts.sel} selected
//       </span>

//       {/* --- What-if controls --- */}
//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />
//       <button
//         onClick={() => (isWhatIf ? exitWhatIf() : enterWhatIf())}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: isWhatIf ? "#14532d" : "#15171d",
//           color: isWhatIf ? "#d1fae5" : "#e5e7eb",
//           fontWeight: 800,
//         }}
//       >
//         {isWhatIf ? "Exit What-if" : "What-if"}
//       </button>
//       <button
//         onClick={deleteSelection}
//         disabled={!isWhatIf}
//         title="Delete selected nodes/edges"
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #7f1d1d",
//           background: isWhatIf ? "#1b0f0f" : "#111319",
//           color: isWhatIf ? "#fecaca" : "#6b7280",
//           fontWeight: 800,
//         }}
//       >
//         Delete selection
//       </button>
//       <input
//         value={scenarioName}
//         onChange={(e) => setScenarioName(e.target.value)}
//         placeholder="Scenario name"
//         disabled={!isWhatIf}
//         style={{
//           width: 160,
//           padding: "6px 8px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       />
//       <button
//         onClick={saveScenario}
//         disabled={!isWhatIf}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #065f46",
//           background: isWhatIf ? "#064e3b" : "#111319",
//           color: isWhatIf ? "#d1fae5" : "#6b7280",
//           fontWeight: 800,
//         }}
//       >
//         Save scenario
//       </button>

//       {/* --- Compare controls --- */}
//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />
//       <select
//         value={selectedScenarioId}
//         onChange={(e) => setSelectedScenarioId(e.target.value)}
//         style={{
//           padding: "6px 8px",
//           border: "1px solid #374151",
//           borderRadius: 8,
//           background: "#15171d",
//           color: "#e5e7eb",
//         }}
//       >
//         <option value="">— pick a scenario —</option>
//         {scenarios.map((s) => (
//           <option key={s.id} value={s.id}>
//             {s.name} · {new Date(s.createdAt).toLocaleString()}
//           </option>
//         ))}
//       </select>
//       <button
//         onClick={() => setIsCompare((v) => !v)}
//         disabled={!selectedScenarioId && !isCompare}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: isCompare ? "#1e293b" : "#15171d",
//           color: isCompare ? "#dbeafe" : "#e5e7eb",
//           fontWeight: 800,
//         }}
//       >
//         {isCompare ? "Close Compare" : "Compare"}
//       </button>
//       <button
//         onClick={() => selectedScenarioId && deleteScenario(selectedScenarioId)}
//         disabled={!selectedScenarioId}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #7f1d1d",
//           background: selectedScenarioId ? "#1b0f0f" : "#111319",
//           color: selectedScenarioId ? "#fecaca" : "#6b7280",
//           fontWeight: 800,
//         }}
//       >
//         Delete scenario
//       </button>

//       {/* --- Node Tables Toggles --- */}
//       <div style={{ width: 1, height: 20, background: "#2c313c", margin: "0 6px" }} />

//       <button
//         onClick={() => setShowLeftTable((v) => !v)}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: showLeftTable ? "#1e293b" : "#15171d",
//           color: showLeftTable ? "#dbeafe" : "#e5e7eb",
//           fontWeight: 800,
//         }}
//       >
//         {showLeftTable ? "Hide Left Table" : "Show Left Table"}
//       </button>

//       <button
//         onClick={() => setShowRightTable((v) => !v)}
//         disabled={!isCompare}
//         style={{
//           padding: "6px 10px",
//           borderRadius: 8,
//           border: "1px solid #374151",
//           background: showRightTable ? "#1e293b" : "#15171d",
//           color: showRightTable ? "#dbeafe" : "#e5e7eb",
//           fontWeight: 800,
//           opacity: isCompare ? 1 : 0.5,
//         }}
//       >
//         {showRightTable ? "Hide Right Table" : "Show Right Table"}
//       </button>
//     </div>
//   );
// }
// src/components/GraphBloomClone/Toolbar.jsx
// src/components/GraphBloomClone/Toolbar.jsx
// src/components/GraphBloomClone/Toolbar.jsx
import React from "react";

export default function Toolbar({
  toolbarStyle,
  // layout & zoom
  fullGraph,
  setFullGraph,
  layoutName,
  setLayoutName,
  runLayout,
  zoomIn,
  zoomOut,
  fit,
  // toggles
  showEdgeLabels,
  setShowEdgeLabels,
  showArrows,
  setShowArrows,
  // counts
  counts,
  // what-if / scenarios
  isWhatIf,
  enterWhatIf,
  exitWhatIf,
  deleteSelection,
  scenarioName,
  setScenarioName,
  saveScenario,
  // compare
  scenarios,
  selectedScenarioId,
  setSelectedScenarioId,
  isCompare,
  setIsCompare,
  deleteScenario,
  // tables
  showLeftTable,
  setShowLeftTable,
  showRightTable,
  setShowRightTable,
  // targeting
  targetMode,
  setTargetMode,
  // THEME
  theme,
  setTheme,
  onDownloadWhatIfPDF,     // NEW
  onDownloadCompareJSON,   
  onDownloadLeftJSON,      // NEW
// NEW

}) {
  const THEMES = {
    dark: {
      ctrlBg: "#15171d",
      ctrlBr: "#374151",
      text:   "#e5e7eb",
      subtext:"#9aa3b2",
      accent1:"#1e293b",
      divider:"#2c313c",

      // High-contrast action tones for dark
      okBg:   "#10b981",   // emerald-500
      okText: "#0b1219",
      warnBg: "#ef4444",   // red-500
      warnText:"#ffffff",
    },
    light: {
      ctrlBg: "#ffffff",
      ctrlBr: "#e2e8f0",
      text:   "#0b1219",
      subtext:"#334155",
      accent1:"#e2e8f0",
      divider:"#e5e7eb",

      // Softer but still readable in light
      okBg:   "#16a34a",   // emerald-600
      okText: "#ffffff",
      warnBg: "#dc2626",   // red-600
      warnText:"#ffffff",
    },
  };
  const t = THEMES[theme] || THEMES.dark;

  const btn = {
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${t.ctrlBr}`,
    background: t.ctrlBg,
    color: t.text,
    fontWeight: 700,
    cursor: "pointer",
  };
  const select = {
    padding: "6px 8px",
    border: `1px solid ${t.ctrlBr}`,
    borderRadius: 8,
    background: t.ctrlBg,
    color: t.text,
  };
  const chip = { fontSize: 12, color: t.subtext };
  const divider = { width: 1, height: 20, background: t.divider, margin: "0 6px" };

  return (
    <div style={toolbarStyle}>
      {/* Theme switch */}
      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span style={chip}>Theme</span>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} style={select}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div style={divider} />

      {/* Fullscreen toggle */}
      <button onClick={() => setFullGraph((v) => !v)} style={btn}>
        {fullGraph ? "Exit Fullscreen" : "Fullscreen"}
      </button>

      <div style={divider} />

      {/* Target pane selector */}
      <div style={{ display: "inline-flex", gap: 6, alignItems: "center", marginRight: 8 }}>
        <span style={chip}>Target</span>
        <select
          value={targetMode}
          onChange={(e) => setTargetMode(e.target.value)}
          style={{ ...select, minWidth: 96 }}
        >
          <option value="auto">Auto</option>
          <option value="left">Left</option>
          <option value="right" disabled={!isCompare}>Right</option>
          <option value="both" disabled={!isCompare}>Both</option>
        </select>
      </div>

      {/* Layout controls */}
      <span style={chip}>Layout</span>
      <select value={layoutName} onChange={(e) => setLayoutName(e.target.value)} style={select}>
        <option value="cose">cose</option>
        <option value="breadthfirst">breadthfirst</option>
        <option value="concentric">concentric</option>
        <option value="circle">circle</option>
        <option value="grid">grid</option>
      </select>
      <button onClick={runLayout} style={btn}>Run layout</button>

      <div style={divider} />

      {/* Zoom controls */}
      <button onClick={zoomOut} style={btn}>−</button>
      <button onClick={fit} style={btn}>Fit</button>
      <button onClick={zoomIn} style={btn}>+</button>

      <div style={divider} />

      {/* Edge labels & arrows toggles */}
      <label style={{ display: "flex", gap: 6, alignItems: "center", ...chip }}>
        <input
          type="checkbox"
          checked={showEdgeLabels}
          onChange={(e) => setShowEdgeLabels(e.target.checked)}
        />
        Edge labels
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "center", ...chip }}>
        <input
          type="checkbox"
          checked={showArrows}
          onChange={(e) => setShowArrows(e.target.checked)}
        />
        Arrows
      </label>

      <div style={divider} />

      {/* Node counts */}
      <span style={chip}>
        {counts.n} nodes · {counts.e} rels · {counts.sel} selected
      </span>

      {/* What-if */}
      <div style={divider} />
      <button
        onClick={() => (isWhatIf ? exitWhatIf() : enterWhatIf())}
        style={{
          ...btn,
          background: isWhatIf ? t.okBg : t.ctrlBg,
          color: isWhatIf ? t.okText : t.text,
          border: `1px solid ${isWhatIf ? t.okBg : t.ctrlBr}`,
        }}
      >
        {isWhatIf ? "Exit What-if" : "What-if"}
      </button>
      <button
        onClick={deleteSelection}
        disabled={!isWhatIf}
        title="Delete selected nodes/edges"
        style={{
          ...btn,
          background: isWhatIf ? t.warnBg : t.ctrlBg,
          color: isWhatIf ? t.warnText : t.subtext,
          border: `1px solid ${isWhatIf ? t.warnBg : t.ctrlBr}`,
          opacity: isWhatIf ? 1 : 0.7,
        }}
      >
        Delete selection
      </button>
      <input
        value={scenarioName}
        onChange={(e) => setScenarioName(e.target.value)}
        placeholder="Scenario name"
        disabled={!isWhatIf}
        style={{
          width: 160,
          padding: "6px 8px",
          borderRadius: 8,
          border: `1px solid ${t.ctrlBr}`,
          background: t.ctrlBg,
          color: isWhatIf ? t.text : t.subtext,
          opacity: isWhatIf ? 1 : 0.7,
        }}
      />
      <button
        onClick={saveScenario}
        disabled={!isWhatIf}
        style={{
          ...btn,
          background: isWhatIf ? t.okBg : t.ctrlBg,
          color: isWhatIf ? t.okText : t.subtext,
          border: `1px solid ${isWhatIf ? t.okBg : t.ctrlBr}`,
          opacity: isWhatIf ? 1 : 0.7,
        }}
      >
        Save scenario
      </button>

      {/* Compare */}
      <div style={divider} />
      <select
        value={selectedScenarioId}
        onChange={(e) => setSelectedScenarioId(e.target.value)}
        style={select}
      >
        <option value="">— pick a scenario —</option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {new Date(s.createdAt).toLocaleString()}
          </option>
        ))}
      </select>
      <button
        onClick={() => setIsCompare((v) => !v)}
        disabled={!selectedScenarioId && !isCompare}
        style={{
          ...btn,
          background: isCompare ? t.accent1 : t.ctrlBg,
          opacity: !selectedScenarioId && !isCompare ? 0.7 : 1,
        }}
      >
        {isCompare ? "Close Compare" : "Compare"}
      </button>
      <button
        onClick={() => selectedScenarioId && deleteScenario(selectedScenarioId)}
        disabled={!selectedScenarioId}
        style={{
          ...btn,
          background: selectedScenarioId ? t.warnBg : t.ctrlBg,
          color: selectedScenarioId ? t.warnText : t.subtext,
          border: `1px solid ${selectedScenarioId ? t.warnBg : t.ctrlBr}`,
          opacity: selectedScenarioId ? 1 : 0.7,
        }}
      >
        Delete scenario
      </button>

      {/* Node Tables */}
      <div style={divider} />
      <button
        onClick={() => setShowLeftTable((v) => !v)}
        style={{
          ...btn,
          background: showLeftTable ? t.accent1 : t.ctrlBg,
        }}
      >
        {showLeftTable ? "Hide Left Table" : "Show Left Table"}
      </button>
      <button
        onClick={() => setShowRightTable((v) => !v)}
        disabled={!isCompare}
        style={{
          ...btn,
          background: showRightTable ? t.accent1 : t.ctrlBg,
          opacity: isCompare ? 1 : 0.5,
        }}
      >
        {showRightTable ? "Hide Right Table" : "Show Right Table"}
      </button>

          {/* ===== EXPORTS ===== */}
    {typeof onDownloadCompareJSON === "function" && isCompare && selectedScenarioId && (
      <button
        title="Download Compare JSON"
        onClick={onDownloadCompareJSON}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${t?.ctrlBr || "#374151"}`,
          background: t?.ctrlBg || "#0f1116",
          color: t?.text || "#e5e7eb",
          fontWeight: 700,
          cursor: "pointer",
          height: 32,
          marginLeft: 8,
        }}
      >
        Download JSON
      </button>
    )}

    {typeof onDownloadWhatIfPDF === "function" && (
      <button
        title="Download What-If PDF"
        onClick={onDownloadWhatIfPDF}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${t?.ctrlBr || "#374151"}`,
          background: t?.ctrlBg || "#0f1116",
          color: t?.text || "#e5e7eb",
          fontWeight: 700,
          cursor: "pointer",
          height: 32,
          marginLeft: 8,
        }}
      >
        Download PDF
      </button>
    )}
        {/* ===== EXPORTS (Normal/Left) ===== */}
    {typeof onDownloadLeftJSON === "function" && (
      <button
        title="Download Left Graph JSON"
        onClick={onDownloadLeftJSON}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${t?.ctrlBr || "#374151"}`,
          background: t?.ctrlBg || "#0f1116",
          color: t?.text || "#e5e7eb",
          fontWeight: 700,
          cursor: "pointer",
          height: 32,
          marginLeft: 8,
        }}
      >
        Download JSON
      </button>
    )}

    </div>
  );
}
