import React, { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import NeighborhoodContainer from "./neighborhood-llm/NeighborhoodContainer.jsx";
import { GraphProvider } from "./neighborhood-llm/GraphContext.jsx";

// Lazy imports to avoid SSR issues and keep bundle smaller
// import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Pane } from "react-leaflet";
// import L from "leaflet";
import neo4j from "neo4j-driver";
// import CytoscapeComponent from "react-cytoscapejs";
// import NodeNeighborhoodPanel from "./NodeNeighborhoodPanel.jsx";
// import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from "../../config/env";
// import { toJSDeep } from "./helper";
import L from "leaflet";
// neo4j import is not needed unless you use neo4j.int(...) somewhere in this file
// import neo4j from "neo4j-driver";
import CytoscapeComponent from "react-cytoscapejs";
import NodeNeighborhoodPanel from "./NodeNeighborhoodPanel.jsx";
import { createDriver } from "@/neo4jFacade";
import { toJSDeep } from "./helper";

/** --------- Config --------- */
// const LS_KEY = "zipCache_v1";
// Local JSON ZIP->centroid lookup (place file in /public)
const ZIP_JSON_URL = "/zip-centroids.json";
// Where your server proxy lives (kept as fallback)
// const GEOCODE_PROXY = "/api/geocode";
const ZIP_PROP_KEYS = [
"zip",
"zipcode",
"zip_code",
"postalcode",
"postal_code",
];




const ICON_PRESETS = [
{
  label: "Vehicles",
  matches: ["vehicles", "vehicle"],
  emoji: "🚗",
  // bg: "#2563eb",
},
{
  label: "Catalogs",
  matches: ["catalogs", "catalog"],
  emoji: "📚",
  bg: "#22c55e",
},
{
  label: "Suppliers",
  matches: ["suppliers", "supplier"],
  emoji: "🏭",
  // bg: "#f59e0b",
},
{
  label: "Distribution Centers",
  matches: ["distributioncenters", "distributioncenter", "distribution"],
  emoji: "🏬",
  // bg: "#6366f1",
},
{
  label: "Dealerships",
  matches: ["dealerships", "dealership", "dealer"],
  emoji: "🚘",
  // bg: "#ec4899",
},
{
  label: "Parts",
  matches: ["parts", "part"],
  emoji: "🧩",
  bg: "#14b8a6",
},
{
  label: "Orders",
  matches: ["orders", "order"],
  emoji: "📦",
  bg: "#fb923c",
},
{
  label: "Disruptions",
  matches: ["disruptions", "disruption", "incident"],
  emoji: "⚠️",
  bg: "#ef4444",
},
];




const DEFAULT_ICON = { label: "Other", emoji: "📍", bg: "#0ea5e9" };
const REL_PREVIEW_LIMIT = 6;




const pickIconPreset = (labels = []) => {
const normalized = (Array.isArray(labels) ? labels : [])
  .map((label) => String(label || "").toLowerCase())
  .filter(Boolean);




for (const preset of ICON_PRESETS) {
  if (
    normalized.some((label) =>
      preset.matches.some((match) => match && label.includes(match))
    )
  ) {
    return preset;
  }
}
return DEFAULT_ICON;
};




/** Load/save cache (localStorage) */
// const readCache = () => {
//   try {
//     return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
//   } catch {
//     return {};
//   }
// };
// const writeCache = (obj) => {
//   try {
//     localStorage.setItem(LS_KEY, JSON.stringify(obj));
//   } catch {}
// };




/** Extract the first 5-digit US ZIP from a value */
const extractZip = (value) => {
const digits = String(value ?? "").replace(/\D/g, "");
if (digits.length < 5) return null;
return digits.slice(0, 5);
};




// --- ZIP helpers for tolerant JSON lookup ---
const pad5 = (z) => (z ?? "").toString().padStart(5, "0");




function getLatLon(entry) {
if (!entry || typeof entry !== "object") return { lat: null, lon: null };




// top-level first
let rawLat =
  entry.lat ?? entry.latitude ?? entry.Lat ?? entry.Latitude ?? null;
let rawLon =
  entry.lon ??
  entry.lng ??
  entry.longitude ??
  entry.Lon ??
  entry.Lon ?? // some files use capitalized keys
  entry.Longitude ??
  null;




// nested objects (your case: geo_point_2d)
if (rawLat == null || rawLon == null) {
  const gp = entry.geo_point_2d ?? entry.geo ?? entry.location ?? null;
  if (gp && typeof gp === "object") {
    rawLat = rawLat ?? gp.lat ?? gp.latitude ?? (Array.isArray(gp) ? gp[1] : null);
    rawLon = rawLon ?? gp.lon ?? gp.lng ?? gp.longitude ?? (Array.isArray(gp) ? gp[0] : null);
  }
}




// arrays like coordinates: [lon, lat]
if ((rawLat == null || rawLon == null) && Array.isArray(entry.coordinates)) {
  rawLon = rawLon ?? entry.coordinates[0];
  rawLat = rawLat ?? entry.coordinates[1];
}




const lat = rawLat != null ? parseFloat(rawLat) : null;
const lon = rawLon != null ? parseFloat(rawLon) : null;




return { lat, lon };
}
// NEW: derive a 2-letter state code for a marker
function getMarkerStateCode(marker) {
// Prefer the enriched stateAbbr if present
if (marker?.stateAbbr) return String(marker.stateAbbr).toUpperCase();




// Fallback: try node properties if your graph already stores state info
const p = marker?.rawProperties || {};
const raw =
  p.state_abbr ??
  p.stateAbbr ??
  p.stusps ??
  p.usps ??
  p.state ??
  p.State ??
  null;




if (!raw) return "";
const s = String(raw).trim().toUpperCase();
// If it's a full name, you can map to 2-letter here if desired.
// For now just return uppercase; your dataset usually has 2-letter already.
return s.length === 2 ? s : s;
}




function getStateAbbr(entry) {
if (!entry || typeof entry !== "object") return null;
const raw =
  entry.state_abbr ??
  entry.stateAbbr ??
  entry.state ??
  entry.State ??
  entry.STATE ??
  entry.stusps ??
  entry.STUSPS ??
  entry.usps ??
  entry.USPS ??
  null;
if (!raw) return null;
const s = String(raw).trim();
return s.length === 2 ? s.toUpperCase() : s.toUpperCase();
}




function findZipEntry(lookup, zip5) {
if (!lookup) return null;




// Object map case: { "02139": {...}, 10001: {...} }
if (!Array.isArray(lookup)) {
  if (zip5 in lookup) return lookup[zip5];
  const noLeading = String(Number(zip5)); // "02139" -> "2139"
  if (noLeading in lookup) return lookup[noLeading];
  const hitKey = Object.keys(lookup).find((k) => pad5(k) === zip5);
  if (hitKey) return lookup[hitKey];
  return null;
}




// Array case: [{zip:"02139", lat, lon}, {postal_code:10001, latitude, longitude}, ...]
const row = lookup.find((r) => {
  if (!r || typeof r !== "object") return false;
  const zv =
    r.zip ??
    r.zipcode ??
    r.zip_code ??
    r.postalcode ??
    r.postal_code ??
    r.ZIP ??
    r.Zip ??
    r.PostalCode ??
    r.postalCode;
  if (!zv) return false;
  const normalized = pad5(String(zv).replace(/\D/g, "").slice(0, 5));
  return normalized === zip5;
});
return row || null;
}




/** Fit map to markers once they’re known */
function FitToMarkers({ points }) {
const map = useMap();
const didFit = useRef(false);




useEffect(() => {
  if (!map || didFit.current || !points?.length) return;
  const latlngs = points.map((p) => L.latLng(p.lat, p.lon));
  const bounds = L.latLngBounds(latlngs);
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30] });
    didFit.current = true;
  }
}, [map, points]);




return null;
}




/** Legend component (overlays on the map) */
function Legend({ theme, t, usedPresets, counts }) {
 if (!usedPresets?.length) return null;
 return (
   <div
     style={{
       position: "absolute",
       left: 8,
       bottom: 8,
       maxWidth: 360,
       background:
         theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(15,17,22,0.85)",
       border: `1px solid ${t.border}`,
       borderRadius: 10,
       padding: "8px 10px",
       boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
       color: t.text,
       zIndex: 1000,
       pointerEvents: "auto",
     }}
   >
     <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>
       Legend
     </div>
     <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
       {usedPresets.map((p) => (
         <div
           key={p.label}
           title={p.label}
           style={{
             display: "flex",
             alignItems: "center",
             gap: 6,
             border: `1px solid ${t.border}`,
             background: t.cardBg,
             borderRadius: 8,
             padding: "4px 6px",
           }}
         >
           {/* emoji only—no colored square/pill */}
           <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
             {p.emoji}
           </span>
           <span style={{ fontSize: 12 }}>
             {p.label} ({counts?.get(p.label) ?? 0})
           </span>
         </div>
       ))}
     </div>
   </div>
 );
}


/** Graph legend (fixed overlay that doesn't move with pan/zoom) */
function GraphLegend({ theme, t }) {
return (
  <div
    style={{
      position: "absolute",
      left: 8,
      bottom: 8,
      background:
        theme === "light"
          ? "rgba(255,255,255,0.9)"
          : "rgba(15,17,22,0.85)",
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "8px 10px",
      boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
      color: t.text,
      zIndex: 1000,
      pointerEvents: "auto",
      maxWidth: 360,
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
      Graph Legend
    </div>
    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.4 }}>
      <li>
        <strong>Node</strong>: {theme === "light" ? "blue" : "light blue"} circle
        with label
      </li>
      <li>
        <strong>Selected</strong>: highlighted border (amber)
      </li>
      <li>
        <strong>Edge</strong>: line with triangle arrow; label shows relationship
        type
      </li>
      <li>
        <strong>Tip</strong>: click a node to center the map on its ZIP location
      </li>
    </ul>
  </div>
);
}




/** Props:
* - theme: 'dark'|'light' (from GraphBloomClone)
* - visible: bool (optional, default true)
* - zIndex: number (optional; defaults to 85 so it sits above tables)
*/
export default function MapOverlayFromZip({
theme = "dark",
visible = true,
zIndex = 85,
}) {
const [markers, setMarkers] = useState([]); // [{ zip, lat, lon, node, relationships }]
const [loading, setLoading] = useState(false);
const [expanded, setExpanded] = useState(false);
const [showGraph, setShowGraph] = useState(false);
const [error, setError] = useState(null);
// NEW: user-entered state filter (2-letter)
// NEW: dropdown selection ("" = All)
const [selectedState, setSelectedState] = useState("");
const [showTrendsInExpanded, setShowTrendsInExpanded] = useState(false);

// Edge display controls
// Edge display controls
const [edgeMode, setEdgeMode] = useState("hover"); // 'none' | 'hover' | 'selected' | 'all'
const [maxEdges, setMaxEdges] = useState(200);
const [minZoomForEdges, setMinZoomForEdges] = useState(3);


const [mapZoom, setMapZoom] = useState(4);


// Selection sync + hover
const [selectedNodeId, setSelectedNodeId] = useState(null);
const [hoveredNodeId, setHoveredNodeId] = useState(null);

//NEW
// Nodes marked offline (green X). Local-only; never written to DB.
const [offlineIds, setOfflineIds] = useState(() => new Set());
const toggleOffline = (id) =>
  setOfflineIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

// Selection sync between map and graph
// Track which node the mouse is over (for edgeMode='hover')








// Local ZIP lookup cache (loaded once)
const zipLookupRef = useRef(null);




// Leaflet map ref for syncing from Cytoscape
const leafletMapRef = useRef(null);
const disableMapInteractions = () => {
const m = leafletMapRef.current;
if (!m) return;
m.dragging?.disable?.();
m.scrollWheelZoom?.disable?.();
m.doubleClickZoom?.disable?.();
m.touchZoom?.disable?.();
m.boxZoom?.disable?.();
m.keyboard?.disable?.();
};




const enableMapInteractions = () => {
const m = leafletMapRef.current;
if (!m) return;
m.dragging?.enable?.();
m.scrollWheelZoom?.enable?.();
m.doubleClickZoom?.enable?.();
m.touchZoom?.enable?.();
m.boxZoom?.enable?.();
m.keyboard?.enable?.();
};




//   const handleMapCreated = (map) => {
//   leafletMapRef.current = map;
//   if (!map.getPane("edges")) {
//     const pane = map.createPane("edges");
//     pane.style.zIndex = 650;
//     pane.style.pointerEvents = "none";
//   }
// };
const handleMapCreated = (map) => {
 leafletMapRef.current = map;
 // keep mapZoom in React state so useMemo(...) recomputes on zoom
 setMapZoom(map.getZoom());
 map.on("zoomend", () => setMapZoom(map.getZoom()));
};




// Current map zoom (0 if not ready)
// Current map zoom (0 if not ready)
const getMapZoom = () => leafletMapRef.current?.getZoom?.() ?? 0;


const iconCacheRef = useRef(new Map());




// const getMarkerIcon = (labels = []) => {
//  const preset = pickIconPreset(labels);


//  // emoji-only icon (no background, no border/shadow)
//  return new L.DivIcon({
//    className: "zip-emoji-pin",
//    html: `
//      <div style="
//        display:flex;align-items:center;justify-content:center;
//        font-size:22px; line-height:1;
//        transform: translate(-12px, -22px);
//      ">
//        ${preset.emoji}
//      </div>
//    `,
//    iconSize: [24, 24],
//    iconAnchor: [12, 24],
//    popupAnchor: [0, -20],
//  });
// };
//NEW
const getMarkerIcon = (labels = [], isOffline = false) => {
  const preset = pickIconPreset(labels);

  // emoji-only icon with optional green X overlay
  return new L.DivIcon({
    className: "zip-emoji-pin",
    html: `
      <div style="position:relative; transform: translate(-12px, -22px);">
        <div style="display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">
          ${preset.emoji}
        </div>
        ${
          isOffline
            ? `
          <svg width="24" height="24"
               style="position:absolute; left:0; top:0; pointer-events:none;">
            <line x1="2" y1="2" x2="22" y2="22"
                  stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
            <line x1="22" y1="2" x2="2" y2="22"
                  stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
          </svg>`
            : ""
        }
      </div>
    `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -20],
  });
};

const describeValue = (value) => {
  if (value == null) return "(null)";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(empty)";
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json === "{}" ? "(object)" : json;
    } catch {
      return String(value);
    }
  }
  return String(value);
};




// Short, human-friendly label for the "other" node in a relationship
const summarizeOtherNode = (otherLabels = [], otherProps = {}) => {
const lbl =
  (Array.isArray(otherLabels) && otherLabels[0]) ||
  otherLabels?.toString() ||
  "node";




// try to show something recognizable: name/title/id/zip
const nameish =
  otherProps.name ??
  otherProps.title ??
  otherProps.id ??
  otherProps.identifier ??
  otherProps.code ??
  otherProps.number ??
  otherProps[Object.keys(otherProps).find(k => /^name|title$/i.test(k))] ??
  null;




// show a zip if present (your ZIP_PROP_KEYS)
// NEW helper: pull state abbreviation (or uppercase state name) from ZIP JSON row




const zipish =
  otherProps.zip ??
  otherProps.zipcode ??
  otherProps.zip_code ??
  otherProps.postalcode ??
  otherProps.postal_code ??
  null;




if (nameish && zipish) return `${lbl} — ${nameish} (${zipish})`;
if (nameish) return `${lbl} — ${nameish}`;
if (zipish) return `${lbl} — ${zipish}`;
return lbl;
};




// Make popup content scrollable and stop map drag while hovering/touching it
// --- put this near your other helpers, above renderPopupContent ---
const __popupScrollCache = new Map(); // cache across mounts




function PopupScroll({ children, maxHeight = 300, cacheKey = "default" }) {
const ref = useRef(null);




useEffect(() => {
  const el = ref.current;
  if (!el) return;




  // restore previous scrollTop (if any)
  const prev = __popupScrollCache.get(cacheKey) || 0;
  el.scrollTop = prev;




  // lock interactions inside the popup
  L.DomEvent.disableClickPropagation(el);
  L.DomEvent.disableScrollPropagation(el);




  const onWheel = (e) => {
    e.stopPropagation();
    const atTop = el.scrollTop === 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight;
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  };
  const onScroll = () => {
    __popupScrollCache.set(cacheKey, el.scrollTop);
  };




  let lastY = 0;
  const onTouchStart = (e) => {
    lastY = e.touches?.[0]?.clientY ?? 0;
    e.stopPropagation();
  };
  const onTouchMove = (e) => {
    const y = e.touches?.[0]?.clientY ?? 0;
    const dy = y - lastY;
    lastY = y;




    const atTop = el.scrollTop === 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight;
    if ((atTop && dy > 0) || (atBottom && dy < 0)) {
      e.preventDefault();
    }
    e.stopPropagation();
  };




  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("scroll", onScroll, { passive: true });
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchmove", onTouchMove, { passive: false });




  return () => {
    // save scrollTop on unmount too
    if (ref.current) __popupScrollCache.set(cacheKey, ref.current.scrollTop);
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("scroll", onScroll);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
  };
}, [cacheKey, children]);




return (
  <div
    ref={ref}
    style={{
      maxHeight,
      overflowY: "auto",
      overscrollBehavior: "contain",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "thin",
      touchAction: "pan-y",
    }}
  >
    {children}
  </div>
);
}




// Popup shows ONLY node properties (no relationships)
const renderPopupContent = (p) => {
const rels = Array.isArray(p.relationships) ? p.relationships : [];
const preview = rels.slice(0, REL_PREVIEW_LIMIT);
const remaining = Math.max(0, rels.length - preview.length);




const dirBadge = (dir) => (
  <span style={{
    fontSize: 10, padding: "1px 6px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)", background: "#f1f5f9",
    marginRight: 6, display: "inline-block",
  }}>
    {dir === "OUT" ? "→ OUT" : "← IN"}
  </span>
);




return (
  <PopupScroll maxHeight={300} cacheKey={p.id}>
    <div style={{ fontSize: 12, maxWidth: 280 }}>
      <div>
        <strong>Labels:</strong>{" "}
        {p.labels.length ? p.labels.join(", ") : "(none)"}
      </div>
      <div>
        <strong>ZIP{p.zipKey ? ` (${p.zipKey})` : ""}:</strong> {p.zip}
      </div>
      <div>
        <strong>Coordinates:</strong> {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
      </div>




      <div style={{ marginTop: 8 }}>
        <strong>Properties</strong>
        <ul style={{ listStyle: "disc", paddingLeft: 16, margin: "4px 0" }}>
          {p.properties.map(([k, v]) => (
            <li key={k} style={{ marginBottom: 2, fontWeight: k === p.zipKey ? 600 : 400 }}>
              <span style={{ fontWeight: 600 }}>{k}:</span> {describeValue(v)}
            </li>
          ))}
        </ul>
      </div>




      {false && rels.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>Relationships</strong>{" "}
          <span style={{ opacity: 0.7 }}>({rels.length} total)</span>
          <ul style={{ listStyle: "none", paddingLeft: 0, margin: "6px 0 0 0" }}>
            {preview.map((r) => (
              <li
                key={r.id || `${r.otherId}:${r.type}:${r.direction}`}
                style={{
                  marginBottom: 6,
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {dirBadge(r.direction)}
                  <span style={{ fontWeight: 600 }}>{r.type || "(type)"}</span>
                </div>
                <div style={{ marginTop: 2, opacity: 0.9 }}>
                  {summarizeOtherNode(r.otherLabels, r.otherProperties)}
                </div>
                {r.properties && Object.keys(r.properties).length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(r.properties).slice(0, 4).map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 10,
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: 10,
                          padding: "2px 6px",
                          background: "#f8fafc",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`${k}: ${describeValue(v)}`}
                      >
                        <strong>{k}:</strong> {describeValue(v)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
              …and {remaining} more
            </div>
          )}
        </div>
      )}
    </div>
  </PopupScroll>
);
};




// Tile URLs without API keys
const tiles = useMemo(
  () =>
    theme === "light"
      ? {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attr:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        }
      : {
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          attr: '&copy; <a href="https://carto.com/attributions">CARTO</a> & OSM',
        },
  [theme]
);
// Theme-aware panel colors
const t = useMemo(
  () =>
    theme === "light"
      ? {
          panelBg: "#f8fafc",
          cardBg: "#f1f5f9",
          border: "#e5e7eb",
          text: "#0b1219",
        }
      : {
          panelBg: "#0f1116",
          cardBg: "#15171d",
          border: "#2c313c",
          text: "#e5e7eb",
        },
  [theme]
);

+ // keep a stable layout object so react-cytoscapejs doesn’t relayout on every render const presetLayout = useMemo(() => ({ name: "preset" }), []);

useEffect(() => {
  if (!visible) return;




  let cancelled = false;
  let driver = null;
  let session = null;




  const fetchData = async () => {
    setLoading(true);
    setError(null);




    try {
      // if (!NEO4J_URI || !NEO4J_USER) {
      //   throw new Error(
      //     "Neo4j credentials are missing. Check your .env.local file."
      //   );
      // }




      // 1) Load local ZIP lookup once (if not already)
      if (!zipLookupRef.current) {
const resZip = await fetch(ZIP_JSON_URL);
if (!resZip.ok) {
  throw new Error("Failed to load zip-centroids.json");
}
zipLookupRef.current = await resZip.json();




// quick sanity log
console.log("ZIP JSON loaded", {
  type: Array.isArray(zipLookupRef.current) ? "array" : "object",
  sample: Array.isArray(zipLookupRef.current)
    ? zipLookupRef.current?.[0]
    : Object.keys(zipLookupRef.current).slice(0, 3),
});
}








      // 2) Query Neo4j
      // driver = neo4j.driver(
      //   NEO4J_URI,
      //   neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD || "")
      // );
      // session = driver.session({ defaultAccessMode: neo4j.session.READ });
      // 2) Query Neo4j (via backend facade; read-only)
      driver = createDriver();
      session = driver.session({ defaultAccessMode: neo4j.session.READ });





      const query = `
        WITH $zipKeys AS zipKeys
        MATCH (n)
        WITH n, [k IN keys(n) WHERE toLower(k) IN zipKeys] AS matching
        WHERE size(matching) > 0
        WITH n, matching[0] AS zipKey
        OPTIONAL MATCH (n)-[r]-(m)
        WITH n, zipKey, collect(CASE
          WHEN r IS NULL THEN NULL
          ELSE {
            relId: elementId(r),
            relType: type(r),
            relProps: properties(r),
            direction: CASE WHEN startNode(r)=n THEN 'OUT' ELSE 'IN' END,
            otherNode: CASE
              WHEN m IS NULL THEN NULL
              ELSE {
                id: elementId(m),
                labels: labels(m),
                properties: properties(m)
              }
            END
          }
        END) AS rels
        WITH n, zipKey, [rel IN rels WHERE rel IS NOT NULL] AS relationships
        RETURN n, zipKey, relationships
      `;




      const res = await session.run(query, {
        zipKeys: ZIP_PROP_KEYS.map((k) => k.toLowerCase()),
      });
      await session.close();
      session = null;




      const baseMarkers = res.records
.map((record) => {
  const node = record.get("n");
  if (!node) return null;
  const labels = node.labels ?? [];
  const props = toJSDeep(node.properties ?? {});
  const zipKey = record.get("zipKey");
  const zipRaw = props?.[zipKey];
  const zip = extractZip(zipRaw);
  if (!zip) return null;




  const relationshipsRaw = record.get("relationships") || [];
  const relationships = toJSDeep(relationshipsRaw).map((rel) => ({
    id: rel?.relId ?? "",
    type: rel?.relType ?? rel?.type ?? "",
    direction: rel?.direction ?? "",
    properties: rel?.relProps ?? {},
    otherLabels: rel?.otherNode?.labels ?? [],
    otherProperties: rel?.otherNode?.properties ?? {},
    otherId: rel?.otherNode?.id ?? "",
  }));




  const sortedProps = Object.entries(props ?? {}).sort((a, b) =>
    a[0].localeCompare(b[0])
  );




  const identity = node.elementId;




  return {
    id: `${identity || ""}-${zip}`,
    nodeId: identity || `${zip}`,
    labels,
    properties: sortedProps,
    rawProperties: props,
    zipKey,
    zip,
    relationships,
    lat: null,
    lon: null,
    status: "pending",
  };
})
.filter(Boolean);




      if (cancelled) return;




     // Resolve coordinates using ONLY the local JSON lookup (no API, no localStorage)
// Resolve coordinates using ONLY the local JSON lookup (no API, no localStorage)
const enriched = baseMarkers.map((marker) => {
const zip5 = pad5(marker.zip);
const raw = findZipEntry(zipLookupRef.current, zip5);
const { lat, lon } = getLatLon(raw);
const stateAbbr = getStateAbbr(raw);




if (Number.isFinite(lat) && Number.isFinite(lon)) {
  return { ...marker, lat, lon, stateAbbr, status: "ok" };
}
console.warn("No coords for ZIP in JSON", { zip: marker.zip, normalized: zip5, raw });
return { ...marker, stateAbbr, status: "missing" };
});
setMarkers(enriched);
















    } catch (err) {
      if (!cancelled) {
        console.error("Failed to load ZIP markers", err);
        setError(err?.message || "Failed to load ZIP markers.");
        setMarkers([]);
      }
    } finally {
      if (session) {
        session.close().catch(() => {});
        session = null;
      }
      if (driver) {
        driver.close().catch(() => {});
        driver = null;
      }
      if (!cancelled) setLoading(false);
    }
  };




  fetchData();




  return () => {
    cancelled = true;
    if (session) session.close().catch(() => {});
    if (driver) driver.close().catch(() => {});
  };
}, [visible]);




// NEW: normalize and filter by state
// const normalizedFilter = (filterState || "").trim().toUpperCase();




// NEW: unique list of available states from the data
const displayMarkers = useMemo(() => {
if (!selectedState) return markers; // "" means "All"
return markers.filter((m) => getMarkerStateCode(m) === selectedState.toUpperCase());
}, [markers, selectedState]);








const stateOptions = useMemo(() => {
const set = new Set();
for (const m of markers) {
  const code = getMarkerStateCode(m);
  if (code) set.add(code);
}
return Array.from(set).sort(); // e.g., ["AZ","CA","NY",...]
}, [markers]);








// const displayMarkers = useMemo(() => {
//   if (!normalizedFilter) return markers;
//   return markers.filter((m) => String(m.stateAbbr || "").toUpperCase() === normalizedFilter);
// }, [markers, normalizedFilter]);








const points = displayMarkers.filter(
(r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)
);








// === Cytoscape elements built from markers/relationships ===
const allNodes = useMemo(() => displayMarkers, [displayMarkers]);








const cyElements = useMemo(() => {
  const idSet = new Set(allNodes.map((n) => n.nodeId));
  const els = [];




  // Nodes
  for (const n of allNodes) {
    els.push({
      data: {
        id: n.nodeId,
        label: (n.labels && n.labels[0]) || "node",
        zip: n.zip,
      },
      classes: selectedNodeId === n.nodeId ? "selected" : "",
    });
  }




  // Edges
  // for (const n of allNodes) {
  //   for (const rel of n.relationships || []) {
  //     if (!rel.otherId) continue;
  //     if (!idSet.has(rel.otherId)) continue; // only draw edges when both ends are present




  //     const dirOut = rel.direction === "OUT";
  //     const source = dirOut ? n.nodeId : rel.otherId;
  //     const target = dirOut ? rel.otherId : n.nodeId;




  //     els.push({
  //       data: {
  //         id: rel.id || `${source}->${target}:${rel.type}`,
  //         source,
  //         target,
  //         label: rel.type || "",
  //       },
  //     });
  //   }
  // }




  return els;
}, [allNodes, selectedNodeId]);




// Marker click → select in graph and (optionally) highlight
const onMarkerClick = (nodeId, lat, lon) => {
  setSelectedNodeId(nodeId);
  if (leafletMapRef.current && lat != null && lon != null) {
    leafletMapRef.current.flyTo(
      [lat, lon],
      Math.max(leafletMapRef.current.getZoom(), 6),
      { duration: 0.6 }
    );
  }
};




// Build legend only for presets actually used by loaded markers
const usedPresets = useMemo(() => {
  const seen = new Map();
  let hasDefault = false;
  for (const m of displayMarkers) {
    const preset = pickIconPreset(m.labels);
    if (preset === DEFAULT_ICON) {
      hasDefault = true;
    } else if (!seen.has(preset.label)) {
      seen.set(preset.label, preset);
    }
  }
  const arr = Array.from(seen.values());
  if (hasDefault) arr.push(DEFAULT_ICON);
  return arr;
}, [displayMarkers]);




const legendCounts = useMemo(() => {
const map = new Map();
for (const m of displayMarkers) {
  const label = pickIconPreset(m.labels).label;
  map.set(label, (map.get(label) || 0) + 1);
}
return map;
}, [displayMarkers]);




// NEW: draw relationship edges (with arrowheads) on the map, in a high-zIndex pane
// const mapEdges = useMemo(() => {
//   const byId = new Map(
//     markers
//       .filter(
//         (m) =>
//           m.nodeId &&
//           Number.isFinite(m.lat) &&
//           Number.isFinite(m.lon)
//       )
//       .map((m) => [m.nodeId, m])
//   );




//   const seen = new Set();
//   const edges = [];




//   for (const n of markers) {
//     if (!Number.isFinite(n.lat) || !Number.isFinite(n.lon)) continue;




//     for (const rel of n.relationships || []) {
//       const other = byId.get(rel.otherId);
//       if (!other) continue;




//       const dirOut = rel.direction === "OUT";
//       const source = dirOut ? n : other;
//       const target = dirOut ? other : n;




//       // final safety
//       if (
//         !Number.isFinite(source.lat) ||
//         !Number.isFinite(source.lon) ||
//         !Number.isFinite(target.lat) ||
//         !Number.isFinite(target.lon)
//       ) continue;




//       const id = rel.id || `${source.nodeId}->${target.nodeId}:${rel.type}`;
//       if (seen.has(id)) continue;
//       seen.add(id);




//       edges.push({
//         id,
//         type: rel.type || "",
//         source,
//         target,
//         positions: [
//           [source.lat, source.lon],
//           [target.lat, target.lon],
//         ],
//       });
//     }
//   }
//   return edges;
// }, [markers]);


function controlPointForArc(a, b, curvatureKm = 650) {
 // Perpendicular offset from the midpoint; planar approximation is fine for US maps
 const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
 const dx = b.lon - a.lon;
 const dy = b.lat - a.lat;
 const mag = Math.hypot(dx, dy) || 1;


 // perpendicular unit vector
 const px = -dy / mag;
 const py =  dx / mag;


 // km -> degrees conversion (lat-dependent for lng)
 const kmPerDegLat = 110.574;
 const kmPerDegLng = 111.320 * Math.cos((mid.lat * Math.PI) / 180);


 const offLng = (curvatureKm / kmPerDegLng) * px;
 const offLat = (curvatureKm / kmPerDegLat) * py;


 return { lat: mid.lat + offLat, lon: mid.lon + offLng };
}


function bezierCurvePoints(a, c, b, segments = 64) {
 // a,c,b are {lat, lon}; returns an array of [lat, lon] along the curve
 const pts = [];
 for (let i = 0; i <= segments; i++) {
   const t = i / segments;
   const one = 1 - t;
   const lat =
     one * one * a.lat + 2 * one * t * c.lat + t * t * b.lat;
   const lon =
     one * one * a.lon + 2 * one * t * c.lon + t * t * b.lon;
   pts.push([lat, lon]);
 }
 return pts;
}


// Helper: compute bearing (deg) from src(lat,lon) to dst(lat,lon)
// Helper: compute bearing (deg) from src(lat,lon) to dst(lat,lon)
function bearingDeg(a, b) {
 const toRad = (x) => (x * Math.PI) / 180;
 const toDeg = (x) => (x * 180) / Math.PI;
 const φ1 = toRad(a.lat);
 const φ2 = toRad(b.lat);
 const Δλ = toRad(b.lon - a.lon);
 const y = Math.sin(Δλ) * Math.cos(φ2);
 const x =
   Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ) - Math.sin(φ1) * Math.sin(φ2);
 const θ = Math.atan2(y, x);
 return (toDeg(θ) + 360) % 360;
}


const mapEdges = useMemo(() => {
 // Respect mode + zoom
 if (edgeMode === "none" || mapZoom < minZoomForEdges) return [];


 // All nodes with coordinates (any state)
 const byIdAll = new Map(
   markers
     .filter(m => m.nodeId && Number.isFinite(m.lat) && Number.isFinite(m.lon))
     .map(m => [m.nodeId, m])
 );


 const visibleIds = new Set(displayMarkers.map(m => m.nodeId));


 const isRelevantNode = (id) => {
   if (edgeMode === "all") return visibleIds.has(id);
   if (edgeMode === "selected") return id === selectedNodeId;
   if (edgeMode === "hover") return id === hoveredNodeId;
   return false;
 };


 const seen = new Set();
 const out = [];


 const seeds = edgeMode === "all"
   ? displayMarkers
   : displayMarkers.filter(n => isRelevantNode(n.nodeId));


 for (const n of seeds) {
   if (!Number.isFinite(n.lat) || !Number.isFinite(n.lon)) continue;


   for (const rel of n.relationships || []) {
     if (!rel.otherId) continue;
     const other = byIdAll.get(rel.otherId);
     if (!other) continue;


     const dirOut = rel.direction === "OUT";
     const source = dirOut ? n : other;
     const target = dirOut ? other : n;

     // Hide edges attached to offline nodes
    if (offlineIds.has(source.nodeId) || offlineIds.has(target.nodeId)) continue;

     if (!Number.isFinite(source.lat) || !Number.isFinite(source.lon) ||
         !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) continue;


     const id = rel.id || `${source.nodeId}->${target.nodeId}:${rel.type}`;
     if (seen.has(id)) continue;
     seen.add(id);


     const cp = controlPointForArc(
       { lat: source.lat, lon: source.lon },
       { lat: target.lat, lon: target.lon },
       650
     );
     const positions = bezierCurvePoints(
       { lat: source.lat, lon: source.lon },
       { lat: cp.lat,    lon: cp.lon    },
       { lat: target.lat, lon: target.lon },
       72
     );


     const iMid = Math.floor(positions.length / 2);
     const iArr = Math.max(1, Math.floor(positions.length * 0.9));
     const mid = { lat: positions[iMid][0], lon: positions[iMid][1] };
     const arrowAt = { lat: positions[iArr][0], lon: positions[iArr][1] };
     const prev = { lat: positions[iArr - 1][0], lon: positions[iArr - 1][1] };


     out.push({
       id,
       type: rel.type || "",
       source,
       target,
       positions,
       mid,
       arrowAt,
       angle: bearingDeg(prev, arrowAt),
       internal: visibleIds.has(source.nodeId) && visibleIds.has(target.nodeId),
     });


     if (edgeMode === "all" && out.length >= maxEdges) break;
   }
   if (edgeMode === "all" && out.length >= maxEdges) break;
 }


 return out;
}, [
 markers,
 displayMarkers,
 edgeMode,
 hoveredNodeId,
 selectedNodeId,
 maxEdges,
 minZoomForEdges,
 mapZoom,          // <— important
 offlineIds,
]);




// --- Curved edge helpers (quadratic Bézier) ---


// get a point t (0..1) of the segment from a -> b (simple lat/lon lerp)
const interpolateLatLon = (a, b, t) => ({
lat: a.lat + (b.lat - a.lat) * t,
lon: a.lon + (b.lon - a.lon) * t,
});




// tiny text badge used as an inline edge label
const makeEdgeLabelIcon = (text, color) =>
L.divIcon({
  className: "edge-label",
  html: `
    <div style="
      font-size:10px; line-height:1;
      padding:2px 6px; border-radius:10px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(0,0,0,0.15);
      color: ${color};
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      white-space: nowrap;
    ">${text || ""}</div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});




// Build a small arrowhead marker icon
const makeArrowIcon = (angle, color) =>
  L.divIcon({
    className: "edge-arrowhead",
    html: `
      <div style="
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:10px solid ${color};
        transform: rotate(${angle}deg) translate(-1px,-1px);
      "></div>
    `,
    iconSize: [12, 10],
    iconAnchor: [6, 5],
  });




if (!visible) return null;




return (
  <>
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        width: 420,
        height: 340,
        background: t.panelBg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        overflow: "hidden",
        zIndex,
        boxShadow: "0 8px 20px rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${t.border}`,
          color: t.text,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
          gap: 8,
        }}
      >
        <span>ZIP Map Overlay</span>
        <div
 style={{
   display: "flex",
   alignItems: "center",
   gap: 8,
   rowGap: 6,
   flexWrap: "wrap",     // <—
   fontSize: 12,
   fontWeight: 500,
   maxWidth: 360,        // optional guard
 }}
>
          <span style={{ opacity: 0.8 }}>
            {loading
              ? "Loading…"
              : `${displayMarkers.length} node${displayMarkers.length === 1 ? "" : "s"}`}
          </span>
          <select
value={selectedState}
onChange={(e) => setSelectedState(e.target.value)}
style={{
  width: 110,
  fontSize: 12,
  padding: "4px 6px",
  borderRadius: 6,
  border: `1px solid ${t.border}`,
  background: t.cardBg,
  color: t.text,
}}
title="Filter by state"
>
<option value="">All States</option>
{stateOptions.map((s) => (
  <option key={s} value={s}>{s}</option>
))}
</select>
<select
 value={edgeMode}
 onChange={(e) => setEdgeMode(e.target.value)}
 style={{
   width: 115,
   fontSize: 12,
   padding: "4px 6px",
   borderRadius: 6,
   border: `1px solid ${t.border}`,
   background: t.cardBg,
   color: t.text,
 }}
 title="Edge display mode"
>
 <option value="none">Edges: None</option>
 <option value="hover">Edges: Hover</option>
 <option value="selected">Edges: Selected</option>
 <option value="all">Edges: All (capped)</option>
</select>


{edgeMode === "all" && (
 <>
   <input
     type="range"
     min={50}
     max={1000}
     step={50}
     value={maxEdges}
     onChange={(e) => setMaxEdges(Number(e.target.value))}
     title="Max edges"
     style={{ width: 110 }}
   />
   <span style={{ fontSize: 12, opacity: 0.8 }}>max {maxEdges}</span>
 </>
)}


<span style={{ fontSize: 12, opacity: 0.8, marginLeft: 6 }}>
 min zoom:
</span>
<input
 type="number"
 min={3}
 max={12}
 value={minZoomForEdges}
 onChange={(e) => setMinZoomForEdges(Number(e.target.value))}
 style={{
   width: 42,
   fontSize: 12,
   padding: "2px 4px",
   borderRadius: 6,
   border: `1px solid ${t.border}`,
   background: t.cardBg,
   color: t.text,
 }}
/>
          <button
            onClick={() => setExpanded(true)}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.text,
              cursor: "pointer",
            }}
            title="Open full-screen map"
          >
            Expand
          </button>
          <button
            onClick={() => setShowGraph(true)}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.text,
              cursor: "pointer",
            }}
            title="Open graph view"
          >
            Graph
          </button>
        </div>
      </div>




      {error && (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 12,
            color: theme === "light" ? "#b91c1c" : "#fca5a5",
            background:
              theme === "light" ? "#fee2e2" : "rgba(190,24,24,0.15)",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          {error}
        </div>
      )}




      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
center={[39.5, -98.35]}
zoom={4}
style={{ width: "100%", height: "100%" }}
scrollWheelZoom
whenCreated={handleMapCreated}
keyboard={false}
closePopupOnClick={false}
>
          <TileLayer attribution={tiles.attr} url={tiles.url} />




<Pane name="edges" style={{ zIndex: 650, pointerEvents: "none" }}>


 {mapEdges.map((e) => {
 const stroke = theme === "light" ? "#475569" : "#e2e8f0";
 const weight = edgeMode === "all" ? 2 : 3;
 const opacity = edgeMode === "all" ? 0.7 : 0.95;
 const angle = e.angle;
 const arrowAt = e.arrowAt;
 const mid = e.mid;


 return (
   <React.Fragment key={`full-${e.id}`}>
     <Polyline
       positions={e.positions}
       pane="edges"
       pathOptions={{
         color: stroke,
         weight,
         opacity,
         dashArray: "6 10",
         lineCap: "round",
       }}
     />


     {/* Arrowheads only when not in "all" */}
     {edgeMode !== "all" && (
       <Marker
         position={[arrowAt.lat, arrowAt.lon]}
         pane="edges"
         icon={makeArrowIcon(angle, stroke)}
         interactive={false}
       />
     )}


     {/* Labels only when not in "all" OR zoomed in */}
     {e.type && (edgeMode !== "all" || mapZoom >= 7) && (
       <Marker
         position={[mid.lat, mid.lon]}
         pane="edges"
         icon={makeEdgeLabelIcon(
           e.type,
           theme === "light" ? "#0b1219" : "#0ea5e9"
         )}
         interactive={false}
       />
     )}
   </React.Fragment>
 );
})}


</Pane>


{/*
Duplicate edge renderer disabled to avoid double drawing.
(Edges are already rendered inside <Pane name="edges"> above.)


<Polyline/Marker loop would have been here>
*/}


 {/* Relationship edges between nodes (pane="edges" so they render on top) */}




          {points.map((p) => (
<Marker
  key={p.id}                 // or key={`full-${p.id}`} in fullscreen
  position={[p.lat, p.lon]}
  icon={getMarkerIcon(p.labels, offlineIds.has(p.nodeId))}
  eventHandlers={{
    click: () => onMarkerClick(p.nodeId, p.lat, p.lon),
    popupopen: () => disableMapInteractions(),
    popupclose: () => enableMapInteractions(),
    mouseover: () => setHoveredNodeId(p.nodeId),
    mouseout:  () => setHoveredNodeId(null),
    // Right-click to toggle the green X and hide edges
    contextmenu: () => toggleOffline(p.nodeId),
  }}
>
  <Popup autoPan={false} keepInView={false} closeOnClick={false}>
    {renderPopupContent(p)}
  </Popup>
</Marker>

))}

          <FitToMarkers key={selectedState} points={points} />
        </MapContainer>




        {/* Map Legend (only shows categories present in loaded data) */}
        {/* Map Legend (only shows categories present in loaded data) */}
<Legend theme={theme} t={t} usedPresets={usedPresets} counts={legendCounts} />

        {!loading && points.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: t.text,
              opacity: 0.75,
              pointerEvents: "none",
            }}
          >
            No nodes with ZIP codes found.
          </div>
        )}
      </div>
    </div>
    {/* Existing ZIP Map Overlay container … */}


    {/* Full-screen expand overlay */}
    {expanded && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background:
            theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal header */}
        <div
  style={{
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    color: t.text,
    background: t.panelBg,
    borderBottom: `1px solid ${t.border}`,
  }}
>
  <div style={{ fontWeight: 700 }}>ZIP Map — Full Screen</div>
  <div style={{ display: "flex", alignItems: "center" }}>
    <select
      value={selectedState}
      onChange={(e) => setSelectedState(e.target.value)}
      style={{
        width: 110,
        fontSize: 12,
        padding: "4px 6px",
        borderRadius: 6,
        border: `1px solid ${t.border}`,
        background: t.cardBg,
        color: t.text,
        marginRight: 8,
      }}
      title="Filter by state"
    >
      <option value="">All States</option>
      {stateOptions.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>

    {/* NEW: Trends toggle */}
    <button
      onClick={() => setShowTrendsInExpanded((v) => !v)}
      style={{
        fontSize: 13,
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.cardBg,
        color: t.text,
        cursor: "pointer",
        marginRight: 8,
      }}
      title="Show behavioral trends"
    >
      {showTrendsInExpanded ? "Hide Trends" : "Trends"}
    </button>

    <button
      onClick={() => { setShowTrendsInExpanded(false); setExpanded(false); }}
      style={{
        fontSize: 13,
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.cardBg,
        color: t.text,
        cursor: "pointer",
      }}
      title="Close"
    >
      Close
    </button>
  </div>
</div>

        {/* Full-screen map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer
center={[39.5, -98.35]}
zoom={4}
style={{ width: "100%", height: "100%" }}
scrollWheelZoom
whenCreated={handleMapCreated}
keyboard={false}
closePopupOnClick={false}
>

        <TileLayer attribution={tiles.attr} url={tiles.url} />
<Pane name="edges" style={{ zIndex: 650, pointerEvents: "none" }}>
 {/*
Duplicate edge renderer disabled to avoid double drawing (fullscreen).


<Polyline/Marker loop would have been here>
*/}
 {/* Relationship edges between nodes */}
 {mapEdges.map((e) => {
 const stroke = theme === "light" ? "#475569" : "#e2e8f0";
 const weight = edgeMode === "all" ? 2 : 3;
 const opacity = edgeMode === "all" ? 0.7 : 0.95;
 const angle = e.angle;
 const arrowAt = e.arrowAt;
 const mid = e.mid;


 return (
   <React.Fragment key={`full-${e.id}`}>
     <Polyline
       positions={e.positions}
       pane="edges"
       pathOptions={{
         color: stroke,
         weight,
         opacity,
         dashArray: "6 10",
         lineCap: "round",
       }}
     />


     {/* Arrowheads only when not in "all" */}
     {edgeMode !== "all" && (
       <Marker
         position={[arrowAt.lat, arrowAt.lon]}
         pane="edges"
         icon={makeArrowIcon(angle, stroke)}
         interactive={false}
       />
     )}


     {/* Labels only when not in "all" OR zoomed in */}
     {e.type && (edgeMode !== "all" || mapZoom >= 7) && (
       <Marker
         position={[mid.lat, mid.lon]}
         pane="edges"
         icon={makeEdgeLabelIcon(
           e.type,
           theme === "light" ? "#0b1219" : "#0ea5e9"
         )}
         interactive={false}
       />
     )}
   </React.Fragment>
 );
})}


</Pane>


           {points.map((p) => (
<Marker
  key={p.id}                 // or key={`full-${p.id}`} in fullscreen
  position={[p.lat, p.lon]}
  icon={getMarkerIcon(p.labels, offlineIds.has(p.nodeId))}
  eventHandlers={{
    click: () => onMarkerClick(p.nodeId, p.lat, p.lon),
    popupopen: () => disableMapInteractions(),
    popupclose: () => enableMapInteractions(),
    mouseover: () => setHoveredNodeId(p.nodeId),
    mouseout:  () => setHoveredNodeId(null),
    // Right-click to toggle the green X and hide edges
    contextmenu: () => toggleOffline(p.nodeId),
  }}
>
  <Popup autoPan={false} keepInView={false} closeOnClick={false}>
    {renderPopupContent(p)}
  </Popup>
</Marker>

))}
            <FitToMarkers key={selectedState} points={points} />
          </MapContainer>

            {/* NEW: Neighborhood Trends panel overlay in expanded view */}
  {showTrendsInExpanded && (
  <div
    style={{
      position: "absolute",
      right: 12,
      top: 56,      // below the expanded header
      zIndex: 10000
    }}
  >
    {/* <NodeNeighborhoodPanel
  theme={theme}
  seedEid={String(selectedNodeId || "")}
  onCenterOnMap={(node) => {
    // node = { nodeId, labels, props, lat, lon }
    if (leafletMapRef.current && Number.isFinite(node.lat) && Number.isFinite(node.lon)) {
      leafletMapRef.current.flyTo([node.lat, node.lon], Math.max(leafletMapRef.current.getZoom(), 6), { duration: 0.6 });
    }
  }}
/>  NEW FOR LLM*/}
<GraphProvider>
  <NeighborhoodContainer
    theme={theme}
    seedEid={String(selectedNodeId || "")}
    onCenterOnMap={(node) => {
      // node = { nodeId, labels, props, lat, lon }
      if (leafletMapRef.current && Number.isFinite(node.lat) && Number.isFinite(node.lon)) {
        leafletMapRef.current.flyTo(
          [node.lat, node.lon],
          Math.max(leafletMapRef.current.getZoom(), 6),
          { duration: 0.6 }
        );
      }
    }}
  />
</GraphProvider>
  </div>
)}

          {/* Legend in full-screen view */}
         {/* Map Legend (only shows categories present in loaded data) */}
<Legend theme={theme} t={t} usedPresets={usedPresets} counts={legendCounts} />
          {!loading && points.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: theme === "light" ? t.text : "#fff",
                opacity: 0.8,
                pointerEvents: "none",
              }}
            >
              No nodes with ZIP codes found.
            </div>
          )}
        </div>
      </div>
    )}

    {/* Cytoscape Graph Overlay */}
    {showGraph && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background:
            theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            color: t.text,
            background: t.panelBg,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div style={{ fontWeight: 700 }}>Graph — Cytoscape</div>
          <button
            onClick={() => setShowGraph(false)}
            style={{
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.text,
              cursor: "pointer",
            }}
            title="Close"
          >
            Close
          </button>
        </div>

        {/* Graph body */}
        <div style={{ flex: 1, position: "relative" }}>
          <CytoscapeComponent
            elements={cyElements}
            style={{ width: "100%", height: "100%" }}
            layout={{ name: "cose" }}
            stylesheet={[
              {
                selector: "node",
                style: {
                  "background-color":
                    theme === "light" ? "#F47920" : "#FB923C",
                  label: "data(label)",
                  color: theme === "light" ? "#0b1219" : "#e5e7eb",
                  "font-size": 10,
                  "text-valign": "center",
                  "text-halign": "center",
                  "border-width": 2,
                  "border-color":
                    theme === "light" ? "#e5e7eb" : "#2c313c",
                },
              },
              {
                selector: "edge",
                style: {
                  width: 2,
                  "line-color":
                    theme === "light" ? "#94a3b8" : "#475569",
                  "target-arrow-color":
                    theme === "light" ? "#94a3b8" : "#475569",
                  "curve-style": "bezier",
                  "target-arrow-shape": "triangle",
                  label: "data(label)",
                  "font-size": 8,
                  "text-rotation": "autorotate",
                  "text-margin-y": -6,
                  color: theme === "light" ? "#0b1219" : "#e5e7eb",
                },
              },
              {
                selector: ".selected",
                style: {
                  "border-color": "#f59e0b",
                  "border-width": 3,
                },
              },
              {
                selector: ":selected",
                style: {
                  "border-color": "#f59e0b",
                  "line-color": "#f59e0b",
                  "target-arrow-color": "#f59e0b",
                },
              },
            ]}
            cy={(cy) => {
              cy.fit();
              cy.center();
              cy.off("select");
              cy.on("select", "node", (evt) => {
                const id = evt.target.id();
                setSelectedNodeId(id);
                const n = displayMarkers.find((m) => m.nodeId === id);
                if (
                  n?.lat != null &&
                  n?.lon != null &&
                  leafletMapRef.current
                ) {
                  leafletMapRef.current.flyTo(
                    [n.lat, n.lon],
                    Math.max(leafletMapRef.current.getZoom(), 6),
                    { duration: 0.6 }
                  );
                }
              });
            }}
          />

          {/* Fixed graph legend overlay */}
          <GraphLegend theme={theme} t={t} />
        </div>
      </div>
    )}
  </>
);
}



