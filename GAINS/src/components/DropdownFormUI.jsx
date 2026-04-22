// // DropdownFormUI.jsx
// import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
// import neo4j from "neo4j-driver";

// /* ================= Neo4j connection (READ-ONLY) ================= */
// // at top of the file
// import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from "@/config/env"; // adjust path if not using @ alias


// /* ================== Local-only persistence ================== */
// const LS = {
//   NODE_TYPES: "ui.local.schema.nodeTypes",   // [{label, properties:[{name,type}]}]
//   REL_TYPES: "ui.local.schema.relTypes",     // [{type, srcLabel, dstLabel, properties:[{name,type}]}]
//   NODES:      "ui.local.data.nodes",         // [{id, label, props, createdAt}]
//   RELS:       "ui.local.data.rels"           // [{id, type, srcRef, dstRef, srcLabel, dstLabel, createdAt, props}]
// };

// const readLS = (k, defVal) => {
//   try {
//     const raw = window.localStorage.getItem(k);
//     return raw ? JSON.parse(raw) : defVal;
//   } catch {
//     return defVal;
//   }
// };
// const writeLS = (k, v) => {
//   try { window.localStorage.setItem(k, JSON.stringify(v)); } catch {}
// };
// const genId = (p="local") => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

// /* ---------------- helpers (no hardcoded property names) ------------------ */
// const stripTicks = (s) => String(s).replace(/^:+/, "").replace(/`/g, "").trim();
// const safeIdent  = (s) => stripTicks(String(s)).replace(/[^A-Za-z0-9_]/g, "_");

// /** Make a readable option label from any property set, with no assumptions */
// const displayFromProps = (props, id) => {
//   if (!props || typeof props !== "object" || Object.keys(props).length === 0) {
//     return `(#${id})`;
//   }
//   const entries = Object.entries(props).filter(
//     ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
//   );
//   if (!entries.length) return `(#${id})`;

//   const strings = entries.filter(([, v]) => typeof v === "string");
//   const numbers = entries.filter(([, v]) => typeof v === "number");

//   const parts = [];
//   const takeSome = (arr) => {
//     for (const [k, v] of arr) {
//       parts.push(`${k}: ${String(v)}`);
//       if (parts.length >= 2) break;
//     }
//   };

//   takeSome(strings);
//   if (parts.length < 2) takeSome(numbers);
//   if (parts.length < 2) takeSome(entries);

//   const text = parts.join(" | ");
//   return text.length > 120 ? text.slice(0, 117) + "…" : text;
// };

// /* ================== Field (memoized for smooth typing) ================== */
// const Field = React.memo(function Field({ nodeId, field, value, onFieldChange }) {
//   const id = `${nodeId}_${field.name}`;

//   const handleChange = useCallback(
//     (e) => {
//       const { type, value: raw, checked, name } = e.target;
//       const next = type === "checkbox" ? checked : raw;
//       onFieldChange(name, next);
//     },
//     [onFieldChange]
//   );

//   if (field.type === "textarea") {
//     return (
//       <div className="field">
//         <label className="label" htmlFor={id}>{field.label} *</label>
//         <textarea id={id} name={field.name} className="textarea" value={value} onChange={handleChange} />
//       </div>
//     );
//   }

//   const inputType =
//     field.type === "number" ? "number" :
//     field.type === "date"   ? "date"   :
//     field.type === "checkbox" ? "checkbox" : "text";

//   const commonProps = { id, name: field.name, onChange: handleChange };

//   return (
//     <div className="field">
//       <label className="label" htmlFor={id}>{field.label} *</label>
//       {inputType === "checkbox" ? (
//         <input {...commonProps} className="input" type="checkbox" checked={!!value} />
//       ) : (
//         <input {...commonProps} className="input" type={inputType} value={value} />
//       )}
//     </div>
//   );
// }, (p, n) =>
//   p.nodeId === n.nodeId &&
//   p.field.name === n.field.name &&
//   p.field.type === n.field.type &&
//   p.value === n.value &&
//   p.onFieldChange === n.onFieldChange
// );

// /* ====================== Small Error Boundary ====================== */
// class ErrorBoundary extends React.Component {
//   constructor(p){ super(p); this.state = { err: null }; }
//   static getDerivedStateFromError(err){ return { err }; }
//   render(){ return this.state.err ? <pre className="alert" style={{margin:16}}>{String(this.state.err)}</pre> : this.props.children; }
// }

// /* ================== Component ================== */
// export default function DropdownFormUI() {
//   const css = `
//     html, body, #root { height: 100%; overflow: hidden; }
//     .app, .app * { all: revert; }

//     .app { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
//       display:flex; height:100vh; background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%); color:#1e293b; overflow:hidden; box-sizing:border-box; }

//     .sidebar { width:300px; background:#fff; border-right:1px solid #e2e8f0; padding:24px; box-shadow:2px 0 8px rgba(0,0,0,.04); flex-shrink:0; }
//     .side-block + .side-block { margin-top:20px; }
//     .side-title { font-size:16px; font-weight:700; color:#1e293b; margin:0 0 8px; }

//     .dropdown { width:100%; padding:12px 16px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size:14px; color:#334155; outline:none; transition:all .2s; }
//     .dropdown:hover { border-color:#94a3b8; }
//     .dropdown:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }

//     .content { flex:1; padding:24px; display:flex; align-items:flex-start; justify-content:center; overflow:hidden; min-width:0; }

//     .card { width:100%; max-width:1080px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 8px 20px rgba(0,0,0,.08);
//       --lift:96px; height:calc(100vh - 48px - var(--lift)); display:flex; flex-direction:column; overflow:hidden; position:relative; min-width:0; --footer-h:72px; }
//     .card-header { padding:14px 18px; background:#0f172a; color:#fff; flex-shrink:0; display:flex; align-items:center; gap:16px; }
//     .card-title { margin:0; font-size:18px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; }

//     .tabs-inline { margin-left:auto; display:flex; gap:6px; background:rgba(255,255,255,.08); padding:4px; border-radius:10px; }
//     .tabs-inline button { border:0; background:transparent; color:#cbd5e1; font-weight:700; padding:6px 10px; border-radius:8px; cursor:pointer; }
//     .tabs-inline button.active { background:#1e293b; color:#fff; }

//     .card-body {
//       flex: 1; min-height: 0; padding: 20px 24px; background: #fff;
//       padding-bottom: calc(var(--footer-h) + 12px);
//       overflow-y: auto; -webkit-overflow-scrolling: touch;
//     }

//     .placeholder { width:100%; color:#64748b; background:#fff; border:1px dashed #cbd5e1; padding:28px 18px; border-radius:12px; text-align:center; font-size:15px; }

//     .context { margin-bottom:16px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:10px; background:#f9fafb; }
//     .context h4 { margin:0 0 10px; font-size:13px; font-weight:800; color:#334155; letter-spacing:.35px; text-transform:uppercase; }

//     .selector-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
//     .selector-grid.wide { grid-template-columns:1fr; }

//     .help { font-size:12px; color:#64748b; margin-top:8px; }

//     .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
//     .form-grid.wide { grid-template-columns:1fr; }

//     .field { margin-bottom:16px; }
//     .label { display:block; font-size:12.5px; font-weight:700; color:#374151; margin-bottom:6px; letter-spacing:.3px; }

//     .input, .textarea { width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; color:#1f2937; background:#fff; outline:none; transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
//     .textarea { resize:vertical; min-height:80px; font-family:inherit; }
//     .input:hover, .textarea:hover { border-color:#9ca3af; }
//     .input:focus, .textarea:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }

//     .card-footer { position:absolute; left:0; right:0; bottom:0; height:var(--footer-h); display:flex; align-items:center; justify-content:space-between; gap:12px;
//       padding:12px 18px; background:#f8fafc; border-top:1px solid #e2e8f0; box-shadow:0 -6px 12px rgba(0,0,0,.04); }
//     .btn { padding:10px 16px; border-radius:8px; border:1px solid transparent; cursor:pointer; font-size:14px; font-weight:700; transition: all .15s; letter-spacing:.3px; }
//     .btn.primary { background:linear-gradient(135deg,#3b82f6 0%, #1d4ed8 100%); color:#fff; border-color:#3b82f6; }
//     .btn.primary:hover { background:linear-gradient(135deg,#2563eb 0%, #1e40af 100%); transform: translateY(-1px); }
//     .btn.primary:disabled { opacity:.5; cursor:not-allowed; transform:none; }
//     .btn:not(.primary) { background:#fff; color:#6b7280; border-color:#d1d5db; }
//     .btn:not(.primary):hover { background:#f9fafb; border-color:#9ca3af; }

//     .btn .mini-spinner { width:14px; height:14px; border-radius:50%; border:2px solid #c7d2fe; border-top-color:#fff; margin-right:8px; display:inline-block; vertical-align:-2px; animation:spin 0.9s linear infinite; }
//     @keyframes spin { to { transform: rotate(360deg); } }

//     .notice { position:relative; padding:12px 16px; font-size:14px; font-weight:600; color:#065f46;
//       background:linear-gradient(135deg,#ecfdf5 0%, #d1fae5 100%); border:1px solid #10b981; border-radius:8px; }
//     .alert { position:relative; padding:12px 16px; font-size:14px; font-weight:600; color:#b91c1c;
//       background:#fee2e2; border:1px solid #fecaca; border-radius:8px; max-height:160px; overflow:auto; word-break:break-word; }

//     .pill { display:inline-block; padding:2px 8px; border:1px solid #e5e7eb; border-radius:999px; background:#f8fafc; color:#334155; font-size:12px; }

//     .prop-grid { display:grid; grid-template-columns:1fr 150px 46px; gap:10px; align-items:center; }

//     /* Loader + Modal */
//     .loader-screen { display:flex; align-items:center; justify-content:center; height:100vh; }
//     .loader-box { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:20px 24px; box-shadow:0 8px 20px rgba(0,0,0,.08); text-align:center; }
//     .spinner { width:20px; height:20px; border-radius:50%; border:3px solid #c7d2fe; border-top-color:#3b82f6; margin:0 auto 8px; animation:spin 0.8s linear infinite; }
//     .loader-text { color:#334155; font-weight:700; }

//     .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.4); display:flex; align-items:center; justify-content:center; }
//     .modal { width:520px; max-width:92vw; background:#fff; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0 12px 28px rgba(0,0,0,.18); }
//     .modal-header { padding:14px 16px; font-weight:800; background:#0f172a; color:#fff; border-top-left-radius:12px; border-top-right-radius:12px; }
//     .modal-body { padding:16px; color:#334155; }
//     .modal-actions { padding:12px 16px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e5e7eb; }
//     .footer-tools { display:flex; align-items:center; gap:8px; }
//     .footer-tools .hint { font-size:12px; color:#64748b; margin-right:6px; }
//   `;

//   /* ================= READ-ONLY: Load labels/props + relationship pairs ================= */
//   const [driver, setDriver] = useState(null);
//   const driverRef = useRef(null);
//   const [dbSchemaNodes, setDbSchemaNodes] = useState([]); // [{id,label,title,fields}]
//   const [dbRelTypes, setDbRelTypes] = useState([]);
//   const [dbRelTypePairs, setDbRelTypePairs] = useState(new Map()); // relType -> [{src,dst}]
//   const [uniqueKeysByLabel, setUniqueKeysByLabel] = useState(new Map()); // label -> Set(props)
//   const [connectError, setConnectError] = useState("");
//   const [loading, setLoading] = useState(true);

//   // Local-only schema & data
//   const [localNodeTypes, setLocalNodeTypes] = useState(() => readLS(LS.NODE_TYPES, []));
//   const [localRelTypes, setLocalRelTypes] = useState(() => readLS(LS.REL_TYPES, [])); // may not include properties (back-compat)
//   const [localNodes, setLocalNodes]         = useState(() => readLS(LS.NODES, []));
//   const [localRels, setLocalRels]           = useState(() => readLS(LS.RELS, []));
//   const [dataBump, setDataBump] = useState(0); // increments to refresh options after local changes

//   useEffect(() => writeLS(LS.NODE_TYPES, localNodeTypes), [localNodeTypes]);
//   useEffect(() => writeLS(LS.REL_TYPES, localRelTypes),   [localRelTypes]);
//   useEffect(() => writeLS(LS.NODES, localNodes),         [localNodes]);
//   useEffect(() => writeLS(LS.RELS, localRels),           [localRels]);

//   useEffect(() => {
//     let cancelled = false;
//     let createdDriver = null;

//     (async () => {
//       try {
//         setLoading(true);
//         setConnectError("");
//         createdDriver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
//         setDriver(createdDriver);
//         driverRef.current = createdDriver;

//         const session = createdDriver.session({ defaultAccessMode: neo4j.session.READ });

//         // --- Node labels + properties (schema) ---
//         const nodeRes = await session.run(`
//           CALL db.schema.nodeTypeProperties()
//           YIELD nodeType, propertyName, propertyTypes
//           RETURN nodeType, propertyName, propertyTypes
//           ORDER BY nodeType, propertyName
//         `);

//         const byLabel = new Map();
//         for (const rec of nodeRes.records) {
//           const nodeType = rec.get("nodeType");
//           const rawLabel = Array.isArray(nodeType) ? nodeType[0] : nodeType;
//           const label = stripTicks(rawLabel);
//           const prop = stripTicks(rec.get("propertyName"));
//           if (!label || !prop) continue;

//           const types = rec.get("propertyTypes") || [];
//           const tset = new Set(types.map(String));
//           const isNumber =
//             tset.has("Integer") || tset.has("Float") || tset.has("Long") ||
//             tset.has("Double") || tset.has("Number") ||
//             [...tset].some((t) => /LIST OF (INTEGER|FLOAT|NUMBER|LONG|DOUBLE)/i.test(t));
//           const isBool = tset.has("Boolean");

//           const field = {
//             name: prop,
//             label: prop,
//             type: isBool ? "checkbox" : isNumber ? "number" : "text",
//             required: true,
//           };

//           if (!byLabel.has(label)) byLabel.set(label, []);
//           const arr = byLabel.get(label);
//           if (!arr.some((f) => f.name === prop)) arr.push(field);
//         }

//         const nodes = [...byLabel.entries()]
//           .map(([id, fields]) => ({ id, title: id, fields }))
//           .sort((a, b) => a.title.localeCompare(b.title));

//         // --- Relationship type label pairs from data ---
//         const pairRes = await session.run(`
//           MATCH (src)-[r]->(dst)
//           RETURN type(r) AS relType,
//                  head(labels(src)) AS srcLabel,
//                  head(labels(dst)) AS dstLabel
//           ORDER BY relType, srcLabel, dstLabel
//         `);
//         const pairsMap = new Map(); // relType -> Set("src|dst")
//         for (const rec of pairRes.records) {
//           const rtype = stripTicks(rec.get("relType"));
//           const srcLabel = stripTicks(rec.get("srcLabel"));
//           const dstLabel = stripTicks(rec.get("dstLabel"));
//           if (!rtype || !srcLabel || !dstLabel) continue;
//           if (!pairsMap.has(rtype)) pairsMap.set(rtype, new Set());
//           pairsMap.get(rtype).add(`${srcLabel}|${dstLabel}`);
//         }
//         const relPairs = new Map();
//         for (const [rtype, setPairs] of pairsMap.entries()) {
//           const list = Array.from(setPairs).map((s) => {
//             const [src, dst] = s.split("|");
//             return { src, dst };
//           }).sort((a, b) => (a.src + a.dst).localeCompare(b.src + b.dst));
//           relPairs.set(rtype, list);
//         }
//         const allRelTypes = Array.from(relPairs.keys()).sort();

//         // --- Unique constraints (best-effort) ---
//         const keysMap = new Map();
//         try {
//           const cRes = await session.run(`
//             SHOW CONSTRAINTS
//             YIELD name, type, entityType, labelsOrTypes, properties
//             WHERE entityType = 'NODE' AND type STARTS WITH 'UNI'
//             RETURN labelsOrTypes, properties
//           `);
//           for (const rec of cRes.records) {
//             const labels = rec.get("labelsOrTypes") || [];
//             const props = rec.get("properties") || [];
//             const label = labels[0] ? stripTicks(labels[0]) : null;
//             if (!label || !props.length) continue;
//             if (!keysMap.has(label)) keysMap.set(label, new Set());
//             const set = keysMap.get(label);
//             for (const p of props) set.add(stripTicks(p));
//           }
//         } catch {/* ignore */}

//         await session.close();
//         if (cancelled) return;

//         setDbSchemaNodes(nodes);
//         setDbRelTypes(allRelTypes);
//         setDbRelTypePairs(relPairs);
//         setUniqueKeysByLabel(keysMap);
//       } catch (e) {
//         if (!cancelled) {
//           setConnectError(e.message || String(e));
//           setDbSchemaNodes([]);
//           setDbRelTypes([]);
//           setDbRelTypePairs(new Map());
//           setUniqueKeysByLabel(new Map());
//         }
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     })();

//     return () => {
//       try { driverRef.current && driverRef.current.close(); } catch {}
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   /* ================= Merge DB schema with local schema types ================= */
//   const effectiveSchemaNodes = useMemo(() => {
//     const map = new Map();

//     // Start with DB schema (read-only)
//     for (const n of dbSchemaNodes) {
//       map.set(n.id, {
//         id: n.id,
//         title: n.title,
//         fields: [...n.fields],
//       });
//     }

//     // Merge/append local-only labels
//     for (const t of localNodeTypes) {
//       const label = t.label;
//       if (!label) continue;
//       const existing = map.get(label) || { id: label, title: label, fields: [] };
//       const fieldNames = new Set(existing.fields.map(f => f.name));
//       for (const p of (t.properties || [])) {
//         if (!fieldNames.has(p.name)) {
//           // Map local type to input type
//           const ft =
//             p.type === "number" ? "number" :
//             p.type === "boolean" ? "checkbox" :
//             p.type === "date" ? "date" : "text";
//           existing.fields.push({ name: p.name, label: p.name, type: ft, required: true });
//         }
//       }
//       map.set(label, existing);
//     }

//     // Sort fields by name for consistency
//     const list = [...map.values()].map(n => ({
//       ...n,
//       fields: [...n.fields].sort((a,b) => a.name.localeCompare(b.name))
//     })).sort((a,b) => a.title.localeCompare(b.title));

//     return list;
//   }, [dbSchemaNodes, localNodeTypes]);

//   /* ================= Relationship Types: merge DB + Local ================= */
//   const effectiveRelTypePairs = useMemo(() => {
//     const m = new Map();
//     // DB pairs first
//     for (const [rtype, pairs] of dbRelTypePairs.entries()) {
//       m.set(rtype, [...pairs]);
//     }
//     // Add local pairs
//     for (const rt of localRelTypes) {
//       const t = safeIdent(rt.type || "");
//       const src = safeIdent(rt.srcLabel || "");
//       const dst = safeIdent(rt.dstLabel || "");
//       if (!t || !src || !dst) continue;
//       const list = m.get(t) || [];
//       if (!list.some(p => p.src === src && p.dst === dst)) {
//         list.push({ src, dst });
//       }
//       m.set(t, list);
//     }
//     // sort pairs in each type
//     for (const [k, v] of m.entries()) {
//       m.set(k, [...v].sort((a,b) => (a.src + a.dst).localeCompare(b.src + b.dst)));
//     }
//     return m;
//   }, [dbRelTypePairs, localRelTypes]);

//   const effectiveRelTypes = useMemo(
//     () => Array.from(effectiveRelTypePairs.keys()).sort(),
//     [effectiveRelTypePairs]
//   );

//   /* ======== Relationship Type → Properties schema (LOCAL-ONLY) ======== */
//   // Build a map: type -> { propName: typeString }
//   const relTypePropsMap = useMemo(() => {
//     const map = new Map();
//     for (const rt of localRelTypes) {
//       const t = safeIdent(rt.type || "");
//       if (!t) continue;
//       const propsArr = (rt.properties || []).map(p => ({
//         name: safeIdent(p.name || ""),
//         type: p.type || "string",
//       })).filter(p => p.name);
//       if (!propsArr.length) continue;
//       const existing = map.get(t) || {};
//       const merged = { ...existing };
//       for (const p of propsArr) merged[p.name] = p.type;
//       map.set(t, merged);
//     }
//     return map;
//   }, [localRelTypes]);

//   /* ================= Forms (node mode) ================= */
//   const makeInitialForms = useCallback((nodesList) => {
//     const obj = {};
//     for (const node of nodesList) {
//       const entry = {};
//       for (const f of node.fields) entry[f.name] = f.type === "checkbox" ? false : "";
//       obj[node.id] = entry;
//     }
//     return obj;
//   }, []);

//   const [forms, setForms] = useState(() => makeInitialForms(effectiveSchemaNodes));
//   const [selectedNode, setSelectedNode] = useState("");
//   const [submitted, setSubmitted] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [saveError, setSaveError] = useState("");

//   // per-label chosen duplicate-check field (local-only)
//   const [keyFieldMap, setKeyFieldMap] = useState(new Map()); // label -> fieldName
//   const setKeyFieldFor = (label, fieldName) =>
//     setKeyFieldMap((prev) => new Map(prev).set(label, fieldName));

//   useEffect(() => {
//     setForms(makeInitialForms(effectiveSchemaNodes));
//     setSelectedNode("");
//     setSubmitted(false);
//     setKeyFieldMap(new Map()); // reset when schema changes
//   }, [effectiveSchemaNodes, makeInitialForms]);

//   // Try to pick a DB-unique key automatically if exists; for local-only labels there won't be any
//   useEffect(() => {
//     if (!selectedNode) return;
//     if (keyFieldMap.has(selectedNode)) return;
//     const uniques = uniqueKeysByLabel.get(selectedNode);
//     if (uniques && uniques.size) {
//       const first = [...uniques][0];
//       setKeyFieldFor(selectedNode, first);
//     }
//   }, [selectedNode, uniqueKeysByLabel]); // eslint-disable-line

//   const currentNode = useMemo(
//     () => effectiveSchemaNodes.find((n) => n.id === selectedNode),
//     [effectiveSchemaNodes, selectedNode]
//   );
//   const currentData = currentNode ? forms[selectedNode] : null;
//   const currentKeyField = selectedNode ? keyFieldMap.get(selectedNode) || "" : "";

//   /* ================= Validation (debounced, all fields required) ================= */
//   const calcValid = useCallback((node, data) => {
//     if (!node || !data) return false;
//     for (const f of node.fields) {
//       const v = data[f.name];
//       if (f.type === "checkbox") {
//         if (!v) return false;
//       } else {
//         const str = String(v ?? "");
//         if (str.trim() === "") return false;
//         if (f.type === "number") {
//           const n = Number(str);
//           if (Number.isNaN(n)) return false;
//         }
//       }
//     }
//     return true;
//   }, []);
//   const [isValid, setIsValid] = useState(false);
//   useEffect(() => {
//     const t = setTimeout(() => setIsValid(calcValid(currentNode, currentData)), 120);
//     return () => clearTimeout(t);
//   }, [currentNode, currentData, calcValid]);

//   /* ================= Build props object ================= */
//   const buildPropsObject = (node, data) => {
//     const props = {};
//     for (const f of node.fields) {
//       let v = data[f.name];
//       if (f.type === "number") {
//         const n = Number(String(v).trim());
//         v = Number.isNaN(n) ? null : n;
//       } else if (f.type === "checkbox") {
//         v = !!v;
//       } else if (f.type === "date") {
//         v = String(v);
//       } else {
//         v = String(v);
//       }
//       props[f.name] = v;
//     }
//     return props;
//   };

//   /* ================= Duplicate check modal (LOCAL-ONLY) ================= */
//   const [dupModalOpen, setDupModalOpen] = useState(false);
//   const [dupInfo, setDupInfo] = useState(null); // { label, keyField, keyValue, localId }
//   const closeDupModal = () => { setDupModalOpen(false); setDupInfo(null); };

//   // Update existing LOCAL node by key
//   const confirmUpdateExisting = async () => {
//     if (!dupInfo || !currentNode) return;
//     try {
//       setSaving(true);
//       setSaveError("");
//       const props = buildPropsObject(currentNode, currentData);

//       setLocalNodes(prev => prev.map(n =>
//         n.id === dupInfo.localId ? { ...n, props: { ...n.props, ...props } } : n
//       ));
//       setSubmitted(true);
//       setDataBump(x => x+1); // refresh lists using local nodes
//       closeDupModal();
//     } catch (e) {
//       setSaveError(e.message || String(e));
//       closeDupModal();
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* ================= Save node (LOCAL-ONLY) ================= */
//   const handleSubmit = async () => {
//     if (!currentNode || !isValid) return;

//     setSaving(true);
//     setSaveError("");
//     setSubmitted(false);

//     const label = currentNode.id;
//     const props = buildPropsObject(currentNode, currentData);

//     try {
//       // Local duplicate check by chosen key
//       if (currentKeyField && props[currentKeyField] !== undefined && String(props[currentKeyField]).trim() !== "") {
//         const keyVal = props[currentKeyField];
//         const existing = localNodes.find(n => n.label === label && n.props && n.props[currentKeyField] === keyVal);
//         if (existing) {
//           setDupInfo({
//             label,
//             keyField: currentKeyField,
//             keyValue: keyVal,
//             localId: existing.id
//           });
//           setDupModalOpen(true);
//           setSaving(false);
//           return;
//         }
//       }

//       // Create local node
//       const newNode = {
//         id: genId("node"),
//         label,
//         props,
//         createdAt: new Date().toISOString()
//       };
//       setLocalNodes(prev => [...prev, newNode]);
//       setSubmitted(true);
//       setDataBump(x => x+1);
//     } catch (e) {
//       setSaveError(e.message || String(e));
//     } finally {
//       setSaving(false);
//     }
//   };

//   const onFieldChange = useCallback((name, nextValue) => {
//     setForms((prev) => ({
//       ...prev,
//       [selectedNode]: { ...prev[selectedNode], [name]: nextValue },
//     }));
//   }, [selectedNode]);

//   const handleReset = () => {
//     if (!currentNode) return;
//     const reset = {};
//     for (const f of currentNode.fields) reset[f.name] = f.type === "checkbox" ? false : "";
//     setForms((p) => ({ ...p, [selectedNode]: reset }));
//     setSubmitted(false);
//     setSaveError("");
//   };

//   /* ========== Relationship mode: type → (src,dst) → instance dropdowns ========== */
//   const [selectedRelType, setSelectedRelType] = useState("");
//   const [pairKey, setPairKey] = useState(""); // "src|dst"
//   const relPairs = useMemo(() => {
//     if (!selectedRelType) return [];
//     return effectiveRelTypePairs.get(selectedRelType) || [];
//   }, [selectedRelType, effectiveRelTypePairs]);

//   const selectedPair = useMemo(() => {
//     if (!pairKey) return null;
//     const [src, dst] = pairKey.split("|");
//     return { src, dst };
//   }, [pairKey]);

//   // Relationship property form (based on local rel-type schema)
//   const relPropDefs = useMemo(() => {
//     const schema = relTypePropsMap.get(selectedRelType) || {};
//     return Object.entries(schema).map(([name, t]) => ({
//       name,
//       label: name,
//       type: t === "number" ? "number" : t === "boolean" ? "checkbox" : t === "date" ? "date" : "text",
//     }));
//   }, [selectedRelType, relTypePropsMap]);

//   const [relForm, setRelForm] = useState({});
//   useEffect(() => {
//     // initialize/reset rel form when type changes
//     const init = {};
//     for (const f of relPropDefs) {
//       init[f.name] = f.type === "checkbox" ? false : "";
//     }
//     setRelForm(init);
//   }, [relPropDefs]);

//   const onRelFieldChange = useCallback((name, nextValue) => {
//     setRelForm((prev) => ({ ...prev, [name]: nextValue }));
//   }, []);

//   const buildRelProps = useCallback(() => {
//     const schema = relTypePropsMap.get(selectedRelType) || {};
//     const out = {};
//     for (const [name, t] of Object.entries(schema)) {
//       const raw = relForm[name];
//       if (t === "number") {
//         const n = Number(String(raw).trim());
//         if (!Number.isNaN(n)) out[name] = n;
//       } else if (t === "boolean") {
//         out[name] = !!raw;
//       } else if (t === "date") {
//         const s = String(raw || "").trim();
//         if (s) out[name] = s;
//       } else {
//         const s = String(raw || "").trim();
//         if (s) out[name] = s;
//       }
//     }
//     return out;
//   }, [relForm, relTypePropsMap, selectedRelType]);

//   // Instance dropdowns (mix DB nodes + local nodes)
//   const [srcOptions, setSrcOptions] = useState([]); // [{id,valueToken, display}]
//   const [dstOptions, setDstOptions] = useState([]);
//   const [srcToken, setSrcToken] = useState(""); // "db:123" or "local:node-..."
//   const [dstToken, setDstToken] = useState("");
//   const [instLoading, setInstLoading] = useState(false);
//   const [relSaving, setRelSaving] = useState(false);
//   const [relError, setRelError] = useState("");
//   const [relOutcome, setRelOutcome] = useState(null); // { created: boolean } | null

//   const fetchInstancesForLabel = useCallback(async (label, limit = 500) => {
//     const opts = [];

//     // Include LOCAL nodes for that label
//     for (const ln of localNodes.filter(n => n.label === label)) {
//       opts.push({
//         id: ln.id,
//         valueToken: `local:${ln.id}`,
//         display: `[LOCAL] ${displayFromProps(ln.props, ln.id)}`
//       });
//     }

//     // Include DB nodes (READ-ONLY)
//     if (driver) {
//       try {
//         const session = driver.session({ defaultAccessMode: neo4j.session.READ });
//         const cypher = `
//           MATCH (n:\`${safeIdent(label)}\`)
//           RETURN id(n) AS id, properties(n) AS props
//           LIMIT $lim
//         `;
//         const res = await session.run(cypher, { lim: neo4j.int(limit) });
//         await session.close();

//         for (const r of res.records) {
//           const idVal = r.get("id");
//           const id = idVal && idVal.toNumber ? idVal.toNumber() : idVal;
//           const props = r.get("props");
//           opts.push({
//             id,
//             valueToken: `db:${id}`,
//             display: displayFromProps(props, id)
//           });
//         }
//       } catch {/* ignore DB errors here */}
//     }

//     return opts;
//   }, [driver, localNodes]);

//   useEffect(() => {
//     setPairKey("");
//     setSrcOptions([]); setDstOptions([]);
//     setSrcToken(""); setDstToken("");
//     setRelError(""); setRelOutcome(null);
//   }, [selectedRelType]);

//   useEffect(() => {
//     if (selectedRelType) {
//       const pairs = effectiveRelTypePairs.get(selectedRelType) || [];
//       if (pairs.length === 1) setPairKey(`${pairs[0].src}|${pairs[0].dst}`);
//     }
//   }, [selectedRelType, effectiveRelTypePairs]);

//   useEffect(() => {
//     const load = async () => {
//       if (!selectedPair) return;
//       setInstLoading(true);
//       setRelError(""); setRelOutcome(null);
//       try {
//         const [srcOpts, dstOpts] = await Promise.all([
//           fetchInstancesForLabel(selectedPair.src),
//           fetchInstancesForLabel(selectedPair.dst),
//         ]);
//         setSrcOptions(srcOpts);
//         setDstOptions(dstOpts);
//         setSrcToken(""); setDstToken("");
//       } catch (e) {
//         setRelError(e.message || String(e));
//         setSrcOptions([]); setDstOptions([]);
//       } finally {
//         setInstLoading(false);
//       }
//     };
//     load();
//   }, [selectedPair, fetchInstancesForLabel, dataBump]);

//   const canCreateRel = selectedRelType && selectedPair && srcToken && dstToken;

//   // LOCAL-ONLY relationship creation
//   const createRelationship = async () => {
//     if (!canCreateRel) return;

//     setRelSaving(true);
//     setRelError("");
//     setRelOutcome(null);

//     try {
//       const already = localRels.find(r =>
//         r.type === selectedRelType &&
//         r.srcRef === srcToken &&
//         r.dstRef === dstToken
//       );
//       if (already) {
//         setRelOutcome({ created: false });
//       } else {
//         const props = buildRelProps();
//         const newRel = {
//           id: genId("rel"),
//           type: selectedRelType,
//           srcRef: srcToken,
//           dstRef: dstToken,
//           srcLabel: selectedPair.src,
//           dstLabel: selectedPair.dst,
//           createdAt: new Date().toISOString(),
//           props,
//         };
//         setLocalRels(prev => [...prev, newRel]);
//         setRelOutcome({ created: true });
//       }
//     } catch (e) {
//       setRelError(e.message || String(e));
//     } finally {
//       setRelSaving(false);
//     }
//   };

//   /* ======================= Add Node Label (LOCAL-ONLY) ======================= */
//   const [showAddLabel, setShowAddLabel] = useState(false);
//   const [newLabel, setNewLabel] = useState("");
//   const [newProps, setNewProps] = useState([{ name: "", type: "string" }]);
//   const [addMsg, setAddMsg] = useState({ kind: "", text: "" });
//   const typeOptions = ["string", "number", "boolean", "date"];

//   const saveLocalLabel = () => {
//     const label = safeIdent(newLabel);
//     const props = newProps
//       .map(p => ({ name: safeIdent(p.name), type: p.type }))
//       .filter(p => p.name);

//     if (!label || props.length === 0) {
//       setAddMsg({ kind: "error", text: "Please provide a label and at least one property." });
//       return;
//     }

//     setLocalNodeTypes(prev => {
//       const filtered = prev.filter(t => t.label !== label);
//       return [...filtered, { label, properties: props }];
//     });
//     setAddMsg({ kind: "ok", text: `Saved label “${label}” with ${props.length} propert${props.length>1?"ies":"y"} (local only).` });
//     setNewLabel("");
//     setNewProps([{ name:"", type:"string"}]);
//   };

//   /* ======================= Add Relationship Type (LOCAL-ONLY) ======================= */
//   const [showAddRelType, setShowAddRelType] = useState(false);
//   const [rtType, setRtType] = useState("");
//   const [rtSrc, setRtSrc] = useState("");
//   const [rtDst, setRtDst] = useState("");
//   const [rtMsg, setRtMsg] = useState({ kind: "", text: "" });
//   const [rtProps, setRtProps] = useState([{ name: "", type: "string" }]); // NEW: rel-type properties

//   const effectiveLabelNames = useMemo(
//     () => effectiveSchemaNodes.map(n => n.id).sort(),
//     [effectiveSchemaNodes]
//   );

//   const saveLocalRelType = () => {
//     const t = safeIdent(rtType);
//     const src = safeIdent(rtSrc);
//     const dst = safeIdent(rtDst);
//     const props = rtProps
//       .map(p => ({ name: safeIdent(p.name), type: p.type }))
//       .filter(p => p.name);

//     if (!t || !src || !dst) {
//       setRtMsg({ kind: "error", text: "Please provide Type, Source label, and Target label." });
//       return;
//     }
//     setLocalRelTypes(prev => {
//       const exists = prev.some(r => r.type === t && r.srcLabel === src && r.dstLabel === dst);
//       if (exists) {
//         return prev.map(r => (r.type === t && r.srcLabel === src && r.dstLabel === dst)
//           ? { ...r, properties: props }
//           : r
//         );
//       }
//       return [...prev, { type: t, srcLabel: src, dstLabel: dst, properties: props }];
//     });
//     setRtMsg({ kind: "ok", text: `Saved relationship type “${t}” (${src} → ${dst}) locally${props.length ? ` with ${props.length} propert${props.length>1?"ies":"y"}` : ""}.` });
//     setRtType(""); setRtSrc(""); setRtDst("");
//     setRtProps([{ name:"", type:"string"}]);
//   };

//   /* ====================== Unified View Tabs ====================== */
//   const VIEW = {
//     NODE: "NODE",
//     REL: "REL",
//     ADD_LABEL: "ADD_LABEL",
//     ADD_RELT: "ADD_RELT",
//     NONE: "NONE",
//   };

//   const activeView = useMemo(() => {
//     if (showAddLabel) return VIEW.ADD_LABEL;
//     if (showAddRelType) return VIEW.ADD_RELT;
//     if (selectedNode) return VIEW.NODE;
//     if (selectedRelType) return VIEW.REL;
//     return VIEW.NONE;
//   }, [showAddLabel, showAddRelType, selectedNode, selectedRelType]);

//   const setActiveView = (v) => {
//     if (v === VIEW.ADD_LABEL) {
//       setShowAddLabel(true); setShowAddRelType(false); setSelectedNode(""); setSelectedRelType("");
//       setAddMsg({kind:"",text:""});
//     } else if (v === VIEW.ADD_RELT) {
//       setShowAddRelType(true); setShowAddLabel(false); setSelectedNode(""); setSelectedRelType("");
//       setRtMsg({kind:"",text:""});
//     } else if (v === VIEW.NODE) {
//       setShowAddLabel(false); setShowAddRelType(false); setSelectedRelType("");
//     } else if (v === VIEW.REL) {
//       setShowAddLabel(false); setShowAddRelType(false); setSelectedNode("");
//     } else {
//       setShowAddLabel(false); setShowAddRelType(false); setSelectedNode(""); setSelectedRelType("");
//     }
//     setSubmitted(false); setSaveError("");
//   };

//   /* ====================== Local export / import / clear ====================== */
//   const fileInputRef = useRef(null);

//   const exportLocal = () => {
//     const payload = {
//       nodeTypes: localNodeTypes,
//       relTypes: localRelTypes,
//       nodes: localNodes,
//       rels: localRels,
//       savedAt: new Date().toISOString()
//     };
//     const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `graph-local-data-${Date.now()}.json`;
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   const importLocal = (e) => {
//     const f = e.target.files && e.target.files[0];
//     if (!f) return;
//     const reader = new FileReader();
//     reader.onload = () => {
//       try {
//         const json = JSON.parse(String(reader.result || "{}"));
//         setLocalNodeTypes(Array.isArray(json.nodeTypes) ? json.nodeTypes : []);
//         setLocalRelTypes(Array.isArray(json.relTypes) ? json.relTypes : []);
//         setLocalNodes(Array.isArray(json.nodes) ? json.nodes : []);
//         setLocalRels(Array.isArray(json.rels) ? json.rels : []);
//         setDataBump(x => x+1);
//       } catch (err) {
//         alert("Failed to import JSON: " + (err?.message || String(err)));
//       } finally {
//         e.target.value = "";
//       }
//     };
//     reader.readAsText(f);
//   };

//   const clearLocal = () => {
//     if (!window.confirm("Clear ALL local labels/types/nodes/relationships? This cannot be undone.")) return;
//     setLocalNodeTypes([]); setLocalRelTypes([]); setLocalNodes([]); setLocalRels([]);
//     setDataBump(x => x+1);
//   };

//   /* ================= Centered loader / error ================= */
//   if (loading) {
//     return (
//       <div className="loader-screen">
//         <style>{css}</style>
//         <div className="loader-box">
//           <div className="spinner" />
//           <div className="loader-text">Loading…</div>
//         </div>
//       </div>
//     );
//   }

//   if (!effectiveSchemaNodes.length && connectError) {
//     return (
//       <div className="loader-screen">
//         <style>{css}</style>
//         <div className="loader-box">
//           <div className="alert">Neo4j load failed (read-only): {connectError}</div>
//         </div>
//       </div>
//     );
//   }

//   /* ================= Main UI (Unified Card) ================= */
//   return (
//     <div className="app">
//       <style>{css}</style>

//       {/* Sidebar still handy for quick selections */}
//       <aside className="sidebar">
//         <div className="side-block">
//           <div className="side-title">Node Selection</div>
//           <select
//             className="dropdown"
//             value={selectedNode}
//             onChange={(e) => { setSelectedNode(e.target.value); setActiveView(VIEW.NODE); }}
//             disabled={!effectiveSchemaNodes.length}
//           >
//             <option value="">Select a node…</option>
//             {effectiveSchemaNodes.map((n) => (
//               <option key={n.id} value={n.id}>{n.title}</option>
//             ))}
//           </select>
//         </div>

//         <div className="side-block">
//           <div className="side-title">Relationship Type</div>
//           <select
//             className="dropdown"
//             value={selectedRelType}
//             onChange={(e) => { setSelectedRelType(e.target.value); setActiveView(VIEW.REL); }}
//             disabled={!effectiveRelTypes.length}
//           >
//             <option value="">Select a relationship…</option>
//             {effectiveRelTypes.map((rt) => (
//               <option key={rt} value={rt}>{rt}</option>
//             ))}
//           </select>
//         </div>

//         <div className="side-block">
//           <div className="side-title">Add Node Label</div>
//           <button className="btn" onClick={() => setActiveView(VIEW.ADD_LABEL)} style={{ width: "100%" }}>
//             Open
//           </button>
//         </div>

//         <div className="side-block">
//           <div className="side-title">Add Relationship Type</div>
//           <button className="btn" onClick={() => setActiveView(VIEW.ADD_RELT)} style={{ width: "100%" }}>
//             Open
//           </button>
//         </div>
//       </aside>

//       <main className="content">
//         <ErrorBoundary>
//           <div className="card">
//             <div className="card-header">
//               <h3 className="card-title">
//                 {activeView === VIEW.NODE && (currentNode ? `${currentNode.title} (Local Data)` : "Node Data")}
//                 {activeView === VIEW.REL && (selectedRelType ? `Relationship: ${selectedRelType} (Local Only)` : "Relationship")}
//                 {activeView === VIEW.ADD_LABEL && "Add Node Label (Local Schema Only)"}
//                 {activeView === VIEW.ADD_RELT && "Add Relationship Type (Local Schema Only)"}
//                 {activeView === VIEW.NONE && "Choose an Action"}
//               </h3>

//               <div className="tabs-inline">
//                 <button
//                   className={activeView === VIEW.NODE ? "active" : ""}
//                   onClick={() => setActiveView(VIEW.NODE)}
//                 >Node Data</button>
//                 <button
//                   className={activeView === VIEW.REL ? "active" : ""}
//                   onClick={() => setActiveView(VIEW.REL)}
//                 >Relationship</button>
//                 <button
//                   className={activeView === VIEW.ADD_LABEL ? "active" : ""}
//                   onClick={() => setActiveView(VIEW.ADD_LABEL)}
//                 >Add Node Label</button>
//                 <button
//                   className={activeView === VIEW.ADD_RELT ? "active" : ""}
//                   onClick={() => setActiveView(VIEW.ADD_RELT)}
//                 >Add Relationship Type</button>
//               </div>
//             </div>

//             <div className="card-body">
//               {/* ==== BODY: ADD NODE LABEL ==== */}
//               {activeView === VIEW.ADD_LABEL && (
//                 <>
//                   <div className="context">
//                     <h4>Label</h4>
//                     <div className="field">
//                       <label className="label" htmlFor="newLabel">Node label *</label>
//                       <input id="newLabel" className="input" placeholder="e.g. DEMO_LABEL"
//                             value={newLabel} onChange={(e)=>setNewLabel(e.target.value)} />
//                       <div className="help">
//                         Will be kept locally as <span className="pill">{safeIdent(newLabel || "Label")}</span>. No database writes.
//                       </div>
//                     </div>
//                   </div>

//                   <div className="context">
//                     <h4>Properties</h4>
//                     <div className="prop-grid" style={{ marginBottom: 8 }}>
//                       <div className="label">Name</div>
//                       <div className="label">Type</div>
//                       <div />
//                     </div>

//                     {newProps.map((row, i) => (
//                       <div className="prop-grid" key={i}>
//                         <input
//                           className="input"
//                           placeholder="propertyName"
//                           value={row.name}
//                           onChange={(e)=> setNewProps(arr => arr.map((r,idx)=> idx===i ? { ...r, name: safeIdent(e.target.value) } : r))}
//                         />
//                         <select
//                           className="dropdown"
//                           value={row.type}
//                           onChange={(e)=> setNewProps(arr => arr.map((r,idx)=> idx===i ? { ...r, type: e.target.value } : r))}
//                         >
//                           {["string","number","boolean","date"].map(t => <option key={t} value={t}>{t}</option>)}
//                         </select>
//                         <button className="btn" onClick={()=> setNewProps(arr => arr.filter((_,idx)=>idx!==i))}>✕</button>
//                       </div>
//                     ))}
//                     <button className="btn" onClick={()=> setNewProps(arr => [...arr, { name:"", type:"string"}])}>+ Add property</button>
//                   </div>

//                   {addMsg.text && (
//                     <div className={addMsg.kind === "error" ? "alert" : "notice"} role="alert" aria-live="polite">
//                       {addMsg.text}
//                     </div>
//                   )}
//                 </>
//               )}

//               {/* ==== BODY: ADD REL TYPE ==== */}
//               {activeView === VIEW.ADD_RELT && (
//                 <>
//                   <div className="context">
//                     <h4>Relationship</h4>
//                     <div className="selector-grid wide">
//                       <div className="field">
//                         <label className="label" htmlFor="rtType">Type *</label>
//                         <input id="rtType" className="input" placeholder="e.g. WORKS_AT"
//                               value={rtType} onChange={(e)=>setRtType(e.target.value)} />
//                         <div className="help">Will be stored locally as <span className="pill">{safeIdent(rtType || "TYPE")}</span></div>
//                       </div>
//                       <div className="field">
//                         <label className="label" htmlFor="rtSrc">Source label *</label>
//                         <select id="rtSrc" className="dropdown" value={rtSrc} onChange={(e)=>setRtSrc(e.target.value)}>
//                           <option value="">— Select —</option>
//                           {effectiveLabelNames.map(l => <option key={l} value={l}>{l}</option>)}
//                         </select>
//                       </div>
//                       <div className="field">
//                         <label className="label" htmlFor="rtDst">Target label *</label>
//                         <select id="rtDst" className="dropdown" value={rtDst} onChange={(e)=>setRtDst(e.target.value)}>
//                           <option value="">— Select —</option>
//                           {effectiveLabelNames.map(l => <option key={l} value={l}>{l}</option>)}
//                         </select>
//                       </div>
//                     </div>
//                     <div className="help">Records an allowed <strong>Label A → Label B</strong> pair for your local relationship type list. No DB writes.</div>
//                   </div>

//                   <div className="context">
//                     <h4>Relationship Properties (optional)</h4>
//                     <div className="prop-grid" style={{ marginBottom: 8 }}>
//                       <div className="label">Name</div>
//                       <div className="label">Type</div>
//                       <div />
//                     </div>

//                     {rtProps.map((row, i) => (
//                       <div className="prop-grid" key={i}>
//                         <input
//                           className="input"
//                           placeholder="propertyName"
//                           value={row.name}
//                           onChange={(e)=> setRtProps(arr => arr.map((r,idx)=> idx===i ? { ...r, name: safeIdent(e.target.value) } : r))}
//                         />
//                         <select
//                           className="dropdown"
//                           value={row.type}
//                           onChange={(e)=> setRtProps(arr => arr.map((r,idx)=> idx===i ? { ...r, type: e.target.value } : r))}
//                         >
//                           {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
//                         </select>
//                         <button className="btn" onClick={()=> setRtProps(arr => arr.filter((_,idx)=>idx!==i))}>✕</button>
//                       </div>
//                     ))}
//                     <button className="btn" onClick={()=> setRtProps(arr => [...arr, { name:"", type:"string"}])}>+ Add property</button>
//                     <div className="help" style={{ marginTop:8 }}>
//                       <code>createdAt</code> is always added automatically when you create a relationship instance.
//                     </div>
//                   </div>

//                   {rtMsg.text && (
//                     <div className={rtMsg.kind === "error" ? "alert" : "notice"} role="alert" aria-live="polite">
//                       {rtMsg.text}
//                     </div>
//                   )}
//                 </>
//               )}

//               {/* ==== BODY: RELATIONSHIP MODE ==== */}
//               {activeView === VIEW.REL && (
//                 <div className="context">
//                   <h4>(Source, Target) Label Pair</h4>
//                   {(effectiveRelTypePairs.get(selectedRelType) || []).length === 0 ? (
//                     <div className="placeholder">No (Source, Target) label pairs found for <strong>{selectedRelType || "…"}</strong>. Add one under “Add Relationship Type”.</div>
//                   ) : (
//                     <>
//                       {(effectiveRelTypePairs.get(selectedRelType) || []).length > 1 && (
//                         <div className="field" style={{ marginBottom: 16 }}>
//                           <label className="label" htmlFor="pair">Label Pair *</label>
//                           <select
//                             id="pair"
//                             className="dropdown"
//                             value={pairKey}
//                             onChange={(e) => setPairKey(e.target.value)}
//                           >
//                             <option value="">— Select label pair —</option>
//                             {(effectiveRelTypePairs.get(selectedRelType) || []).map((p) => {
//                               const key = `${p.src}|${p.dst}`;
//                               return (
//                                 <option key={key} value={key}>
//                                   {p.src} → {p.dst}
//                                 </option>
//                               );
//                             })}
//                           </select>
//                           <div className="help">Pick which labels act as Source (A) and Target (B).</div>
//                         </div>
//                       )}

//                       {/* Instance selectors */}
//                       {selectedPair ? (
//                         <>
//                           <div className="selector-grid">
//                             <div className="field">
//                               <label className="label" htmlFor="srcInst">
//                                 Node A (Source: {selectedPair.src}) *
//                               </label>
//                               <select
//                                 id="srcInst"
//                                 className="dropdown"
//                                 value={srcToken}
//                                 onChange={(e) => setSrcToken(e.target.value)}
//                                 disabled={instLoading}
//                               >
//                                 <option value="">— Select a {selectedPair.src} —</option>
//                                 {srcOptions.map((o) => (
//                                   <option key={o.valueToken} value={o.valueToken}>{o.display}</option>
//                                 ))}
//                               </select>
//                             </div>

//                             <div className="field">
//                               <label className="label" htmlFor="dstInst">
//                                 Node B (Target: {selectedPair.dst}) *
//                               </label>
//                               <select
//                                 id="dstInst"
//                                 className="dropdown"
//                                 value={dstToken}
//                                 onChange={(e) => setDstToken(e.target.value)}
//                                 disabled={instLoading}
//                               >
//                                 <option value="">— Select a {selectedPair.dst} —</option>
//                                 {dstOptions.map((o) => (
//                                   <option key={o.valueToken} value={o.valueToken}>{o.display}</option>
//                                 ))}
//                               </select>
//                             </div>
//                           </div>

//                           {/* Relationship properties (optional, from local rel-type schema) */}
//                           {relPropDefs.length > 0 && (
//                             <div className="context" style={{ marginTop: 16 }}>
//                               <h4>Relationship Properties (Optional)</h4>
//                               <div className="form-grid wide">
//                                 <div>
//                                   {relPropDefs.map((f) => (
//                                     <Field
//                                       key={f.name}
//                                       nodeId={selectedRelType}
//                                       field={f}
//                                       value={relForm[f.name]}
//                                       onFieldChange={onRelFieldChange}
//                                     />
//                                   ))}
//                                 </div>
//                               </div>
//                               <div className="help">These are saved locally on the relationship record; <code>createdAt</code> is added automatically.</div>
//                             </div>
//                           )}

//                           {relError && <div className="alert" style={{ marginTop: 12 }}>{relError}</div>}
//                         </>
//                       ) : (
//                         <div className="placeholder">Select a label pair to continue.</div>
//                       )}
//                     </>
//                   )}
//                 </div>
//               )}

//               {/* ==== BODY: NODE MODE ==== */}
//               {activeView === VIEW.NODE && (
//                 <>
//                   {saveError && <div className="alert" role="alert">{saveError}</div>}

//                   <div className="context" style={{ marginBottom: 18 }}>
//                     <h4>Duplicate Check (Local)</h4>
//                     {currentNode ? (
//                       <div className="selector-grid">
//                         <div className="field">
//                           <label className="label" htmlFor="dupKey">Field to check existing node *</label>
//                           <select
//                             id="dupKey"
//                             className="dropdown"
//                             value={currentKeyField}
//                             onChange={(e) => setKeyFieldFor(currentNode.id, e.target.value)}
//                           >
//                             <option value="">— None (always create new) —</option>
//                             {currentNode.fields.map((f) => (
//                               <option key={f.name} value={f.name}>{f.name}</option>
//                             ))}
//                           </select>
//                           <div className="help">
//                             Checks duplicates only in your <strong>local</strong> nodes for this label.
//                           </div>
//                         </div>
//                       </div>
//                     ) : (
//                       <div className="placeholder">Pick a node label from the left to start.</div>
//                     )}
//                   </div>

//                   {currentNode && (
//                     <div className="form-grid wide">
//                       <div>
//                         {currentNode.fields.map((f) => (
//                           <Field key={f.name} nodeId={currentNode.id} field={f} value={currentData[f.name]} onFieldChange={onFieldChange} />
//                         ))}
//                       </div>
//                     </div>
//                   )}

//                   {submitted && isValid && (
//                     <div className="notice" role="alert" aria-live="polite" style={{ marginTop: 12 }}>
//                       <strong>{currentNode?.title} saved locally!</strong>
//                     </div>
//                   )}
//                 </>
//               )}

//               {/* ==== BODY: NONE ==== */}
//               {activeView === VIEW.NONE && (
//                 <div className="placeholder">
//                   Select <strong>Node Data</strong> or <strong>Relationship</strong> to work with instances from the DB (read-only) + your local items,<br/>
//                   or define schema with <strong>Add Node Label</strong> / <strong>Add Relationship Type</strong>. No database writes will occur.
//                 </div>
//               )}
//             </div>

//             {/* ==== FOOTER (per-view primary action + common local tools) ==== */}
//             <div className="card-footer">
//               <div>
//                 {activeView === VIEW.NODE && (
//                   <>
//                     <button type="button" className="btn primary" onClick={handleSubmit} disabled={!isValid || saving}>
//                       {saving && <span className="mini-spinner" />} Save Locally
//                     </button>
//                     <button type="button" className="btn" onClick={handleReset} disabled={saving}>Reset</button>
//                   </>
//                 )}

//                 {activeView === VIEW.REL && (
//                   <button type="button" className="btn primary" onClick={createRelationship} disabled={!canCreateRel || instLoading || relSaving}>
//                     {relSaving && <span className="mini-spinner" />} Connect Nodes (Local)
//                   </button>
//                 )}

//                 {activeView === VIEW.ADD_LABEL && (
//                   <button className="btn primary" onClick={saveLocalLabel}>Save Node Label</button>
//                 )}

//                 {activeView === VIEW.ADD_RELT && (
//                   <button className="btn primary" onClick={saveLocalRelType}>Save Relationship Type</button>
//                 )}
//               </div>

//               <div className="footer-tools">
//                 <span className="hint">Local data:</span>
//                 <button className="btn" onClick={exportLocal}>Export</button>
//                 <button className="btn" onClick={() => fileInputRef.current?.click()}>Import</button>
//                 <button className="btn" onClick={clearLocal}>Clear</button>
//                 <input ref={fileInputRef} type="file" accept="application/json" style={{ display:"none" }} onChange={importLocal} />
//               </div>
//             </div>

//             {/* Duplicate decision modal (LOCAL) */}
//             {dupModalOpen && dupInfo && (
//               <div className="modal-backdrop" role="dialog" aria-modal="true">
//                 <div className="modal">
//                   <div className="modal-header">Duplicate Found (Local)</div>
//                   <div className="modal-body">
//                     A <strong>{dupInfo.label}</strong> already exists locally with{" "}
//                     <code>{dupInfo.keyField}</code> = <code>{String(dupInfo.keyValue)}</code>.
//                     <br />
//                     Do you want to <strong>update</strong> that existing local node with your current form values,
//                     or <strong>keep the same</strong> (cancel, no changes)?
//                   </div>
//                   <div className="modal-actions">
//                     <button className="btn" onClick={() => { setDupModalOpen(false); setDupInfo(null); }}>Keep Same (Cancel)</button>
//                     <button className="btn primary" onClick={confirmUpdateExisting}>Update Existing</button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Relationship outcome notice (outside footer so it persists) */}
//             {activeView === VIEW.REL && relOutcome && (
//               <div className="notice" role="alert" aria-live="polite" style={{ margin: 12 }}>
//                 {relOutcome.created
//                   ? <>New <strong>{selectedRelType}</strong> relationship recorded locally (with <code>createdAt</code> and any provided properties).</>
//                   : <>Relationship <strong>{selectedRelType}</strong> already exists locally — nothing new created.</>}
//               </div>
//             )}
//           </div>
//         </ErrorBoundary>
//       </main>
//     </div>
//   );
// }
