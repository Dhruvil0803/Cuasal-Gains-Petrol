// // src/components/GraphBloomClone/LeftPanel.jsx
// import React from "react";
// import StatusBanner from "./StatusBanner";
// import ControlsRow from "./ControlsRow";
// import NodeSelectionPanel from "./NodeSelectionPanel";
// import RelationshipPanel from "./RelationshipPanel";
// import ActiveRulesList from "./ActiveRulesList";
// import CypherRunner from "./CypherRunner";
// import SmartSearch from "./SmartSearch";

// export default function LeftPanel({
//   // status + basics
//   status,
//   limit,
//   setLimit,
//   fit,
//   clearGraph,

//   // nodes (labels) + node rules UI
//   labels,
//   selectedLabel,
//   setSelectedLabel,
//   loadNodesByLabel,

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

//   addRule,
//   applyRules,
//   clearRules,
//   rules,
//   removeRule,

//   // relationships
//   relTypes,
//   selectedRel,
//   setSelectedRel,
//   loadRelationships,
//   rColor,
//   setRColor,

//   // cypher runner
//   userQuery,
//   setUserQuery,
//   clearBeforeQuery,
//   setClearBeforeQuery,
//   runUserQuery,
// }) {
//   return (
//     <div style={{ padding: 20, background: "#15171d", color: "#e5e7eb", overflow: "auto" }}>
//       {/* Status */}
//       {status && <StatusBanner status={status} />}

//       {/* Controls row */}
//       <ControlsRow
//         limit={limit}
//         setLimit={setLimit}
//         fit={fit}
//         clearGraph={clearGraph}
//       />

//       {/* Node selection + rules */}
//       <NodeSelectionPanel
//         labels={labels}
//         selectedLabel={selectedLabel}
//         setSelectedLabel={setSelectedLabel}
//         loadNodesByLabel={loadNodesByLabel}
//         nodeProps={nodeProps}
//         nProp={nProp}
//         setNProp={setNProp}
//         nMode={nMode}
//         setNMode={setNMode}
//         nEqualsVal={nEqualsVal}
//         setNEqualsVal={setNEqualsVal}
//         nRangeMin={nRangeMin}
//         setNRangeMin={setNRangeMin}
//         nRangeMax={nRangeMax}
//         setNRangeMax={setNRangeMax}
//         nColor={nColor}
//         setNColor={setNColor}
//         nSize={nSize}
//         setNSize={setNSize}
//         nTextColor={nTextColor}
//         setNTextColor={setNTextColor}
//         nDistinct={nDistinct}
//         nValueOptions={nValueOptions}
//         addRule={addRule}
//         applyRules={applyRules}
//         clearRules={clearRules}
//         rules={rules}
//       />

//       {/* Relationship panel */}
//       <RelationshipPanel
//         relTypes={relTypes}
//         selectedRel={selectedRel}
//         setSelectedRel={setSelectedRel}
//         loadRelationships={loadRelationships}
//         rColor={rColor}
//         setRColor={setRColor}
//         applyRules={applyRules}
//         clearRules={clearRules}
//         hasRules={rules.length > 0}
//       />

//       {/* Active rules list */}
//       {rules.length > 0 && (
//         <ActiveRulesList rules={rules} removeRule={removeRule} />
//       )}

// {/* 🧠 Smart Search (text → Cypher), shown above the Cypher box */}
// <SmartSearch
//   limit={limit}
//   runUserQuery={runUserQuery}
// />


//       {/* Cypher runner */}
//       <CypherRunner
//         userQuery={userQuery}
//         setUserQuery={setUserQuery}
//         clearBeforeQuery={clearBeforeQuery}
//         setClearBeforeQuery={setClearBeforeQuery}
//         runUserQuery={runUserQuery}
//       />
//     </div>
//   );
// }
// src/components/GraphBloomClone/LeftPanel.jsx
import React from "react";
import StatusBanner from "./StatusBanner";
import ControlsRow from "./ControlsRow";
import NodeSelectionPanel from "./NodeSelectionPanel";
import RelationshipPanel from "./RelationshipPanel";
import ActiveRulesList from "./ActiveRulesList";
import CypherRunner from "./CypherRunner";
import SmartSearch from "./SmartSearch";

function Section({ t, children, style }) {
  return (
    <div
      style={{
        background: t.panelBg,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: 12,
        margin: "12px 12px 0 12px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function LeftPanel({
  // theme
  t,

  // status + basics
  status,
  limit,
  setLimit,
  fit,
  clearGraph,

  // nodes (labels) + node rules UI
  labels,
  selectedLabel,
  setSelectedLabel,
  loadNodesByLabel,

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

  addRule,
  applyRules,
  clearRules,
  rules,
  removeRule,

  // relationships
  relTypes,
  selectedRel,
  setSelectedRel,
  loadRelationships,
  rColor,
  setRColor,

  // cypher runner
  userQuery,
  setUserQuery,
  clearBeforeQuery,
  setClearBeforeQuery,
  runUserQuery,

  captionByLabel,     // NEW
  setCaptionPref,     // NEW
}) {
  return (
    <div
      style={{
        // sidebar shell
        background: t.cardBg,
        color: t.text,
        borderRight: `1px solid ${t.border}`,
        height: "100%",
        overflow: "auto",
        paddingBottom: 16,
      }}
    >
      {/* Status */}
      {status && (
        <div style={{ padding: "12px 12px 0 12px" }}>
          <StatusBanner status={status} />
        </div>
      )}

      {/* Controls row */}
      <Section t={t}>
        <ControlsRow
          t={t}
          limit={limit}
          setLimit={setLimit}
          fit={fit}
          clearGraph={clearGraph}
        />
      </Section>

      {/* Node selection + rules */}
      <Section t={t}>
        <NodeSelectionPanel
          t={t}
          labels={labels}
          selectedLabel={selectedLabel}
          setSelectedLabel={setSelectedLabel}
          loadNodesByLabel={loadNodesByLabel}
          nodeProps={nodeProps}
          nProp={nProp}
          setNProp={setNProp}
          nMode={nMode}
          setNMode={setNMode}
          nEqualsVal={nEqualsVal}
          setNEqualsVal={setNEqualsVal}
          nRangeMin={nRangeMin}
          setNRangeMin={setNRangeMin}
          nRangeMax={nRangeMax}
          setNRangeMax={setNRangeMax}
          nColor={nColor}
          setNColor={setNColor}
          nSize={nSize}
          setNSize={setNSize}
          nTextColor={nTextColor}
          setNTextColor={setNTextColor}
          nDistinct={nDistinct}
          nValueOptions={nValueOptions}
          addRule={addRule}
          applyRules={applyRules}
          clearRules={clearRules}
          rules={rules}
          captionByLabel={captionByLabel}
          setCaptionPref={setCaptionPref}
        />
      </Section>

      {/* Relationship panel */}
      <Section t={t}>
        <RelationshipPanel
          t={t}
          relTypes={relTypes}
          selectedRel={selectedRel}
          setSelectedRel={setSelectedRel}
          loadRelationships={loadRelationships}
          rColor={rColor}
          setRColor={setRColor}
          applyRules={applyRules}
          clearRules={clearRules}
          hasRules={rules.length > 0}
        />
      </Section>

      {/* Active rules list */}
      {rules.length > 0 && (
        <Section t={t}>
          <ActiveRulesList t={t} rules={rules} removeRule={removeRule} />
        </Section>
      )}

      {/* Smart Search (text → Cypher) */}
      <Section t={t}>
        <SmartSearch t={t} limit={limit} runUserQuery={runUserQuery} />
      </Section>

      {/* Cypher runner */}
      <Section t={t} style={{ marginBottom: 12 }}>
        <CypherRunner
          t={t}
          userQuery={userQuery}
          setUserQuery={setUserQuery}
          clearBeforeQuery={clearBeforeQuery}
          setClearBeforeQuery={setClearBeforeQuery}
          runUserQuery={runUserQuery}
        />
      </Section>
    </div>
  );
}
