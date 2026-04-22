// import React, { useEffect, useMemo, useRef, useState } from "react";

// /* ---------- Leaflet loader (CDN) ---------- */
// function useLeaflet() {
//   const [ready, setReady] = useState(!!window.L);
//   useEffect(() => {
//     if (window.L) { setReady(true); return; }
//     const link = document.createElement("link");
//     link.rel = "stylesheet";
//     link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
//     link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
//     link.crossOrigin = "";
//     const script = document.createElement("script");
//     script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
//     script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
//     script.crossOrigin = "";
//     script.onload = () => setReady(true);
//     document.head.appendChild(link);
//     document.body.appendChild(script);
//   }, []);
//   return ready;
// }

// /* ---------- Layer config ---------- */
// const LAYER_META = {
//   customers:  { label: "Customers",  emoji: "🧑",  color: "#2563eb" },
//   orders:     { label: "Orders",     emoji: "📦",  color: "#a855f7" },
//   warehouses: { label: "Warehouses", emoji: "🏬",  color: "#10b981" },
//   roads:      { label: "Roads",      emoji: "",    color: "#94a3b8"  },
// };

// const USA_BOUNDS = [[24.396308, -125.0], [49.384358, -66.93457]];
// const USA_CENTER = [39.8283, -98.5795];

// /* ---------- tiny helpers ---------- */
// const toCSV = (rows) => {
//   if (!rows?.length) return "";
//   const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
//   const esc = (v) => {
//     if (v == null) return "";
//     const s = String(v);
//     return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
//   };
//   return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
// };

// const guessLabel = (p={}) =>
//   p.name || p.NAME || p.unit_name || p.UNIT_NAME || p.WAREHOUSE_ID || p.CUSTOMER_ID || p.ORDER_ID || "";

// /* ---------- Component ---------- */
// export default function GISMap({ onNavigate }) {
//   const leafletReady = useLeaflet();
//   const mapRef = useRef(null);
//   const mapObjRef = useRef(null);
//   const groupsRef = useRef({});           // { layerKey: L.LayerGroup }
//   const featureIndexRef = useRef({});     // { uid: {layerKey, leafletObject, bbox} }
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");

//   // table state
//   const [allRows, setAllRows] = useState([]);     // flat rows from all layers
//   const [filters, setFilters] = useState({});     // { col: value }
//   const [sort, setSort] = useState({ col: null, dir: "asc" });
//   const [selected, setSelected] = useState(new Set()); // uids
//   const [info, setInfo] = useState(null); 
// // info shape: { uid, title, props, bounds }


//   // resizable bottom panel
//   const bottomH = useRef(260);
//   const [panelH, setPanelH] = useState(bottomH.current);
//   const dragRef = useRef(null);
  

//   /* ---------- init map ---------- */
//   useEffect(() => {
//     if (!leafletReady || mapObjRef.current) return;
//     const L = window.L;
//     const map = L.map(mapRef.current, {
//       zoomControl: false,
//       preferCanvas: true,
//       maxBounds: USA_BOUNDS,
//       maxBoundsViscosity: 0.8,
//     });
//     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//       maxZoom: 18,
//       attribution: "&copy; OpenStreetMap",
//     }).addTo(map);
//     L.control.zoom({ position: "bottomleft" }).addTo(map);
//     map.setView(USA_CENTER, 4);
//     mapObjRef.current = map;
//   }, [leafletReady]);

//   /* ---------- fetch layers and build table ---------- */
//   useEffect(() => {
//     if (!leafletReady || !mapObjRef.current) return;
//     const L = window.L;
//     const map = mapObjRef.current;

//     const iconFor = (emoji) =>
//       L.divIcon({ className: "emoji-pin", html: `<div style="font-size:18px">${emoji}</div>`, iconSize: [18,18], iconAnchor: [9,9] });

//     const markerIconCache = {};
//     const getIcon = (emoji) => markerIconCache[emoji] || (markerIconCache[emoji] = iconFor(emoji));

//     function uid() { return Math.random().toString(36).slice(2, 10); }

//     async function loadLayer(key, limit=2000) {
//       if (groupsRef.current[key]) { map.removeLayer(groupsRef.current[key]); }
//       const url = `/api/snowflake/geo?layer=${encodeURIComponent(key)}&limit=${limit}`;
//       const r = await fetch(url);
//       const data = await r.json();
//       if (!r.ok || !data?.ok) throw new Error(data?.error || `Failed to load ${key}`);

//       const group = L.layerGroup().addTo(map);
//       groupsRef.current[key] = group;

//       const meta = LAYER_META[key] || {};
//       const ptEmoji = meta.emoji || "📍";
//       const lineColor = meta.color || "#64748b";

//       const rows = [];
//       let added = 0;

//       for (const f of data.features || []) {
//         const g = f.geometry; if (!g?.type) continue;
//         const props = f.properties || {};
//         const label = guessLabel(props);
//         const row = { __uid: uid(), __layer: key, name: label, ...props };

//         let obj = null;
//         if (g.type === "Point") {
//           const [lon, lat] = g.coordinates || [];
//           if (Number.isFinite(lat) && Number.isFinite(lon)) {
//             obj = L.marker([lat, lon], { icon: getIcon(ptEmoji) }).addTo(group);
//           }
//         } else if (g.type === "MultiPoint") {
//           const markers = [];
//           for (const [lon, lat] of g.coordinates || []) {
//             if (Number.isFinite(lat) && Number.isFinite(lon)) {
//               markers.push(L.marker([lat, lon], { icon: getIcon(ptEmoji) }).addTo(group));
//             }
//           }
//           if (markers.length) obj = L.layerGroup(markers);
//         } else if (g.type === "LineString") {
//           const ll = (g.coordinates || []).map(([x,y]) => [y,x]);
//           if (ll.length >= 2) obj = L.polyline(ll, { color: lineColor, weight: 2, opacity: 0.9 }).addTo(group);
//         } else if (g.type === "MultiLineString") {
//           const parts = (g.coordinates || []).map(part => part.map(([x,y]) => [y,x]));
//           const lines = parts.map(ll => L.polyline(ll, { color: lineColor, weight: 2, opacity: 0.9 }).addTo(group));
//           if (lines.length) obj = L.layerGroup(lines);
//         } else if (g.type === "Polygon" || g.type === "MultiPolygon") {
//           const toLL = (coords) => coords.map(r => r.map(([x,y]) => [y,x]));
//           if (g.type === "Polygon") {
//             obj = L.polygon(toLL(g.coordinates), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(group);
//           } else {
//             const polys = (g.coordinates || []).map(poly => L.polygon(toLL(poly), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(group));
//             if (polys.length) obj = L.layerGroup(polys);
//           }
//         }

//         if (obj) {
//   // store full context for info panel + highlighting
//   const entry = {
//     layerKey: key,
//     leafletObject: obj,
//     props, // all attributes for the details table
//     type: (g.type === "Point" || g.type === "MultiPoint") ? "point" : "path",
//   };
//   // for points, also keep emoji & base icon so other code can use it
//   if (g.type === "Point") {
//     const [lon, lat] = g.coordinates || [];
//     entry.pointLatLng = window.L.latLng(lat, lon);
//     entry.emoji = ptEmoji;
//   }

//   featureIndexRef.current[row.__uid] = entry;

//   if (label && obj.bindTooltip) obj.bindTooltip(String(label), { direction: "top" });

//   // clicking feature: toggle selection AND open info panel
//   obj.on?.("click", () => {
//     toggleSelect(row.__uid);
//     showInfo(row.__uid);
//   });

//   rows.push(row);
//   added++;
// }
//       }

//       return { group, rows, added };
//     }

//     async function go() {
//       setLoading(true); setErr("");
//       featureIndexRef.current = {};
//       setSelected(new Set());
//       try {
//         const [cust, ord, rd, wh] = await Promise.all([
//           loadLayer("customers", 2000),
//           loadLayer("orders", 2000),
//           loadLayer("roads",  3000),
//           loadLayer("warehouses", 2000),
//         ]);

//         // build table rows
//         const rows = [...cust.rows, ...ord.rows, ...rd.rows, ...wh.rows];
//         setAllRows(rows);

//         // fit to data or USA
//         const boundsList = [];
//         for (const g of Object.values(groupsRef.current)) {
//           const b = g.getBounds?.();
//           if (b && b.isValid()) boundsList.push(b);
//         }
//         if (boundsList.length) {
//           let all = boundsList[0].clone();
//           for (let i=1; i<boundsList.length; i++) all.extend(boundsList[i]);
//           map.fitBounds(all.pad(0.2));
//         } else {
//           map.setView(USA_CENTER, 4);
//         }

//         // layer toggles
//         // const overlays = {
//         //   [LAYER_META.customers.label]:  groupsRef.current.customers,
//         //   [LAYER_META.orders.label]:     groupsRef.current.orders,
//         //   [LAYER_META.roads.label]:      groupsRef.current.roads,
//         //   [LAYER_META.warehouses.label]: groupsRef.current.warehouses,
//         // };
//         // if (map._layersControl) map.removeControl(map._layersControl);
//         // const ctrl = L.control.layers({}, overlays, { position:"topright", collapsed:false });
//         // ctrl.addTo(map); map._layersControl = ctrl;

//       } catch (e) {
//         setErr(e.message || String(e));
//       } finally {
//         setLoading(false);
//       }
//     }

//     go();
//   }, [leafletReady]);

//   /* ---------- info helpers ---------- */
// function computeBoundsForEntry(entry) {
//   const lo = entry?.leafletObject;
//   if (!lo) return null;
//   if (lo.getBounds) {
//     const b = lo.getBounds();
//     if (b && b.isValid && b.isValid()) return b;
//   }
//   if (lo.getLatLng) {
//     const ll = lo.getLatLng();
//     return window.L.latLngBounds([ll, ll]);
//   }
//   return null;
// }

// function showInfo(uid) {
//   const entry = featureIndexRef.current[uid];
//   if (!entry) return;
//   const title = guessLabel(entry.props) || (LAYER_META[entry.layerKey]?.label || entry.layerKey);
//   const bounds = computeBoundsForEntry(entry);
//   setInfo({ uid, title, props: entry.props, bounds });
// }

// function zoomToInfo() {
//   if (!info?.bounds || !mapObjRef.current) return;
//   mapObjRef.current.fitBounds(info.bounds.pad(0.25));
// }

//   /* ---------- selection sync ---------- */
//   const toggleSelect = (uid) => {
//     setSelected(prev => {
//       const p = new Set(prev);
//       if (p.has(uid)) {
//         p.delete(uid);
//         const f = featureIndexRef.current[uid];
//         if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 2, opacity: 0.9 });
//       } else {
//         p.add(uid);
//         const f = featureIndexRef.current[uid];
//         if (f?.leafletObject?.bringToFront) f.leafletObject.bringToFront();
//         if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 4, opacity: 1 });
//         showInfo(uid);
//       }
//       return p;
//     });
//   };
//   const clearSelection = () => {
//     setSelected(prev => {
//       for (const uid of prev) {
//         const f = featureIndexRef.current[uid];
//         if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 2, opacity: 0.9 });
//       }
//       return new Set();
//     });
//   };

//   /* ---------- table view model ---------- */
//   const columns = useMemo(() => {
//     // common columns + first few known props
//     const cols = ["", "layer", "name"];
//     // sample row to discover more fields
//     const sample = allRows[0] || {};
//     const keys = Object.keys(sample).filter(k => !k.startsWith("__") && !cols.includes(k));
//     for (const k of ["WAREHOUSE_ID","CUSTOMER_ID","ORDER_ID","TYPE","STATE","UNIT_CODE","LON","LAT"])
//       if (keys.includes(k)) cols.push(k);
//     // add the rest up to a sensible amount
//     for (const k of keys) if (!cols.includes(k) && cols.length < 12) cols.push(k);
//     return cols;
//   }, [allRows]);

//   const filtered = useMemo(() => {
//     let rows = [...allRows];
//     for (const [k, v] of Object.entries(filters)) {
//       if (!v) continue;
//       rows = rows.filter(r => String(r[k] ?? "").toLowerCase().includes(String(v).toLowerCase()));
//     }
//     if (sort.col) {
//       const { col, dir } = sort;
//       rows.sort((a,b) => String(a[col]??"").localeCompare(String(b[col]??"")));
//       if (dir === "desc") rows.reverse();
//     }
//     return rows;
//   }, [allRows, filters, sort]);

//   const total = filtered.length;
//   const selectedCount = [...selected].filter(uid => filtered.some(r => r.__uid === uid)).length;

//   /* ---------- export CSV ---------- */
//   const exportCSV = () => {
//     const rows = filtered.map(({__uid,__layer, ...r}) => ({ layer: __layer, ...r }));
//     const csv = toCSV(rows);
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(blob);
//     a.download = `gis_export_${Date.now()}.csv`;
//     a.click();
//     URL.revokeObjectURL(a.href);
//   };

//   /* ---------- bottom panel resize ---------- */
//   const startDrag = (e) => {
//     e.preventDefault();
//     const startY = e.clientY;
//     const startH = panelH;
//     const onMove = (ev) => {
//       const dy = ev.clientY - startY;
//       const nh = Math.min(Math.max(startH - dy, 140), window.innerHeight - 120);
//       setPanelH(nh); bottomH.current = nh;
//     };
//     const onUp = () => {
//       window.removeEventListener("mousemove", onMove);
//       window.removeEventListener("mouseup", onUp);
//     };
//     window.addEventListener("mousemove", onMove);
//     window.addEventListener("mouseup", onUp);
//   };

//   /* ---------- styles ---------- */
//   const ui = {
//     badge: { background:"#0f1116", border:"1px solid #2c313c", borderRadius:8, padding:"6px 10px", color:"#e5e7eb", fontSize:12 },
//     header: { display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#0b0e14", borderTop:"1px solid #1f2937", color:"#e5e7eb" },
//     grid: { width:"100%", borderCollapse:"collapse", fontSize:13, color:"#e5e7eb" },
//     th: { textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c", position:"sticky", top:0, background:"#0f1116", zIndex:1 },
//     td: { padding:"9px 12px", borderBottom:"1px solid #161a22" },
//     filter: { width:"100%", background:"#0b0f16", border:"1px solid #243042", color:"#e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:12 },
//   };

//   function InfoPanel({ info, onClose, onZoom }) {
//   if (!info) return null;
//   const entries = Object.entries(info.props || {})
//     .filter(([k]) => !k.startsWith("__"))
//     .sort(([a],[b]) => a.localeCompare(b));

//   const cell = {
//     padding: "10px 12px",
//     borderBottom: "1px solid #1f2937",
//     verticalAlign: "top",
//     wordBreak: "break-word",
//     whiteSpace: "pre-wrap",
//   };

//   return (
//     <div style={{
//       position:"absolute", top:70, left:60, zIndex:1200,
//       width: 560, maxHeight: "70vh", overflow:"auto",
//       background:"#0b0e14", color:"#e5e7eb",
//       border:"1px solid #2c313c", borderRadius:10,
//       boxShadow:"0 12px 32px rgba(0,0,0,.45)"
//     }}>
//       {/* Header */}
//       <div style={{ display:"flex", alignItems:"center", gap:10,
//                     padding:"12px 14px", borderBottom:"1px solid #1f2937" }}>
//         <div style={{ fontSize:20, fontWeight:800, lineHeight:1.1, flex:1 }}>
//           nps establishment locations: {info.title}
//         </div>
//         <button onClick={onZoom} title="Zoom to"
//           style={{ background:"transparent", border:"1px solid #334155", color:"#e5e7eb",
//                    width:30, height:30, borderRadius:6, cursor:"pointer" }}>🔍</button>
//         <button onClick={onClose} title="Close"
//           style={{ background:"transparent", border:"1px solid #334155", color:"#e5e7eb",
//                    width:30, height:30, borderRadius:6, cursor:"pointer" }}>✕</button>
//       </div>

//       {/* Body */}
//       <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
//         <tbody>
//           {entries.map(([k, v]) => (
//             <tr key={k} style={{ background:"#0c1017" }}>
//               <td style={{ ...cell, width:200, background:"#0f1116", color:"#cbd5e1", fontWeight:600 }}>{k}</td>
//               <td style={cell}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
//             </tr>
//           ))}
//           {!entries.length && (
//             <tr><td colSpan={2} style={{ ...cell, color:"#9aa3b2" }}>No properties.</td></tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

//   return (
//     <div style={{ position:"absolute", inset:0, background:"#0b0e14", display:"grid", gridTemplateRows:`1fr ${panelH}px` }}>
//       {/* Map */}
//       <div style={{ position:"relative" }}>
//         <div ref={mapRef} style={{ position:"absolute", inset:0 }} />
//         {/* badge */}
//           {/* quick nav from GIS to other app views */}
//   <div
//     style={{
//       position: "absolute",
//       right: 12,
//       top: 12,
//       zIndex: 1200,
//       display: "flex",
//       gap: 8,
//       background: "#0f1116",
//       border: "1px solid #2c313c",
//       borderRadius: 8,
//       padding: 6,
//       boxShadow: "0 4px 16px rgba(0,0,0,.35)",
//     }}
//   >
//     <button
//       onClick={() => onNavigate?.("bloom")}
//       title="Go to Graph"
//       style={{
//         background: "#1f2937",
//         color: "#e5e7eb",
//         border: "1px solid #334155",
//         borderRadius: 6,
//         padding: "6px 10px",
//         cursor: "pointer",
//         fontWeight: 700,
//       }}
//     >
//       GRAPH
//     </button>
//     <button
//       onClick={() => onNavigate?.("forms")}
//       title="Go to Forms"
//       style={{
//         background: "#0b1220",
//         color: "#e5e7eb",
//         border: "1px solid #334155",
//         borderRadius: 6,
//         padding: "6px 10px",
//         cursor: "pointer",
//         fontWeight: 700,
//       }}
//     >
//       Forms
//     </button>
//   </div>

//         <InfoPanel info={info} onClose={() => setInfo(null)} onZoom={zoomToInfo} />
// <div style={{
//   position:"absolute", left:12, top:20,   // was top:12
//   zIndex: 1100,
//   background:"#0f1116", color:"#e5e7eb", border:"1px solid #2c313c",
//   borderRadius:8, padding:"6px 10px", fontSize:12,
//   boxShadow:"0 4px 16px rgba(0,0,0,.35)"
// }}>
//   {loading ? "Loading layers…" : err ? `Error: ${err}` : "USA Map"}
// </div>

// {/* left micro-toolbar */}
// <div style={{
//   position:"absolute", left:12, top:56,   // nudged down so it doesn’t overlap badge
//   zIndex:1100, display:"grid", gap:6
// }}>
//   <button
//     onClick={() => mapObjRef.current.setView([39.8283,-98.5795], 4)}
//     title="Reset to USA"
//     style={{
//       background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
//       padding:"6px 8px", color:"#e5e7eb", fontSize:12,
//       boxShadow:"0 2px 10px rgba(0,0,0,.3)"
//     }}>
//     🇺🇸
//   </button>
//   <button
//     onClick={clearSelection}
//     title="Clear selection"
//     style={{
//       background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
//       padding:"6px 8px", color:"#e5e7eb", fontSize:12,
//       boxShadow:"0 2px 10px rgba(0,0,0,.3)"
//     }}>
//     ✖︎
//   </button>
// </div>
//         <div style={{ position:"absolute", left:12, top:12, zIndex:1000, ...ui.badge }}>
//           {loading ? "Loading layers…" : err ? `Error: ${err}` : "USA Map"}
//         </div>
//         {/* left micro-toolbar */}
//         <div style={{ position:"absolute", left:12, top:48, zIndex:1000, display:"grid", gap:6 }}>
//           <button onClick={() => mapObjRef.current.setView(USA_CENTER, 4)}
//             title="Reset to USA" style={{...ui.badge, padding:"6px 8px"}}>🇺🇸</button>
//           <button onClick={clearSelection} title="Clear selection" style={{...ui.badge, padding:"6px 8px"}}>✖︎</button>
//         </div>
//         {/* static legend, no checkboxes */}
// <div style={{
//   position:"absolute", right:12, bottom:12, zIndex:1001,
//   background:"#0f1116", color:"#e5e7eb", border:"1px solid #2c313c",
//   borderRadius:8, padding:"8px 10px", fontSize:12, lineHeight:1.5, boxShadow:"0 4px 16px rgba(0,0,0,.35)"
// }}>
//   <div style={{ fontWeight:700, marginBottom:6 }}>Layers</div>
//   <div> {LAYER_META.customers.emoji} {LAYER_META.customers.label}</div>
//   <div> {LAYER_META.orders.emoji} {LAYER_META.orders.label}</div>
//   <div> {LAYER_META.warehouses.emoji} {LAYER_META.warehouses.label}</div>
//   <div> — {LAYER_META.roads.label}</div>
// </div>

//         {/* drag handle */}
//         <div onMouseDown={startDrag} style={{ position:"absolute", left:0, right:0, bottom:panelH, height:6, cursor:"row-resize", background:"transparent" }} />
//       </div>

//       {/* Bottom table */}
//       {/* Bottom table */}
// <div style={{ position:"relative", zIndex: 1000, borderTop:"1px solid #1f2937",
//               display:"flex", flexDirection:"column", overflow:"hidden" }}>
//   {/* Header */}
//   <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
//                 background:"#0b0e14", color:"#e5e7eb", borderBottom:"1px solid #1f2937" }}>
//     <div style={{ fontWeight:800 }}>nps establishment locations</div>
//     <div style={{ opacity:.7 }}>(Total: {total} | Selection: {selectedCount})</div>
//     <div style={{ flex:1 }} />
//     <button onClick={exportCSV}
//             style={{ background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
//                      padding:"6px 10px", color:"#e5e7eb", fontSize:12, cursor:"pointer" }}>
//       Export CSV
//     </button>
//   </div>

//   {/* Column filters */}
//   <div style={{ display:"grid", gridAutoFlow:"column", gap:0, padding:"8px 12px",
//                 background:"#0b0e14", borderBottom:"1px solid #1f2937", overflowX:"auto" }}>
//     {columns.map((c, i) => (
//       <div key={i} style={{ minWidth: c === "" ? 36 : 160, paddingRight:10 }}>
//         {c && c !== "" ? (
//           <input
//             placeholder={c}
//             value={filters[c] || ""}
//             onChange={(e) => setFilters(s => ({ ...s, [c]: e.target.value }))}
//             style={{ width:"100%", background:"#0b0f16", border:"1px solid #243042",
//                      color:"#e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:12 }}
//           />
//         ) : <div style={{ width: 24 }} />}
//       </div>
//     ))}
//   </div>

//   {/* Table body fills remaining space */}
//   <div style={{ flex:1, overflow:"auto" }}>
//     <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, color:"#e5e7eb" }}>
//       <thead>
//         <tr>
//           {columns.map((c, i) => (
//             <th key={i}
//                 onClick={() => c && setSort(s => ({ col: c, dir: s.col === c && s.dir === "asc" ? "desc" : "asc" }))}
//                 style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c",
//                          position:"sticky", top:0, background:"#0f1116", zIndex:1 }}>
//               {c === "" ? "" : (c === "layer" ? "Layer" : c)}
//               {sort.col === c ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
//             </th>
//           ))}
//         </tr>
//       </thead>
//       <tbody>
//         {filtered.map((r, idx) => {
//           const isSel = selected.has(r.__uid);
//           return (
//             <tr key={r.__uid} style={{ background: idx%2 ? "#0e131b" : "#0b0f16" }}>
//               <td style={{ padding:"9px 12px", borderBottom:"1px solid #161a22" }}>
//                 <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r.__uid)} />
//               </td>
//               <td style={{ padding:"9px 12px", borderBottom:"1px solid #161a22", whiteSpace:"nowrap" }}>
//                 {(LAYER_META[r.__layer]?.emoji || "📍")} {LAYER_META[r.__layer]?.label || r.__layer}
//               </td>
//               {columns.slice(2).map((c, i2) => (
//                 <td key={i2} style={{ padding:"9px 12px", borderBottom:"1px solid #161a22",
//                                       maxWidth: 280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
//                   {r[c] == null ? "" : String(r[c])}
//                 </td>
//               ))}
//             </tr>
//           );
//         })}
//         {!filtered.length && (
//           <tr><td colSpan={columns.length}
//                   style={{ padding:"12px", borderBottom:"1px solid #161a22", color:"#9aa3b2" }}>No rows.</td></tr>
//         )}
//       </tbody>
//     </table>
//   </div>
// </div>
//     </div>
//   );
// }
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Leaflet loader (CDN) ---------- */
function useLeaflet() {
  const [ready, setReady] = useState(!!window.L);
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => setReady(true);
    document.head.appendChild(link);
    document.body.appendChild(script);
  }, []);
  return ready;
}

/* ---------- Layer config ---------- */
const LAYER_META = {
  // customers:  { label: "Customers",  emoji: "🧑",  color: "#2563eb" },
  // orders:     { label: "Orders",     emoji: "📦",  color: "#a855f7" },
  // warehouses: { label: "Warehouses", emoji: "🏬",  color: "#10b981" },
  roads: { label: "Roads", emoji: "", color: "#fb1111ff" }, // bright cyan
  toyota_dealers: { label: "Toyota Dealers", emoji: "🚗", color: "#f59e0b" },

};

// Simple transport catalog for ETA calculation
const TRANSPORT_MODES = [
  { id: "truck", label: "Truck (Road)", mph: 55 },
  { id: "car", label: "Car / Van", mph: 60 },
  { id: "rail", label: "Rail Freight", mph: 40 },
  { id: "air", label: "Air Cargo", mph: 500 },
];

// Great-circle distance between two lat/lon points in miles
function haversineMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function formatHours(h) {
  if (!Number.isFinite(h) || h <= 0) return "0h";
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const USA_BOUNDS = [[24.396308, -125.0], [49.384358, -66.93457]];
const USA_CENTER = [39.8283, -98.5795];

/* ---------- tiny helpers ---------- */
const toCSV = (rows) => {
  if (!rows?.length) return "";
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
};

const guessLabel = (p={}) =>
  p.DEALER_NAME || p.Dealer_Name || p.name || p.NAME ||
  p.WAREHOUSE_ID || p.CUSTOMER_ID || p.ORDER_ID ||
  p.ZIP_CD || p.zip || p.ZIP || "";

/* ---------- Component ---------- */
export default function GISMap({ onNavigate }) {
  const leafletReady = useLeaflet();
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const groupsRef = useRef({});           // { layerKey: L.LayerGroup }
  const featureIndexRef = useRef({});     // { uid: {layerKey, leafletObject, bbox} }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // table state
  const [allRows, setAllRows] = useState([]);     // flat rows from all layers
  const [filters, setFilters] = useState({});     // { col: value }
  const [sort, setSort] = useState({ col: null, dir: "asc" });
  const [selected, setSelected] = useState(new Set()); // uids
  const [info, setInfo] = useState(null); 

  // route planner state
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [fromOptions, setFromOptions] = useState([]);
  const [toOptions, setToOptions] = useState([]);
  const [fromLocation, setFromLocation] = useState(null); // { label, lat, lon }
  const [toLocation, setToLocation] = useState(null);
  const [transportMode, setTransportMode] = useState("truck");
  const [departure, setDeparture] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [departureDate, setDepartureDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [departureTime, setDepartureTime] = useState(() =>
    new Date().toISOString().slice(11, 16)
  );
  const [routeSummary, setRouteSummary] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeCandidates, setRouteCandidates] = useState([]); // [{uid,label,lat,lon,layer}]

  // NEW: visible layer state (defaults to all)
  const ALL_KEYS = Object.keys(LAYER_META);
  const [visibleLayers, setVisibleLayers] = useState(new Set(ALL_KEYS)); // NEW

  // resizable bottom panel
  const bottomH = useRef(260);
  const [panelH, setPanelH] = useState(bottomH.current);
  const dragRef = useRef(null);

  /* ---------- init map ---------- */
  useEffect(() => {
    if (!leafletReady || mapObjRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, {
  zoomControl: false,
  preferCanvas: true,
  maxBounds: USA_BOUNDS,
  maxBoundsViscosity: 0.8,
});

// (A) make a dedicated pane for roads (sits above default vector overlay)
map.createPane("roadsPane");
map.getPane("roadsPane").style.zIndex = 650;
map.getPane("roadsPane").style.pointerEvents = "auto";

// pane for clickable points (dealers, etc.) above roads
map.createPane("pointsPane");
map.getPane("pointsPane").style.zIndex = 700;   // higher than roads (650)
map.getPane("pointsPane").style.pointerEvents = "auto";


// (optional) slightly fade tiles so cyan roads pop
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap",
  opacity: 0.70,
}).addTo(map);

L.control.zoom({ position: "bottomleft" }).addTo(map);
map.setView(USA_CENTER, 4);
mapObjRef.current = map;

  }, [leafletReady]);

  // Emphasis: selected = full (1); others dim (e.g., 0.25). If none selected -> all 1.
useEffect(() => {
  const hasSelection = selected.size > 0;

  // Build a quick lookup of selected uids
  const sel = new Set(selected);

  // Loop over every feature; featureIndexRef.current = { uid: entry }
  for (const [uid, entry] of Object.entries(featureIndexRef.current)) {
    const layer = entry.leafletObject;
    const isSel = sel.has(uid);

    const targetOpacity = hasSelection ? (isSel ? 1 : 0.25) : 1;
    setLayerOpacity(layer, targetOpacity);

    // You can still bump stroke weight for selected paths if you like:
    if (layer.setStyle && entry.type === "path") {
      layer.setStyle({ weight: isSel ? 4 : 2 });
    }
  }
}, [selected]);


  useEffect(() => {
  setSelected(prev => {
    if (!prev.size) return prev;
    const visibleUIDs = new Set(
      allRows.filter(r => visibleLayers.has(r.__layer)).map(r => r.__uid)
    );
    const next = new Set([...prev].filter(uid => visibleUIDs.has(uid)));
    return next.size === prev.size ? prev : next;
  });
}, [visibleLayers, allRows]); // NEW

  /* ---------- fetch layers and build table ---------- */
  useEffect(() => {
    if (!leafletReady || !mapObjRef.current) return;
    const L = window.L;
    const map = mapObjRef.current;

    const iconFor = (emoji) =>
      L.divIcon({ className: "emoji-pin", html: `<div style="font-size:18px">${emoji}</div>`, iconSize: [18,18], iconAnchor: [9,9] });

    const markerIconCache = {};
    const getIcon = (emoji) => markerIconCache[emoji] || (markerIconCache[emoji] = iconFor(emoji));

    function uid() { return Math.random().toString(36).slice(2, 10); }

    async function loadLayer(key, limit=2000) {
      if (groupsRef.current[key]) { map.removeLayer(groupsRef.current[key]); }
      const url = `/api/snowflake/geo?layer=${encodeURIComponent(key)}&limit=${limit}`;
      const r = await fetch(url);
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `Failed to load ${key}`);

const group = (key === "roads")
? L.featureGroup([], { pane: "roadsPane" }).addTo(map)
: L.layerGroup().addTo(map);
groupsRef.current[key] = group;

if (key === "toyota_dealers" && group.bringToFront) {
  group.bringToFront();
}


const meta = LAYER_META[key] || {};
const ptEmoji = meta.emoji || "📍";
const lineColor = meta.color || "#64748b";

// (B) roads styling helper
const isRoads = key === "roads";
const commonLineStyle = isRoads
? {
color: lineColor,           // #f90d0dff from LAYER_META
weight: 2,                  // thicker so you see it at country zoom
opacity: 0.25,
dashArray: null,            // solid line while we verify
pane: "roadsPane"
}
: { color: lineColor, weight: 3, opacity: 1 };


      const rows = [];
      let added = 0;

      for (const f of data.features || []) {
        const g = f.geometry; if (!g?.type) continue;
        const props = f.properties || {};
        const label = guessLabel(props);
        const row = { __uid: uid(), __layer: key, name: label, ...props };

        let obj = null;

// small helper available to all branches
const toLL = (coords) => coords.map(r => r.map(([x,y]) => [y,x]));

if (g.type === "Point") {
  const [lon, lat] = g.coordinates || [];
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    obj = L.marker([lat, lon], {
      icon: getIcon(ptEmoji),
      pane: "pointsPane",              // <- makes markers live above roads
      bubblingMouseEvents: true
    }).addTo(group);
  }
} else if (g.type === "MultiPoint") {
  const fg = L.featureGroup().addTo(group);
  for (const [lon, lat] of g.coordinates || []) {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      L.marker([lat, lon], {
        icon: getIcon(ptEmoji),
        pane: "pointsPane",
        bubblingMouseEvents: true
      }).addTo(fg);
    }
  }
  obj = fg; // events bubble to this feature group
  if (markers.length) obj = L.layerGroup(markers);
} else if (g.type === "LineString") {
  const ll = (g.coordinates || []).map(([x,y]) => [y,x]);
  if (ll.length >= 2) obj = L.polyline(ll, commonLineStyle).addTo(group);
} else if (g.type === "MultiLineString") {
  const fg = L.featureGroup({ pane: isRoads ? "roadsPane" : undefined }).addTo(group);
  const parts = (g.coordinates || []).map(part => part.map(([x,y]) => [y,x]));
  for (const ll of parts) {
    if (ll.length >= 2) L.polyline(ll, commonLineStyle).addTo(fg);
  }
  obj = fg;
} else if (g.type === "Polygon") {
  obj = L.polygon(toLL(g.coordinates), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(group);
} else if (g.type === "MultiPolygon") {
  const fg = L.featureGroup().addTo(group);
  for (const poly of g.coordinates || []) {
    L.polygon(toLL(poly), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(fg);
  }
  obj = fg;
  if (polys.length) obj = L.layerGroup(polys);
} else if (g.type === "GeometryCollection") {
  const fg = L.featureGroup({ pane: isRoads ? "roadsPane" : undefined }).addTo(group);

  for (const child of g.geometries || []) {
    if (child.type === "LineString") {
      const ll = (child.coordinates || []).map(([x,y]) => [y,x]);
      if (ll.length >= 2) L.polyline(ll, commonLineStyle).addTo(fg);
    } else if (child.type === "MultiLineString") {
      for (const part of child.coordinates || []) {
        const ll = (part || []).map(([x,y]) => [y,x]);
        if (ll.length >= 2) L.polyline(ll, commonLineStyle).addTo(fg);
      }
    } else if (child.type === "Point") {
  const [lon, lat] = child.coordinates || [];
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    L.circleMarker([lat, lon], {
      radius: 3,
      opacity: 1,
      pane: "pointsPane",              // <- above roads
      bubblingMouseEvents: true
    }).addTo(fg);
  }
}
 else if (child.type === "Polygon") {
      L.polygon(toLL(child.coordinates), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(fg);
    } else if (child.type === "MultiPolygon") {
      for (const poly of child.coordinates || []) {
        L.polygon(toLL(poly), { color: lineColor, weight: 1, fillOpacity: .15 }).addTo(fg);
      }
    }
  }

  obj = fg;

  // FIX: also add the wrapper group to the layer
if (children.length) obj = L.layerGroup(children).addTo(group);

}


        if (obj) {
          const entry = {
            layerKey: key,
            leafletObject: obj,
            props,
            type: (g.type === "Point" || g.type === "MultiPoint") ? "point" : "path",
          };
          if (g.type === "Point") {
            const [lon, lat] = g.coordinates || [];
            entry.pointLatLng = window.L.latLng(lat, lon);
            entry.emoji = ptEmoji;
          }

          featureIndexRef.current[row.__uid] = entry;

          if (label && obj.bindTooltip) obj.bindTooltip(String(label), { direction: "top" });

          obj.on?.("click", () => {
            // toggleSelect(row.__uid);
            showInfo(row.__uid);
          });

          rows.push(row);
          added++;
        }
      }

      console.log(`[map] ${key}: added ${added} features`);
      if (key === "roads" && group.bringToFront) group.bringToFront();
      return { group, rows, added };
    }

    async function go() {
      setLoading(true); setErr("");
      featureIndexRef.current = {};
      setSelected(new Set());
      try {
        const [ rd, toy] = await Promise.all([
  // loadLayer("customers", 2000),
  // loadLayer("orders", 2000),
  loadLayer("roads",  3000),
  // loadLayer("warehouses", 2000),
  loadLayer("toyota_dealers", 5000), // NEW
]);
const rows = [
  ...rd.rows,  ...toy.rows // NEW
];

        setAllRows(rows);

        // build route candidates from point features already on the map
        const pts = [];
        for (const [uid, entry] of Object.entries(featureIndexRef.current)) {
          if (entry.type === "point" && entry.pointLatLng) {
            pts.push({
              uid,
              label: guessLabel(entry.props) || (LAYER_META[entry.layerKey]?.label || entry.layerKey),
              lat: entry.pointLatLng.lat,
              lon: entry.pointLatLng.lng,
              layer: entry.layerKey,
            });
          }
        }
        setRouteCandidates(pts);

        const boundsList = [];
for (const g of Object.values(groupsRef.current)) {
  if (typeof g?.getBounds === "function") {
    const b = g.getBounds();
    if (b && typeof b.isValid === "function" && b.isValid()) {
      boundsList.push(b);
    }
  }
}

if (boundsList.length) {
  // normalize the first one into a LatLngBounds and then extend
  let all = window.L.latLngBounds(boundsList[0]);
  for (let i = 1; i < boundsList.length; i++) {
    all.extend(boundsList[i]);
  }
  if (all.isValid()) {
    map.fitBounds(all.pad(0.2));
  } else {
    map.setView(USA_CENTER, 4);
  }
} else {
  map.setView(USA_CENTER, 4);
}
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    go();
  }, [leafletReady]);

  /* ---------- NEW: apply layer visibility whenever it changes ---------- */
  useEffect(() => {
  const map = mapObjRef.current;
  if (!map) return;

  for (const [key, group] of Object.entries(groupsRef.current)) {
    if (!group) continue;

    const shouldShow = visibleLayers.has(key);
    const onMap = map.hasLayer(group);

    if (shouldShow && !onMap) {
      group.addTo(map);
      if (key === "roads" && group.bringToFront) group.bringToFront();
    } else if (!shouldShow && onMap) {
      map.removeLayer(group);
    } else if (shouldShow && key === "roads" && group.bringToFront) {
      // already on map—reassert z-order
      group.bringToFront();
    }
  }
}, [visibleLayers]);

  /* ---------- route planner helpers ---------- */
  // Show only candidates whose label matches the query (used by older typeahead UI)
  async function lookupAddress(kind, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      if (kind === "from") setFromOptions([]);
      else setToOptions([]);
      return;
    }

    const options = routeCandidates
      .filter((c) => (c.label || "").toLowerCase().includes(q))
      .slice(0, 30);

    if (kind === "from") {
      setFromOptions(options);
    } else {
      setToOptions(options);
    }
    setRouteError(options.length ? "" : "No matching locations from map data.");
  }

  function applyRouteVisibility(activeUids) {
    const map = mapObjRef.current;
    if (!map) return;

    const activeSet = activeUids && activeUids.length ? new Set(activeUids) : null;

    for (const [uid, entry] of Object.entries(featureIndexRef.current)) {
      const layer = entry.leafletObject;
      if (!layer) continue;

      // keep all path features (roads, polygons) visible
      if (entry.type === "path") continue;

      const shouldShow = !activeSet || activeSet.has(uid);
      const onMap = map.hasLayer(layer);

      if (shouldShow && !onMap) {
        layer.addTo(map);
      } else if (!shouldShow && onMap) {
        map.removeLayer(layer);
      }
    }
  }

  function selectLocation(kind, option) {
    if (kind === "from") {
      setFromLocation(option);
      setFromInput(option.label);
      setFromOptions([]);
    } else {
      setToLocation(option);
      setToInput(option.label);
      setToOptions([]);
    }
  }

  function clearRoute() {
    setRouteSummary(null);
    setRouteError("");
    setFromLocation(null);
    setToLocation(null);
    setFromInput("");
    setToInput("");

    // remove route line if present
    if (mapObjRef.current && window.__gisRouteLine) {
      const map = mapObjRef.current;
      if (map.hasLayer(window.__gisRouteLine)) {
        map.removeLayer(window.__gisRouteLine);
      }
    }

    // restore all points
    applyRouteVisibility(null);
  }

  async function handleEstimateRoute() {
    setRouteSummary(null);
    setRouteError("");

    if (!fromLocation || !toLocation) {
      setRouteError("Please choose both From and To locations.");
      return;
    }

    const mode =
      TRANSPORT_MODES.find((m) => m.id === transportMode) ||
      TRANSPORT_MODES[0];

    // Try to get a realistic road route from the backend
    let distanceMiles = NaN;
    let hours = NaN;

    try {
      setRouteLoading(true);
      const qs = new URLSearchParams({
        fromLat: String(fromLocation.lat),
        fromLon: String(fromLocation.lon),
        toLat: String(toLocation.lat),
        toLon: String(toLocation.lon),
      });
      const r = await fetch(`/api/route?${qs.toString()}`);
      const data = await r.json();

      if (r.ok && data?.ok && Array.isArray(data.coordinates) && data.coordinates.length > 1) {
        const coordPairs = data.coordinates.map((c) => ({
          lat: Number(c.lat),
          lon: Number(c.lon),
        }));

        // distance in meters -> miles
        if (Number.isFinite(data.distanceMeters)) {
          distanceMiles = data.distanceMeters / 1609.34;
        } else {
          distanceMiles = haversineMiles(
            { lat: fromLocation.lat, lon: fromLocation.lon },
            { lat: toLocation.lat, lon: toLocation.lon }
          );
        }

        hours = Number.isFinite(data.durationSeconds)
          ? data.durationSeconds / 3600
          : distanceMiles / (mode.mph || 1);

        // draw the route polyline using returned geometry
        if (mapObjRef.current && window.L) {
          const L = window.L;
          const map = mapObjRef.current;
          const latlngs = coordPairs.map((c) => [c.lat, c.lon]);

          if (!window.__gisRouteLine) {
            window.__gisRouteLine = L.polyline(latlngs, {
              color: "#22c55e",
              weight: 3,
              opacity: 0.9,
            }).addTo(map);
          } else {
            window.__gisRouteLine.setLatLngs(latlngs);
            if (!map.hasLayer(window.__gisRouteLine)) {
              window.__gisRouteLine.addTo(map);
            }
          }

          const bounds = window.__gisRouteLine.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.3));
          }
        }
      } else {
        throw new Error(data?.error || "No route found");
      }
    } catch (e) {
      // Fallback: straight-line distance + simple polyline
      setRouteError((prev) =>
        prev
          ? prev
          : "Could not get road route; using straight line estimate."
      );

      distanceMiles = haversineMiles(
        { lat: fromLocation.lat, lon: fromLocation.lon },
        { lat: toLocation.lat, lon: toLocation.lon }
      );
      hours = distanceMiles / (mode.mph || 1);

      if (mapObjRef.current && window.L) {
        const L = window.L;
        const map = mapObjRef.current;
        const latlngs = [
          [fromLocation.lat, fromLocation.lon],
          [toLocation.lat, toLocation.lon],
        ];

        if (!window.__gisRouteLine) {
          window.__gisRouteLine = L.polyline(latlngs, {
            color: "#22c55e",
            weight: 3,
            opacity: 0.9,
          }).addTo(map);
        } else {
          window.__gisRouteLine.setLatLngs(latlngs);
          if (!map.hasLayer(window.__gisRouteLine)) {
            window.__gisRouteLine.addTo(map);
          }
        }

        const bounds = window.__gisRouteLine.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.3));
        }
      }
    } finally {
      setRouteLoading(false);
    }

    if (!Number.isFinite(distanceMiles) || distanceMiles <= 0) {
      setRouteError(
        "Could not compute distance between the selected locations."
      );
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      hours = distanceMiles / (mode.mph || 1);
    }

    let departDate = departure ? new Date(departure) : new Date();
    if (Number.isNaN(departDate.getTime())) {
      departDate = new Date();
    }
    const arrivalDate = new Date(
      departDate.getTime() + hours * 3600 * 1000
    );

    setRouteSummary({
      distanceMiles,
      hours,
      mode,
      depart: departDate,
      arrive: arrivalDate,
    });

    // keep only the two chosen points visible
    applyRouteVisibility([fromLocation.uid, toLocation.uid]);
  }

  /* ---------- info helpers ---------- */
  function computeBoundsForEntry(entry) {
    const lo = entry?.leafletObject;
    if (!lo) return null;
    if (lo.getBounds) {
      const b = lo.getBounds();
      if (b && b.isValid && b.isValid()) return b;
    }
    if (lo.getLatLng) {
      const ll = lo.getLatLng();
      return window.L.latLngBounds([ll, ll]);
    }
    return null;
  }

  // Recursively set opacity for any Leaflet Layer/LayerGroup
function setLayerOpacity(layer, opacity) {
  if (!layer) return;
  if (layer.setOpacity) layer.setOpacity(opacity);
  if (layer.setStyle) {
    layer.setStyle({
      opacity,                               // stroke
      fillOpacity: Math.min(Math.max(opacity, 0.05), 0.6), // softer fill
    });
  }
  if (layer.eachLayer) layer.eachLayer(l => setLayerOpacity(l, opacity));
}

  function showInfo(uid) {
    const entry = featureIndexRef.current[uid];
    if (!entry) return;
    const title = guessLabel(entry.props) || (LAYER_META[entry.layerKey]?.label || entry.layerKey);
    const bounds = computeBoundsForEntry(entry);
    setInfo({ uid, title, props: entry.props, bounds });
  }

  function zoomToInfo() {
    if (!info?.bounds || !mapObjRef.current) return;
    mapObjRef.current.fitBounds(info.bounds.pad(0.25));
  }

  /* ---------- selection sync ---------- */
  const toggleSelect = (uid) => {
    setSelected(prev => {
      const p = new Set(prev);
      if (p.has(uid)) {
        p.delete(uid);
        const f = featureIndexRef.current[uid];
        if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 2, opacity: 0.9 });
      } else {
        p.add(uid);
        const f = featureIndexRef.current[uid];
        if (f?.leafletObject?.bringToFront) f.leafletObject.bringToFront();
        if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 4, opacity: 1 });
        // showInfo(uid);
      }
      return p;
    });
  };
  const clearSelection = () => {
    setSelected(prev => {
      for (const uid of prev) {
        const f = featureIndexRef.current[uid];
        if (f?.leafletObject?.setStyle) f.leafletObject.setStyle({ weight: 2, opacity: 0.9 });
      }
      return new Set();
    });
  };

  /* ---------- table view model ---------- */
  // Build columns from what's actually visible
const columns = useMemo(() => {
  // NEW (layer filter): restrict sample to visible layers
  const visible = allRows.filter(r => visibleLayers.has(r.__layer)); // NEW
  const cols = ["", "layer", "name"];
  const sample = visible[0] || {};     // NEW
  const keys = Object.keys(sample).filter(k => !k.startsWith("__") && !cols.includes(k));
  for (const k of ["WAREHOUSE_ID","CUSTOMER_ID","ORDER_ID","TYPE","STATE","UNIT_CODE","LON","LAT"])
    if (keys.includes(k)) cols.push(k);
  for (const k of keys) if (!cols.includes(k) && cols.length < 12) cols.push(k);
  return cols;
}, [allRows, visibleLayers]); // NEW dep

// Rows for the table (visible layers -> filters -> sort)
const filtered = useMemo(() => {
  // 1) layer visibility
  let rows = allRows.filter(r => visibleLayers.has(r.__layer)); // NEW (layer filter)

  // 2) column filters
  for (const [k, v] of Object.entries(filters)) {
    if (!v) continue;
    rows = rows.filter(r =>
      String(r[k] ?? "").toLowerCase().includes(String(v).toLowerCase())
    );
  }

  // 3) sort
  if (sort.col) {
    const { col, dir } = sort;
    rows.sort((a,b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")));
    if (dir === "desc") rows.reverse();
  }
  return rows;
}, [allRows, visibleLayers, filters, sort]); // NEW dep

  const total = filtered.length;
  const selectedCount = [...selected].filter(uid => filtered.some(r => r.__uid === uid)).length;

  /* ---------- export CSV ---------- */
  const exportCSV = () => {
    const rows = filtered.map(({__uid,__layer, ...r}) => ({ layer: __layer, ...r }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gis_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------- bottom panel resize ---------- */
  const startDrag = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelH;
    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      const nh = Math.min(Math.max(startH - dy, 140), window.innerHeight - 120);
      setPanelH(nh); bottomH.current = nh;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* ---------- styles ---------- */
  const ui = {
    badge: { background:"#0f1116", border:"1px solid #2c313c", borderRadius:8, padding:"6px 10px", color:"#e5e7eb", fontSize:12 },
    header: { display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#0b0e14", borderTop:"1px solid #1f2937", color:"#e5e7eb" },
    grid: { width:"100%", borderCollapse:"collapse", fontSize:13, color:"#e5e7eb" },
    th: { textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c", position:"sticky", top:0, background:"#0f1116", zIndex:1 },
    td: { padding:"9px 12px", borderBottom:"1px solid #161a22" },
    filter: { width:"100%", background:"#0b0f16", border:"1px solid #243042", color:"#e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:12 },
  };

  function InfoPanel({ info, onClose, onZoom }) {
    if (!info) return null;
    const entries = Object.entries(info.props || {})
      .filter(([k]) => !k.startsWith("__"))
      .sort(([a],[b]) => a.localeCompare(b));

    const cell = {
      padding: "10px 12px",
      borderBottom: "1px solid #1f2937",
      verticalAlign: "top",
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
    };

    return (
      <div style={{
        position:"absolute", top:70, left:60, zIndex:1200,
        width: 560, maxHeight: "70vh", overflow:"auto",
        background:"#0b0e14", color:"#e5e7eb",
        border:"1px solid #2c313c", borderRadius:10,
        boxShadow:"0 12px 32px rgba(0,0,0,.45)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10,
                      padding:"12px 14px", borderBottom:"1px solid #1f2937" }}>
          <div style={{ fontSize:20, fontWeight:800, lineHeight:1.1, flex:1 }}>
            nps establishment locations: {info.title}
          </div>
          <button onClick={onZoom} title="Zoom to"
            style={{ background:"transparent", border:"1px solid #334155", color:"#e5e7eb",
                     width:30, height:30, borderRadius:6, cursor:"pointer" }}>🔍</button>
          <button onClick={onClose} title="Close"
            style={{ background:"transparent", border:"1px solid #334155", color:"#e5e7eb",
                     width:30, height:30, borderRadius:6, cursor:"pointer" }}>✕</button>
        </div>

        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} style={{ background:"#0c1017" }}>
                <td style={{ ...cell, width:200, background:"#0f1116", color:"#cbd5e1", fontWeight:600 }}>{k}</td>
                <td style={cell}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
              </tr>
            ))}
            {!entries.length && (
              <tr><td colSpan={2} style={{ ...cell, color:"#9aa3b2" }}>No properties.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // NEW: exclusive toggle behavior for legend
  // function handleLegendClick(key) {
  //   setVisibleLayers((prev) => {
  //     // if already exclusive to this key, restore ALL
  //     const onlyThis =
  //       prev.size === 1 && prev.has(key);
  //     if (onlyThis) return new Set(ALL_KEYS);          // back to all
  //     return new Set([key]);                            // show only clicked layer
  //   });
  // }
  function handleLegendToggle(key) {
  setVisibleLayers(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // optional: keep at least one layer on
    // if (next.size === 0) next.add(key);
    return next;
  });
}


  const isAllVisible = visibleLayers.size === ALL_KEYS.length; // NEW

  return (
    <div style={{ position:"absolute", inset:0, background:"#0b0e14", display:"grid", gridTemplateRows:`1fr ${panelH}px` }}>
      {/* Map */}
      <div style={{ position:"relative" }}>
        <div ref={mapRef} style={{ position:"absolute", inset:0 }} />

        {/* quick nav */}
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            zIndex: 1200,
            display: "flex",
            gap: 8,
            background: "#0f1116",
            border: "1px solid #2c313c",
            borderRadius: 8,
            padding: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,.35)",
          }}
        >
          <button
            onClick={() => onNavigate?.("bloom")}
            title="Go to Graph"
            style={{
              background: "#1f2937",
              color: "#e5e7eb",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            GRAPH
          </button>
          <button
            onClick={() => onNavigate?.("forms")}
            title="Go to Forms"
            style={{
              background: "#0b1220",
              color: "#e5e7eb",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Forms
          </button>
        </div>

        {/* Route planner (From / To + mode + ETA) */}
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 64,
            zIndex: 1150,
            maxWidth: 520,
            width: 520,
            background: "#0f1116",
            border: "1px solid #2c313c",
            borderRadius: 10,
            padding: "10px 12px",
            boxShadow: "0 12px 32px rgba(0,0,0,.45)",
            color: "#e5e7eb",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>
              Route planner (US)
            </div>
            <button
              onClick={clearRoute}
              title="Clear route"
              style={{
                background: "transparent",
                border: "1px solid #4b5563",
                borderRadius: 6,
                width: 26,
                height: 26,
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.4fr 1fr",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            {/* From */}
            <div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>From</div>
              <select
                value={fromLocation?.uid || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const opt = routeCandidates.find((c) => c.uid === id) || null;
                  if (opt) {
                    selectLocation("from", opt);
                  } else {
                    setFromLocation(null);
                  }
                }}
                style={{
                  width: "100%",
                  background: "#0b0f16",
                  border: "1px solid #243042",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#e5e7eb",
                  fontSize: 12,
                }}
              >
                <option value="">Select origin from map</option>
                {routeCandidates.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* To */}
            <div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>To</div>
              <select
                value={toLocation?.uid || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const opt = routeCandidates.find((c) => c.uid === id) || null;
                  if (opt) {
                    selectLocation("to", opt);
                  } else {
                    setToLocation(null);
                  }
                }}
                style={{
                  width: "100%",
                  background: "#0b0f16",
                  border: "1px solid #243042",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#e5e7eb",
                  fontSize: 12,
                }}
              >
                <option value="">Select destination from map</option>
                {routeCandidates.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode + departure */}
            <div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>Mode & departure</div>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0b0f16",
                  border: "1px solid #243042",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#e5e7eb",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {TRANSPORT_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDepartureDate(v);
                    if (v) {
                      const t = departureTime || "00:00";
                      setDeparture(`${v}T${t}`);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: "#0b0f16",
                    border: "1px solid #243042",
                    borderRadius: 6,
                    padding: "6px 8px",
                    color: "#e5e7eb",
                    fontSize: 12,
                  }}
                />
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDepartureTime(v);
                    if (v) {
                      const d = departureDate || new Date().toISOString().slice(0, 10);
                      setDeparture(`${d}T${v}`);
                    }
                  }}
                  style={{
                    width: 110,
                    background: "#0b0f16",
                    border: "1px solid #243042",
                    borderRadius: 6,
                    padding: "6px 8px",
                    color: "#e5e7eb",
                    fontSize: 12,
                  }}
                />
              </div>
              <button
                onClick={handleEstimateRoute}
                disabled={routeLoading}
                style={{
                  width: "100%",
                  background: "#22c55e",
                  border: "1px solid #16a34a",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#022c22",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {routeLoading ? "Calculating..." : "Calculate"}
              </button>
            </div>
          </div>

          {routeError && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#fecaca" }}>
              {routeError}
            </div>
          )}

          {routeSummary && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#e5e7eb" }}>
              <div>
                Distance: ~{routeSummary.distanceMiles.toFixed(0)} miles · Mode:{" "}
                {routeSummary.mode.label}
              </div>
              <div>Travel time: {formatHours(routeSummary.hours)}</div>
              <div>Departs: {routeSummary.depart.toLocaleString()}</div>
              <div>Arrives: {routeSummary.arrive.toLocaleString()}</div>
            </div>
          )}
        </div>

        <InfoPanel info={info} onClose={() => setInfo(null)} onZoom={zoomToInfo} />

        {/* status badge */}
        <div style={{
          position:"absolute", left:12, top:20,
          zIndex:1100, background:"#0f1116", color:"#e5e7eb",
          border:"1px solid #2c313c", borderRadius:8, padding:"6px 10px", fontSize:12,
          boxShadow:"0 4px 16px rgba(0,0,0,.35)"
        }}>
          {loading ? "Loading layers…" : err ? `Error: ${err}` : "USA Map"}
        </div>

        {/* left micro-toolbar */}
        <div style={{ position:"absolute", left:12, top:56, zIndex:1100, display:"grid", gap:6 }}>
          <button
            onClick={() => mapObjRef.current.setView([39.8283,-98.5795], 4)}
            title="Reset to USA"
            style={{ background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
                     padding:"6px 8px", color:"#e5e7eb", fontSize:12, boxShadow:"0 2px 10px rgba(0,0,0,.3)" }}>
            🇺🇸
          </button>
          <button
            onClick={clearSelection}
            title="Clear selection"
            style={{ background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
                     padding:"6px 8px", color:"#e5e7eb", fontSize:12, boxShadow:"0 2px 10px rgba(0,0,0,.3)" }}>
            ✖︎
          </button>
        </div>

        {/* NEW: Left legend with checkboxes (exclusive toggle) */}
        <div style={{
          position:"absolute", left:12, bottom:12, zIndex:1001,
          background:"#0f1116", color:"#e5e7eb", border:"1px solid #2c313c",
          borderRadius:8, padding:"8px 10px", fontSize:12, lineHeight:1.5,
          boxShadow:"0 4px 16px rgba(0,0,0,.35)", minWidth:180
        }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>Layers</div>
          {ALL_KEYS.map((k) => {
  const meta = LAYER_META[k];
  const checked = visibleLayers.has(k);
  return (
    <label
      key={k}
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 4 }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => handleLegendToggle(k)}
      />
      <span style={{ width: 18, display: "inline-block", textAlign: "center" }}>
        {meta.emoji || "—"}
      </span>
      <span>{meta.label}</span>
    </label>
  );
})}
          <div style={{ marginTop:6, opacity:.7, fontSize:11 }}>
            Tip: Click a layer to show <strong>only</strong> that layer. Click it again to show <strong>all</strong>.
          </div>
        </div>

        {/* drag handle */}
        <div onMouseDown={startDrag} style={{ position:"absolute", left:0, right:0, bottom:panelH, height:6, cursor:"row-resize", background:"transparent" }} />
      </div>

      {/* Bottom table */}
      <div style={{ position:"relative", zIndex: 1000, borderTop:"1px solid #1f2937",
                    display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                      background:"#0b0e14", color:"#e5e7eb", borderBottom:"1px solid #1f2937" }}>
          <div style={{ fontWeight:800 }}>nps establishment locations</div>
          <div style={{ opacity:.7 }}>(Total: {total} | Selection: {selectedCount})</div>
          <div style={{ flex:1 }} />
          <button onClick={exportCSV}
                  style={{ background:"#0f1116", border:"1px solid #2c313c", borderRadius:8,
                           padding:"6px 10px", color:"#e5e7eb", fontSize:12, cursor:"pointer" }}>
            Export CSV
          </button>
        </div>

        {/* Column filters */}
        <div style={{ display:"grid", gridAutoFlow:"column", gap:0, padding:"8px 12px",
                      background:"#0b0e14", borderBottom:"1px solid #1f2937", overflowX:"auto" }}>
          {columns.map((c, i) => (
            <div key={i} style={{ minWidth: c === "" ? 36 : 160, paddingRight:10 }}>
              {c && c !== "" ? (
                <input
                  placeholder={c}
                  value={filters[c] || ""}
                  onChange={(e) => setFilters(s => ({ ...s, [c]: e.target.value }))}
                  style={{ width:"100%", background:"#0b0f16", border:"1px solid #243042",
                           color:"#e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:12 }}
                />
              ) : <div style={{ width: 24 }} />}
            </div>
          ))}
        </div>

        {/* Table body */}
        <div style={{ flex:1, overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, color:"#e5e7eb" }}>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i}
                      onClick={() => c && setSort(s => ({ col: c, dir: s.col === c && s.dir === "asc" ? "desc" : "asc" }))}
                      style={{ textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #2c313c",
                               position:"sticky", top:0, background:"#0f1116", zIndex:1 }}>
                    {c === "" ? "" : (c === "layer" ? "Layer" : c)}
                    {sort.col === c ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const isSel = selected.has(r.__uid);
                return (
                  <tr key={r.__uid} style={{ background: idx%2 ? "#0e131b" : "#0b0f16" }}>
                    <td style={{ padding:"9px 12px", borderBottom:"1px solid #161a22" }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r.__uid)} />
                    </td>
                    <td style={{ padding:"9px 12px", borderBottom:"1px solid #161a22", whiteSpace:"nowrap" }}>
                      {(LAYER_META[r.__layer]?.emoji || "📍")} {LAYER_META[r.__layer]?.label || r.__layer}
                    </td>
                    {columns.slice(2).map((c, i2) => (
                      <td key={i2} style={{ padding:"9px 12px", borderBottom:"1px solid #161a22",
                                            maxWidth: 280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r[c] == null ? "" : String(r[c])}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={columns.length}
                        style={{ padding:"12px", borderBottom:"1px solid #161a22", color:"#9aa3b2" }}>No rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
