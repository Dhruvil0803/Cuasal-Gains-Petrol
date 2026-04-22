// src/components/DropdownFormUI/useLocalGraph.js
import { useMemo, useState, useEffect, useCallback } from "react";
import { LS, readLS, writeLS, genId } from "./utils";

/**
 * Local-only graph state (schema + data) backed by localStorage.
 * Mirrors the original logic without DB writes.
 */
export default function useLocalGraph() {
  // ----- schema (local-only) -----
  const [localNodeTypes, setLocalNodeTypes] = useState(() => readLS(LS.NODE_TYPES, []));
  const [localRelTypes,  setLocalRelTypes]  = useState(() => readLS(LS.REL_TYPES,  []));
  // ----- instances (local-only) -----
  const [localNodes, setLocalNodes] = useState(() => readLS(LS.NODES, []));
  const [localRels,  setLocalRels]  = useState(() => readLS(LS.RELS,  []));
  // bump trigger to refresh option lists after local changes
  const [dataBump, setDataBump] = useState(0);

  // persist to LS whenever these change
  useEffect(() => writeLS(LS.NODE_TYPES, localNodeTypes), [localNodeTypes]);
  useEffect(() => writeLS(LS.REL_TYPES,  localRelTypes),  [localRelTypes]);
  useEffect(() => writeLS(LS.NODES,      localNodes),     [localNodes]);
  useEffect(() => writeLS(LS.RELS,       localRels),      [localRels]);

  const bump = useCallback(() => setDataBump((x) => x + 1), []);

  // -------- relationship-type → props schema map (local-only) --------
  // Map<string, Record<propName, type>>
  const relTypePropsMap = useMemo(() => {
    const map = new Map();
    for (const rt of localRelTypes) {
      const t = (rt.type || "").trim();
      if (!t) continue;
      const propsArr = (rt.properties || []).map(p => ({
        name: (p.name || "").trim(),
        type: p.type || "string",
      })).filter(p => p.name);
      if (!propsArr.length) continue;
      const existing = map.get(t) || {};
      const merged = { ...existing };
      for (const p of propsArr) merged[p.name] = p.type;
      map.set(t, merged);
    }
    return map;
  }, [localRelTypes]);

  // ======================== CRUD helpers (local) ========================

  // ----- Nodes -----
  const findDuplicateNode = useCallback((label, keyField, keyValue) => {
    if (!label || !keyField || keyValue === undefined || keyValue === null) return null;
    return localNodes.find(n => n.label === label && n.props && n.props[keyField] === keyValue) || null;
  }, [localNodes]);

  const createLocalNode = useCallback((label, propsObj) => {
    const newNode = {
      id: genId("node"),
      label,
      props: { ...(propsObj || {}) },
      createdAt: new Date().toISOString(),
    };
    setLocalNodes(prev => [...prev, newNode]);
    bump();
    return newNode;
  }, [bump]);

  const updateLocalNodeById = useCallback((id, nextProps) => {
    setLocalNodes(prev => prev.map(n => n.id === id ? { ...n, props: { ...n.props, ...(nextProps || {}) } } : n));
    bump();
  }, [bump]);

  // ----- Relationships -----
  const relationshipExists = useCallback((type, srcRef, dstRef) => {
    return !!localRels.find(r => r.type === type && r.srcRef === srcRef && r.dstRef === dstRef);
  }, [localRels]);

  const createLocalRelationship = useCallback(({ type, srcRef, dstRef, srcLabel, dstLabel, props }) => {
    if (!type || !srcRef || !dstRef || !srcLabel || !dstLabel) return { created: false, reason: "missing_fields" };
    if (relationshipExists(type, srcRef, dstRef)) return { created: false, reason: "exists" };

    const rel = {
      id: genId("rel"),
      type,
      srcRef,
      dstRef,
      srcLabel,
      dstLabel,
      createdAt: new Date().toISOString(),
      props: { ...(props || {}) },
    };
    setLocalRels(prev => [...prev, rel]);
    bump();
    return { created: true, rel };
  }, [relationshipExists, bump]);

  // ======================= import/export/clear =======================

  const exportLocal = useCallback(() => {
    const payload = {
      nodeTypes: localNodeTypes,
      relTypes: localRelTypes,
      nodes: localNodes,
      rels: localRels,
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-local-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [localNodeTypes, localRelTypes, localNodes, localRels]);

  // pass this as onChange handler to a hidden <input type="file" />
  const importFromFileInput = useCallback((event) => {
    const f = event?.target?.files?.[0];
    if (!f) return { ok: false, error: "no_file" };
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || "{}"));
        setLocalNodeTypes(Array.isArray(json.nodeTypes) ? json.nodeTypes : []);
        setLocalRelTypes(Array.isArray(json.relTypes) ? json.relTypes : []);
        setLocalNodes(Array.isArray(json.nodes) ? json.nodes : []);
        setLocalRels(Array.isArray(json.rels) ? json.rels : []);
        bump();
      } catch (err) {
        alert("Failed to import JSON: " + (err?.message || String(err)));
      } finally {
        if (event?.target) event.target.value = "";
      }
    };
    reader.readAsText(f);
    return { ok: true };
  }, [bump]);

  const clearLocal = useCallback(() => {
    if (!window.confirm("Clear ALL local labels/types/nodes/relationships? This cannot be undone.")) return false;
    setLocalNodeTypes([]);
    setLocalRelTypes([]);
    setLocalNodes([]);
    setLocalRels([]);
    bump();
    return true;
  }, [bump]);

  return {
    // state
    localNodeTypes, setLocalNodeTypes,
    localRelTypes,  setLocalRelTypes,
    localNodes,     setLocalNodes,
    localRels,      setLocalRels,
    dataBump,

    // derived
    relTypePropsMap,

    // helpers
    findDuplicateNode,
    createLocalNode,
    updateLocalNodeById,
    createLocalRelationship,

    // io
    exportLocal,
    importFromFileInput,
    clearLocal,
  };
}
