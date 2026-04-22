// src/components/DropdownFormUI/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ui.css";
import ImportInline from "./UI/ImportInline.jsx";
import ImportPlanner from "./ImportPlanner/ImportPlanner.jsx";
import useGraphSchema from "./useGraphSchema";
import useLocalGraph from "./useLocalGraph";

import { safeIdent, displayFromProps } from "./utils";

import ErrorBoundary from "./ErrorBoundary";
import Card from "./UI/Card";
import Tabs from "./UI/Tabs";
import Button from "./UI/Button";
import Select from "./UI/Select";
import Sidebar, { SideBlock } from "./UI/Sidebar";
import Notice from "./UI/Notice";
import Alert from "./UI/Alert";

import NodeForm from "./views/NodeForm";
import RelationshipForm from "./views/RelationshipForm";
import AddLabelForm from "./views/AddLabelForm";
import AddRelTypeForm from "./views/AddRelTypeForm";

/**
 * Public component: Drop-in replacement for the original DropdownFormUI
 * Keeps logic intact: READ-ONLY Neo4j, local-only schema/data CRUD, no DB writes.
 */
export default function DropdownFormUI() {
  // ===== Load DB schema (read-only) =====
  const {
    loading,
    connectError,
    dbSchemaNodes,           // [{ id, title, fields:[{name,label,type,required:true}] }]
    dbRelTypePairs,          // Map<relType, Array<{src,dst}>>
    dbRelTypes,              // string[]
    uniqueKeysByLabel,       // Map<label, Set<prop>>
    fetchDbInstancesForLabel // (label, limit) -> [{id, props}]
  } = useGraphSchema();

  // ===== Local-only schema + data =====
  const {
    localNodeTypes, setLocalNodeTypes,
    localRelTypes,  setLocalRelTypes,
    localNodes,     setLocalNodes,
    localRels,      setLocalRels,
    dataBump,

    relTypePropsMap,

    findDuplicateNode,
    createLocalNode,
    updateLocalNodeById,
    createLocalRelationship,

    exportLocal,
    importFromFileInput,
    clearLocal,
  } = useLocalGraph();

  // ===== Merge DB schema with local node types =====
  const effectiveSchemaNodes = useMemo(() => {
    const map = new Map();
    // DB schema (read-only)
    for (const n of dbSchemaNodes) {
      map.set(n.id, { id: n.id, title: n.title, fields: [...n.fields] });
    }
    // Merge local-only labels/properties
    for (const t of localNodeTypes) {
      const label = t.label;
      if (!label) continue;
      const existing = map.get(label) || { id: label, title: label, fields: [] };
      const fieldNames = new Set(existing.fields.map((f) => f.name));
      for (const p of (t.properties || [])) {
        if (!fieldNames.has(p.name)) {
          const ft =
            p.type === "number"  ? "number"  :
            p.type === "boolean" ? "checkbox":
            p.type === "date"    ? "date"    : "text";
          existing.fields.push({ name: p.name, label: p.name, type: ft, required: true });
        }
      }
      map.set(label, existing);
    }
    const list = [...map.values()].map(n => ({
      ...n,
      fields: [...n.fields].sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [dbSchemaNodes, localNodeTypes]);

  // Add this (TOP-LEVEL, not inside JSX)
  const labelOptions = useMemo(
    () => effectiveSchemaNodes.map(n => n.id).sort(),
    [effectiveSchemaNodes]
    );

  // ===== Merge relationship pairs (DB + Local) =====
  const effectiveRelTypePairs = useMemo(() => {
    const m = new Map();
    // DB pairs
    for (const [rtype, pairs] of dbRelTypePairs.entries()) m.set(rtype, [...pairs]);
    // Local pairs
    for (const rt of localRelTypes) {
      const t = safeIdent(rt.type || "");
      const src = safeIdent(rt.srcLabel || "");
      const dst = safeIdent(rt.dstLabel || "");
      if (!t || !src || !dst) continue;
      const list = m.get(t) || [];
      if (!list.some((p) => p.src === src && p.dst === dst)) list.push({ src, dst });
      m.set(t, list);
    }
    for (const [k, v] of m.entries()) {
      m.set(k, [...v].sort((a, b) => (a.src + a.dst).localeCompare(b.src + b.dst)));
    }
    return m;
  }, [dbRelTypePairs, localRelTypes]);

  const effectiveRelTypes = useMemo(
    () => Array.from(effectiveRelTypePairs.keys()).sort(),
    [effectiveRelTypePairs]
  );

  // ===== UI State: active view =====
  const VIEW = {
    NODE: "NODE",
    REL: "REL",
    ADD_LABEL: "ADD_LABEL",
    ADD_RELT: "ADD_RELT",
    IMPORT: "IMPORT", 
    NONE: "NONE",
  };

  const [selectedNode, setSelectedNode] = useState("");
  const [selectedRelType, setSelectedRelType] = useState("");
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showAddRelType, setShowAddRelType] = useState(false);

  const activeView = useMemo(() => {
    if (showAddLabel) return VIEW.ADD_LABEL;
    if (showAddRelType) return VIEW.ADD_RELT;
    if (selectedNode) return VIEW.NODE;
    if (selectedRelType) return VIEW.REL;
    return VIEW.NONE;
  }, [showAddLabel, showAddRelType, selectedNode, selectedRelType]);

  const setActiveView = (v) => {
    if (v === VIEW.ADD_LABEL) {
      setShowAddLabel(true); setShowAddRelType(false); setSelectedNode(""); setSelectedRelType("");
      setAddMsg({kind:"",text:""});
    } else if (v === VIEW.ADD_RELT) {
      setShowAddRelType(true); setShowAddLabel(false); setSelectedNode(""); setSelectedRelType("");
      setRtMsg({kind:"",text:""});
    } else if (v === VIEW.NODE) {
      setShowAddLabel(false); setShowAddRelType(false); setSelectedRelType("");
    } else if (v === VIEW.REL) {
      setShowAddLabel(false); setShowAddRelType(false); setSelectedNode("");
    }else if (v === VIEW.IMPORT) {
  setShowAddLabel(false);
  setShowAddRelType(false);
  setSelectedNode("");
  setSelectedRelType("");
    } 
    else {
      setShowAddLabel(false); setShowAddRelType(false); setSelectedNode(""); setSelectedRelType("");
    }
  };

  // ===== Current selections =====
  const currentNode = useMemo(
    () => effectiveSchemaNodes.find((n) => n.id === selectedNode) || null,
    [effectiveSchemaNodes, selectedNode]
  );
  const currentUniqueKeys = useMemo(
    () => (selectedNode ? (uniqueKeysByLabel.get(selectedNode) || new Set()) : new Set()),
    [selectedNode, uniqueKeysByLabel]
  );

  // ===== Messages for Add forms =====
  const [addMsg, setAddMsg] = useState({ kind: "", text: "" });
  const [rtMsg,  setRtMsg]  = useState({ kind: "", text: "" });

  // ===== Hidden file input for import =====
  const fileInputRef = useRef(null);

  // ===== Loader / error states =====
  if (loading) {
    return (
      <div className="loader-screen">
        <div className="loader-box">
          <div className="spinner" />
          <div className="loader-text">Loading…</div>
        </div>
      </div>
    );
  }

  if (!effectiveSchemaNodes.length && connectError) {
    return (
      <div className="loader-screen">
        <div className="loader-box">
          <div className="alert">Neo4j load failed (read-only): {connectError}</div>
        </div>
      </div>
    );
  }
  const handleImportLocalData = (json) => {
  try {
    if (json?.nodeTypes) setLocalNodeTypes(json.nodeTypes);
    if (json?.relTypes)  setLocalRelTypes(json.relTypes);
    if (json?.nodes)     setLocalNodes(json.nodes);
    if (json?.rels)      setLocalRels(json.rels);
  } catch (e) {
    console.error("Import failed:", e);
    alert("Import failed. Make sure you selected a valid export JSON.");
  }
};

  // ===== Render =====
  const tabs = (
  <>
    <Tabs
      items={[
        { key: VIEW.NODE,      label: "Node Data" },
        { key: VIEW.REL,       label: "Relationship" },
        { key: VIEW.ADD_LABEL, label: "Add Node Label" },
        { key: VIEW.ADD_RELT,  label: "Add Relationship Type" },
      ]}
      active={activeView}
      onChange={setActiveView}
    />
    {/* CSV/XLSX import next to the tabs */}
    <ImportPlanner
      onPlanReady={(plan) => {
        // purely preview; no DB writes
        console.log("Import plan (tabs area):", plan);
      }}
    />
  </>
);

  const footer = (
    <>
      <div>
        {activeView === VIEW.NODE && (
          <span className="help">Fill all fields (including checkboxes) to enable saving.</span>
        )}
        {activeView === VIEW.REL && (
          <span className="help">Pick both nodes to connect. Properties are optional.</span>
        )}
      </div>
     {/* <div className="footer-tools">
  <span className="hint">Local data:</span>
  <Button variant="ghost" onClick={exportLocal}>Export</Button>
  <Button variant="ghost" onClick={clearLocal}>Clear</Button>
</div> */}
    </>
  );

  const cardTitle =
    activeView === VIEW.NODE
      ? (currentNode ? `${currentNode.title} (Local Data)` : "Node Data")
      : activeView === VIEW.REL
        ? (selectedRelType ? `Relationship: ${selectedRelType} (Local Only)` : "Relationship")
        : activeView === VIEW.ADD_LABEL
          ? "Add Node Label (Local Schema Only)"
          : activeView === VIEW.ADD_RELT
            ? "Add Relationship Type (Local Schema Only)"
            : "Choose an Action";

    // Centralized Import handler used by header + sidebar Import buttons.
// Adjust the keys below if your export JSON uses different property names.


  return (
    <div className="app">
      {/* Sidebar */}
      <Sidebar>
        <SideBlock title="Node Selection">
          <Select
            value={selectedNode}
            onChange={(e) => { setSelectedNode(e.target.value); setActiveView(VIEW.NODE); }}
            disabled={!effectiveSchemaNodes.length}
          >
            <option value="">Select a node…</option>
            {effectiveSchemaNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </Select>
        </SideBlock>

        <SideBlock title="Relationship Type">
          <Select
            value={selectedRelType}
            onChange={(e) => { setSelectedRelType(e.target.value); setActiveView(VIEW.REL); }}
            disabled={!effectiveRelTypes.length}
          >
            <option value="">Select a relationship…</option>
            {effectiveRelTypes.map((rt) => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </Select>
        </SideBlock>

        <SideBlock title="Add Node Label">
          <Button variant="ghost" onClick={() => setActiveView(VIEW.ADD_LABEL)} style={{ width: "100%" }}>
            Open
          </Button>
        </SideBlock>

        <SideBlock title="Add Relationship Type">
          <Button variant="ghost" onClick={() => setActiveView(VIEW.ADD_RELT)} style={{ width: "100%" }}>
            Open
          </Button>
        </SideBlock>

        <SideBlock title="Import (CSV / Excel)">
  <Button
    variant="ghost"
    onClick={() => setActiveView(VIEW.IMPORT)}
    style={{ width: "100%" }}
  >
    Open Import Planner
  </Button>
</SideBlock>
<SideBlock title="Import (.csv / .xlsx)">
  <ImportPlanner
    onPlanReady={(plan) => {
      console.log("Import plan (sidebar):", plan);
    }}
  />
</SideBlock>


        {/* Import (vertical) placed under Add Relationship Type */}
<ImportInline onImport={handleImportLocalData} layout="vertical" />

      </Sidebar>

      {/* Main content */}
      <main className="content">
        <ErrorBoundary>
          <Card title={cardTitle} tabs={tabs} footer={footer}>
            {/* Views */}
            {activeView === VIEW.ADD_LABEL && (
              <AddLabelForm
                onSave={(label, properties) => {
                  setLocalNodeTypes((prev) => {
                    const filtered = prev.filter(t => t.label !== label);
                    return [...filtered, { label, properties }];
                  });
                }}
                message={addMsg}
                setMessage={setAddMsg}
              />
            )}

            {activeView === VIEW.ADD_RELT && (
  <AddRelTypeForm
    labelOptions={labelOptions}
    onSave={(type, srcLabel, dstLabel, properties) => {
      setLocalRelTypes((prev) => {
        const exists = prev.some(r => r.type === type && r.srcLabel === srcLabel && r.dstLabel === dstLabel);
        if (exists) {
          return prev.map(r =>
            (r.type === type && r.srcLabel === srcLabel && r.dstLabel === dstLabel)
              ? { ...r, properties }
              : r
          );
        }
        return [...prev, { type, srcLabel, dstLabel, properties }];
      });
    }}
    message={rtMsg}
    setMessage={setRtMsg}
  />
)}

            {activeView === VIEW.REL && (
              <RelationshipForm
                relType={selectedRelType}
                relPairs={effectiveRelTypePairs.get(selectedRelType) || []}
                relTypePropsMap={relTypePropsMap}
                localNodes={localNodes}
                fetchDbInstancesForLabel={fetchDbInstancesForLabel}
                createLocalRelationship={createLocalRelationship}
                dataBump={dataBump}
                displayFromProps={displayFromProps}
              />
            )}

            {activeView === VIEW.NODE && (
              <NodeForm
                node={currentNode}
                uniqueKeys={currentUniqueKeys}
                findDuplicateNode={findDuplicateNode}
                createLocalNode={createLocalNode}
                updateLocalNodeById={updateLocalNodeById}
              />
            )}

            {activeView === VIEW.NONE && (
              <div className="placeholder">
                Select <strong>Node Data</strong> or <strong>Relationship</strong> to work with instances from the DB
                (read-only) + your local items, or define schema with <strong>Add Node Label</strong> /
                <strong> Add Relationship Type</strong>. No database writes will occur.
              </div>
            )}

            {activeView === VIEW.IMPORT && (
  <ImportPlanner
    // Optional: wire DB existence checks if/when you have API hooks.
    // getExistingNode={async (label, keyField, keyValue) => { ...return true/false }}
    // getExistingRel={async (rel) => { ...return true/false }}
  />
)}

          </Card>
        </ErrorBoundary>
      </main>
    </div>
  );
}
