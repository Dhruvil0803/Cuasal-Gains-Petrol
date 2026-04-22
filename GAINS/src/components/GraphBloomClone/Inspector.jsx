// import React from "react";
// import InspectorHeader from "./InspectorHeader";
// import HudPanel from "./HudPanel";
// import InspectorTabs from "./InspectorTabs";
// import NodeDetailsTable from "./NodeDetailsTable";
// import GraphActions from "./GraphActions";
// import RuleStyler from "./RuleStyler";

// export default function Inspector({
//   t,                     // THEME TOKENS (appBg, panelBg, cardBg, border, text, subtext, ctrlBg, ctrlBr)
//   nodeDetails,
//   setNodeDetails,
//   cy,
//   fetchMinMax,

//   // HUD state
//   hudCat,
//   setHudCat,
//   hudProps,
//   hudCaption,
//   setHudCaption,

//   // Tabs
//   inspectorTab,
//   setInspectorTab,

//   // HUD actions
//   openHudForCategory,
//   setQuickStyleForCategory,
//   setCaptionForCategorySingle,

//   // Graph actions
//   expandKHops,
//   fit,
// }) 

// // === Expand-from chooser (list all visible nodes on this canvas) ===
// const [expandFromId, setExpandFromId] = React.useState(nodeDetails?.id || "");

// React.useEffect(() => {
//   // when user clicks a node in the canvas, default the chooser to that node
//   setExpandFromId(nodeDetails?.id || "");
// }, [nodeDetails?.id]);

// const visibleNodeOptions = React.useMemo(() => {
//   if (!cy) return [];
//   // list every visible node on the current canvas, label flattened to one line
//   return cy
//     .nodes()
//     .toArray()
//     .map((n) => ({
//       id: n.id(),
//       text: String(n.data("label") || n.id()).replace(/\n/g, " "),
//     }));
// }, [cy, nodeDetails?.id]);

// {
//   const anchorNode = React.useMemo(
//     () => (cy && nodeDetails?.id != null ? cy.$id(String(nodeDetails.id)) : null),
//     [cy, nodeDetails?.id]
//   );

//   if (!nodeDetails) return null;

//   const frame = {
//     background: t.panelBg,
//     border: `1px solid ${t.border}`,
//     borderRadius: 14,
//     boxShadow: "0 12px 30px rgba(0,0,0,.18)",
//     color: t.text,
//   };

//   const topBar = {
//     display: "flex",
//     gap: 8,
//     alignItems: "center",
//     padding: "10px 12px",
//     borderBottom: `1px solid ${t.border}`,
//     background: t.cardBg,
//   };

//   const btn = {
//     padding: "6px 10px",
//     borderRadius: 8,
//     border: `1px solid ${t.ctrlBr}`,
//     background: t.ctrlBg,
//     color: t.text,
//     fontWeight: 700,
//     cursor: "pointer",
//   };

//   const section = { padding: "12px 16px" };
//   const muted = { color: t.subtext, fontSize: 14 };

//   return (
//     <div style={frame}>
//       {/* Header with elementId + label chips */}
//       <InspectorHeader
//         t={t}
//         nodeDetails={nodeDetails}
//         hudCat={hudCat}
//         setHudCat={setHudCat}
//         openHudForCategory={openHudForCategory}
//       />

//       {/* HUD quick styling for active label */}
//       {hudCat && (
//         <HudPanel
//           t={t}
//           hudCat={hudCat}
//           hudProps={hudProps}
//           hudCaption={hudCaption}
//           setHudCat={setHudCat}
//           setHudCaption={setHudCaption}
//           setQuickStyleForCategory={setQuickStyleForCategory}
//           setCaptionForCategorySingle={setCaptionForCategorySingle}
//         />
//       )}

//       {/* Tabs + Close */}
//       <div style={topBar}>
//         <InspectorTabs t={t} inspectorTab={inspectorTab} setInspectorTab={setInspectorTab} />
//         <div style={{ flex: 1 }} />
//         <button onClick={() => setNodeDetails(null)} style={btn}>
//           Close
//         </button>
//       </div>

//       {/* Tab content */}
//       {inspectorTab === "details" && (
//         <div style={section}>
//           {nodeDetails.labels?.[0] === "Loading…" ? (
//             <div style={muted}>Fetching…</div>
//           ) : Object.keys(nodeDetails.props || {}).length === 0 ? (
//             <div style={muted}>No properties on this node.</div>
//           ) : (
//             <NodeDetailsTable t={t} propsObj={nodeDetails.props} />
//           )}
//         </div>
//       )}

//       {inspectorTab === "graph" && (
//         <div style={section}>
//           <GraphActions t={t} nodeId={nodeDetails.id} expandKHops={expandKHops} fit={fit} />
//         </div>
//       )}

//       {inspectorTab === "style" && (
//         <div style={section}>
//           <RuleStyler t={t} cy={cy} anchorNode={anchorNode} nodeDetails={nodeDetails} fetchMinMax={fetchMinMax} />
//         </div>
//       )}
//     </div>
//   );
// }
import React from "react";
import InspectorHeader from "./InspectorHeader";
import HudPanel from "./HudPanel";
import InspectorTabs from "./InspectorTabs";
import NodeDetailsTable from "./NodeDetailsTable";
import GraphActions from "./GraphActions";
import RuleStyler from "./RuleStyler";

function NodePropsOfSelected({ cy, t, nodeId }) {
  const allProps = React.useMemo(() => {
    if (!cy || !nodeId) return [];
    const el = cy.$id(String(nodeId));
    if (!el || !el.length) return [];
    const data = el.data() || {};
    // read every p__* property (all types, not numeric-only)
    const keys = Object.keys(data)
      .filter((k) => k.startsWith("p__"))
      .map((k) => k.slice(3))
      .sort();
    return keys;
  }, [cy, nodeId]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontWeight: 600, minWidth: 70 }}>Properties</div>
      <select
        disabled={allProps.length === 0}
        style={{
          flex: 1,
          padding: "8px 10px",
          background: t.ctrlBg,
          color: t.text,
          border: `1px solid ${t.ctrlBr}`,
          borderRadius: 10,
          fontWeight: 600,
          opacity: allProps.length ? 1 : 0.6,
        }}
        title={allProps.length ? "All properties of the selected node" : "No properties on this node"}
        onChange={() => {}}
      >
        {allProps.length === 0 ? (
          <option>(no properties)</option>
        ) : (
          <>
            <option>— {allProps.length} propert{allProps.length === 1 ? "y" : "ies"} —</option>
            {allProps.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}

export default function Inspector({
  t, // THEME TOKENS (appBg, panelBg, cardBg, border, text, subtext, ctrlBg, ctrlBr)
  nodeDetails,
  setNodeDetails,
  cy,
  fetchMinMax,

  // HUD state
  hudCat,
  setHudCat,
  hudProps,
  hudCaption,
  setHudCaption,

  // Tabs
  inspectorTab,
  setInspectorTab,

  // HUD actions
  openHudForCategory,
  setQuickStyleForCategory,
  setCaptionForCategorySingle,

  // Graph actions
  expandKHops,
  fit,

  // Compare / editing plumbing
  isCompare = false,
  inspectorPane = "left",
  selectedScenarioId = "",
  onSaveNodeProps = null,
  onSaveNodePropsLeft = null,

  // Rule target + node dropdown state (from GraphBloomClone.jsx)
  nTarget,          // 'property' | 'node'
  setNTarget,
  hudNodes,         // [{id, caption}]
  nNodeId,
  setNNodeId,

  // Compare (node & style options)
  canvasNodeOptions,
  cmpNodeA, setCmpNodeA,
  cmpNodeB, setCmpNodeB,
  cmpPropA, setCmpPropA,
  cmpPropB, setCmpPropB,
  cmpPropsA, cmpPropsB,
  cmpGreaterColor, setCmpGreaterColor,
  cmpLesserColor,  setCmpLesserColor,
  cmpEqualColor,   setCmpEqualColor,
  cmpGreaterSize,  setCmpGreaterSize,
  cmpLesserSize,   setCmpLesserSize,
  onApplyTwoNodeCompare,

    // gradient props from parent
  nMode, setNMode,
  nRangeMin, setNRangeMin,
  nRangeMax, setNRangeMax,
  nColorMin, setNColorMin,
  nColorMax, setNColorMax,
  nSizeMin,  setNSizeMin,
  nSizeMax,  setNSizeMax,
  nUseColorGrad, setNUseColorGrad,
  nUseSizeGrad,  setNUseSizeGrad,

}) {
  // Keep anchor for RuleStyler
  const anchorNode = React.useMemo(
    () => (cy && nodeDetails?.id != null ? cy.$id(String(nodeDetails.id)) : null),
    [cy, nodeDetails?.id]
  );

  if (!nodeDetails) return null;

  // === Expand-from chooser (list all visible nodes on this canvas) ===
  const [expandFromId, setExpandFromId] = React.useState(nodeDetails?.id || "");

  React.useEffect(() => {
    // when user clicks a node in the canvas, default the chooser to that node
    setExpandFromId(nodeDetails?.id || "");
  }, [nodeDetails?.id]);

  const visibleNodeOptions = React.useMemo(() => {
    if (!cy) return [];
    // list every visible node on the current canvas, label flattened to one line
    return cy
      .nodes()
      .toArray()
      .map((n) => ({
        id: n.id(),
        text: String(n.data("label") || n.id()).replace(/\n/g, " "),
      }));
  }, [cy, nodeDetails?.id]);

  // ---- styles ----
  const frame = {
    background: t.panelBg,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    boxShadow: "0 12px 30px rgba(0,0,0,.18)",
    color: t.text,
  };

  const topBar = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: `1px solid ${t.border}`,
    background: t.cardBg,
  };

  const btn = {
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${t.ctrlBr}`,
    background: t.ctrlBg,
    color: t.text,
    fontWeight: 700,
    cursor: "pointer",
  };

  const section = { padding: "12px 16px" };
  const muted = { color: t.subtext, fontSize: 14 };

  // allow editing only in compare-right with a selected scenario + save handler
  // Right/compare edit (existing behavior)
  const editableRight =
    isCompare &&
    inspectorPane === "right" &&
    !!selectedScenarioId &&
    typeof onSaveNodeProps === "function";

  // Left/normal edit (new behavior)
  const editableLeft =
    !isCompare &&
    inspectorPane === "left" &&
    typeof onSaveNodePropsLeft === "function";

  const editable = editableRight || editableLeft;

  // GraphActions will use this chosen node (fallback to first visible)
  const chosenExpandId =
    expandFromId || (visibleNodeOptions.length ? visibleNodeOptions[0].id : nodeDetails.id);

  React.useEffect(() => {
    if (inspectorTab === "style" && !hudCat && nodeDetails?.labels?.length) {
      // Auto-pick a category so RuleStyler can populate the Node dropdown
      openHudForCategory(nodeDetails.labels[0]);
    }
  }, [inspectorTab, hudCat, nodeDetails?.labels, openHudForCategory]);

  return (
    <div style={frame}>
      {/* Header with elementId + label chips */}
      <InspectorHeader
        t={t}
        nodeDetails={nodeDetails}
        hudCat={hudCat}
        setHudCat={setHudCat}
        openHudForCategory={openHudForCategory}
      />

      {/* HUD quick styling for active label */}
      {hudCat && (
        <HudPanel
          t={t}
          hudCat={hudCat}
          hudProps={hudProps}
          hudCaption={hudCaption}
          setHudCat={setHudCat}
          setHudCaption={setHudCaption}
          setQuickStyleForCategory={setQuickStyleForCategory}
          setCaptionForCategorySingle={setCaptionForCategorySingle}
        />
      )}

      {/* Tabs + Close */}
      <div style={topBar}>
        <InspectorTabs t={t} inspectorTab={inspectorTab} setInspectorTab={setInspectorTab} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setNodeDetails(null)} style={btn}>
          Close
        </button>
      </div>

      {/* Tab content */}
      {inspectorTab === "details" && (
        <div style={section}>
          {nodeDetails.labels?.[0] === "Loading…" ? (
            <div style={muted}>Fetching…</div>
          ) : Object.keys(nodeDetails.props || {}).length === 0 ? (
            <div style={muted}>No properties on this node.</div>
          ) : (
            <NodeDetailsTable
              t={t}
              propsObj={nodeDetails.props}
              editable={editable}
              onSave={async (newProps) => {
                if (editableRight) {
                  await onSaveNodeProps(nodeDetails.id, newProps);        // compare/right → scenario storage
                } else if (editableLeft) {
                  await onSaveNodePropsLeft(nodeDetails.id, newProps);     // left/normal → localStorage working copy
                }
                setNodeDetails((prev) => ({ ...(prev || {}), props: newProps }));
              }}
            />
          )}
        </div>
      )}

      {inspectorTab === "graph" && (
        <div style={section}>
          {/* Expand-from chooser */}
          {cy && visibleNodeOptions.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <label
                style={{ fontWeight: 600, fontSize: 13, opacity: 0.9, whiteSpace: "nowrap" }}
              >
                Expand from:
              </label>
              <select
  value={chosenExpandId}
  onChange={(e) => setExpandFromId(e.target.value)}
  onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  style={{
    flex: 1,
    padding: "6px 8px",
    background: t.ctrlBg,
    color: t.text,
    border: `1px solid ${t.ctrlBr}`,
    borderRadius: 8,
  }}
>

                {visibleNodeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.text} ({opt.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Graph actions now use the chosen node */}
          <GraphActions t={t} nodeId={chosenExpandId} expandKHops={expandKHops} fit={fit} />
        </div>
      )}

      {inspectorTab === "style" && (
        <div style={section}>
          {/* ===== Rule Target (Property vs Node) ===== */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
            <div style={{ fontWeight: 600, minWidth: 70 }}>Target</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="ruleTarget"
                value="property"
                checked={nTarget === "property"}
                onChange={() => setNTarget("property")}
              />
              <span>Property</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="ruleTarget"
                value="node"
                checked={nTarget === "node"}
                onChange={() => setNTarget("node")}
              />
              <span>Node</span>
            </label>
          </div>

          {/* ===== Node picker (visible only when Target=Node) ===== */}
{nTarget === "node" && (
  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
    <div style={{ fontWeight: 600, minWidth: 70 }}>Node</div>
    <select
  value={nNodeId || ""}
  onChange={(e) => setNNodeId(e.target.value)}
  onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  style={{
    flex: 1,
    padding: "8px 10px",
    background: t.ctrlBg,
    color: t.text,
    border: `1px solid ${t.ctrlBr}`,
    borderRadius: 10,
    fontWeight: 600,
  }}
  title="Pick any node currently on the canvas"
>

      <option value="" disabled>— Select node —</option>
      {(canvasNodeOptions || []).map((n) => (
        <option key={n.id} value={n.id}>
          {n.caption || n.id} ({n.id})
        </option>
      ))}
    </select>
  </div>
)}

{/* All properties of the selected node */}
{nTarget === "node" && nNodeId && (
  <NodePropsOfSelected
    cy={cy}
    t={t}
    nodeId={nNodeId}
  />
)}


          {/* ===== Two-node compare: pick nodes and their numeric props ===== */}
          {/* ===== Two-node compare: friendlier dropdowns (search + preview) ===== */}
{Array.isArray(canvasNodeOptions) && canvasNodeOptions.length > 0 && (
  <div style={{ marginTop: 12, padding: 10, border: `1px solid ${t.border}`, borderRadius: 10, background: t.cardBg }}>
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Compare two nodes</div>

    {/* Reusable mini select with search */}
    {(() => {
      const SelectWithSearch = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  getLabel = (o) => o.label || o.caption || String(o),
  getValue = (o) => o.value || o.id || String(o),
  style = {}
}) => {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const rootRef = React.useRef(null);

 const filtered = React.useMemo(() => {
  const list = options || [];
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((o) => (getLabel(o) || "").toLowerCase().includes(s));
}, [q, options]);


  React.useEffect(() => {
    setHi((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // close when clicking outside
React.useEffect(() => {
  if (!open) return;

  const isInside = (evt) => {
    const el = rootRef.current;
    if (!el) return false;
    // Robust across Shadow DOM / portals
    const path = typeof evt.composedPath === "function" ? evt.composedPath() : [];
    return path.length ? path.includes(el) : el.contains(evt.target);
  };

  const onDocDown = (e) => { if (!isInside(e)) setOpen(false); };

  document.addEventListener("pointerdown", onDocDown, true);
  // Fallbacks for older browsers (optional but safe)
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("touchstart", onDocDown, true);

  return () => {
    document.removeEventListener("pointerdown", onDocDown, true);
    document.removeEventListener("mousedown", onDocDown, true);
    document.removeEventListener("touchstart", onDocDown, true);
  };
}, [open]);


  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter")     {
      e.preventDefault();
      const sel = filtered[hi];
      if (sel) {
        onChange(String(getValue(sel)));
        setOpen(false);
      }
    }
    if (e.key === "Escape") setOpen(false);
  };

  const display = (() => {
    const found = options.find((o) => String(getValue(o)) === String(value));
    return found ? getLabel(found) : "";
  })();

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      {/* toggle */}
    <div
  role="button"
  tabIndex={0}
  aria-haspopup="listbox"
  aria-expanded={open ? "true" : "false"}
  onMouseDown={(e) => {
    // fire earlier than onClick so nothing else can swallow it
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }}
  onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 10px", background: t.ctrlBg, color: t.text,
    border: `1px solid ${t.ctrlBr}`, borderRadius: 10, cursor: "pointer",
    minHeight: 38, fontWeight: 600, userSelect: "none"
  }}
>
  <span style={{ opacity: display ? 1 : 0.6 }}>
    {display || label}
  </span>
  <span style={{ opacity: 0.7 }}>▾</span>
</div>
      {/* menu */}
     {open && (
  <div
    onKeyDown={onKeyDown}
    style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
      background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: 10,
      boxShadow: "0 14px 30px rgba(0,0,0,.25)", zIndex: 999999, overflow: "hidden",
      pointerEvents: "auto"
    }}
    onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
    onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
    onWheelCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  >

          <input
  autoFocus
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder={placeholder}
  onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  onWheelCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  style={{
    width: "100%", padding: "8px 10px", outline: "none",
    background: t.cardBg, color: t.text, border: "none",
    borderBottom: `1px solid ${t.border}`
  }}
/>

          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: 10, color: t.subtext, fontSize: 12 }}>No matches</div>
            )}
            {filtered.map((o, i) => {
              const v = String(getValue(o));
              const isActive = String(value) === v;
              const isHi = i === hi;
              return (
                <div
                  key={v}
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    // use mousedown so it fires before blur/collapse,
                    // and stop propagation to avoid toggle re-trigger
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(v);
                    setOpen(false);
                  }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onMouseEnter={() => setHi(i)}
                  style={{
                    padding: "8px 10px",
                    background: isHi ? t.cardBg : "transparent",
                    color: t.text,
                    fontWeight: isActive ? 700 : 500,
                    borderBottom: `1px solid ${t.border}`,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    userSelect: "none"
                  }}
                  title={getLabel(o)}
                >
                  {isActive ? "●" : "○"}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getLabel(o)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

      const FieldRow = ({ side }) => {
        const isA = side === "A";
        const nodeVal = isA ? (cmpNodeA || "") : (cmpNodeB || "");
        const propVal = isA ? (cmpPropA || "") : (cmpPropB || "");
        const nodeSet = isA ? setCmpNodeA : setCmpNodeB;
        const propSet = isA ? setCmpPropA : setCmpPropB;
        const propsList = isA ? (cmpPropsA || []) : (cmpPropsB || []);

        const propDisplay = React.useMemo(() => {
          const found = propsList.find(p => p.key === propVal);
          if (!found) return null;
          const v = found.value;
          const text = typeof v === "object" ? JSON.stringify(v) : String(v);
          return text;
        }, [propsList, propVal]);

        return (
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(74px,90px) 1fr minmax(160px, 1.1fr)",
            gap: 10,
            alignItems: "center",
            marginBottom: 10
          }}>
            <div style={{ fontWeight: 700 }}>{`Node ${side}`}</div>

            <SelectWithSearch
              label="Pick node…"
              value={nodeVal}
              onChange={(v) => { nodeSet(v); }}
              options={canvasNodeOptions}
              getLabel={(o) => `${o.caption} (${o.id})`}
              getValue={(o) => o.id}
            />

            <SelectWithSearch
              label={nodeVal ? "Pick property…" : "Pick a node first"}
              value={propVal}
              onChange={(v) => propSet(v)}
              options={nodeVal ? propsList.map(p => ({ label: p.key, value: p.key })) : []}
              getLabel={(o) => o.label}
              getValue={(o) => o.value}
              placeholder="Search properties…"
              style={{ opacity: nodeVal ? 1 : 0.6, pointerEvents: nodeVal ? "auto" : "none" }}
            />

            {/* inline value preview */}
            <div style={{ gridColumn: "2 / span 2", fontSize: 12, opacity: 0.8 }}>
              {propVal && (
                <div style={{
                  marginTop: 4, padding: "6px 8px",
                  background: t.panelBg, border: `1px solid ${t.border}`,
                  borderRadius: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  <b>{propVal}</b>: <span title={propDisplay || ""}>{propDisplay ?? "—"}</span>
                </div>
              )}
            </div>
          </div>
        );
      };

      return (
        <>
          <FieldRow side="A" />
          <FieldRow side="B" />

          {/* Action */}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={onApplyTwoNodeCompare}
              disabled={!cmpNodeA || !cmpNodeB || !cmpPropA || !cmpPropB}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${t.ctrlBr}`,
                background: (!cmpNodeA || !cmpNodeB || !cmpPropA || !cmpPropB) ? t.cardBg : t.panelBg,
                color: t.text,
                fontWeight: 800,
                cursor: (!cmpNodeA || !cmpNodeB || !cmpPropA || !cmpPropB) ? "not-allowed" : "pointer",
                flex: "0 0 auto"
              }}
              title={!cmpNodeA || !cmpNodeB ? "Pick both nodes" : (!cmpPropA || !cmpPropB ? "Pick both properties" : "Apply")}
            >
              Compare & Style
            </button>
            <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.75 }}>
              Choose Node A/B and any property; quick search supported.
            </div>
          </div>
        </>
      );
    })()}
  </div>
)}

          {/* RuleStyler (property-based rules etc.) */}
          <RuleStyler
            t={t}
            cy={cy}
            anchorNode={anchorNode}
            nodeDetails={nodeDetails}
            fetchMinMax={fetchMinMax}
            nTarget={nTarget}
            hudNodes={hudNodes}
            nNodeId={nNodeId}
            nMode={nMode} setNMode={setNMode}
  nRangeMin={nRangeMin} setNRangeMin={setNRangeMin}
  nRangeMax={nRangeMax} setNRangeMax={setNRangeMax}
  nColorMin={nColorMin} setNColorMin={setNColorMin}
  nColorMax={nColorMax} setNColorMax={setNColorMax}
  nSizeMin={nSizeMin}   setNSizeMin={setNSizeMin}
  nSizeMax={nSizeMax}   setNSizeMax={setNSizeMax}
  nUseColorGrad={nUseColorGrad} setNUseColorGrad={setNUseColorGrad}
  nUseSizeGrad={nUseSizeGrad}   setNUseSizeGrad={setNUseSizeGrad}
          />

          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            Use <b>Apply</b> or <b>Add Rule</b> in the left panel to preview or save this rule.
          </div>
        </div>
      )}
    </div>
  );
}
