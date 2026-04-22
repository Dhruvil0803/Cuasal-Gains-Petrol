// NodeNeighborhoodPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
// import CytoscapeComponent from "react-cytoscapejs";
import neo4j from "neo4j-driver";
// import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from "../../config/env";
// import { toJSDeep } from "./helper";
import CytoscapeComponent from "react-cytoscapejs";
import { createDriver } from "@/neo4jFacade";
import { toJSDeep } from "./helper";


/**
 * Props:
 * - theme: "dark" | "light"
 * - seedEid: string (Neo4j elementId for the seed node)
 * - onCenterOnMap?: ({ nodeId, labels, props, lat, lon }) => void
 * - onGraphChanged?: (elements, meta) => void   // meta: { action: "seed-load"|"expand", expandedNodeId?, seedEid }
 * - onExpandMeta?: (expandedNodeId: string) => void

 */
// export default function NodeNeighborhoodPanel({
//   theme = "dark",
//   seedEid = "",
//   onCenterOnMap,
// }) {
export default function NodeNeighborhoodPanel({
  theme = "dark",
  seedEid = "",
  onCenterOnMap,
  onGraphChanged,   // (elements, meta) => void
  onExpandMeta,     // (expandedNodeId) => void
}) {

  const [elements, setElements] = useState([]);       // cy elements (nodes+edges)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // NEW: selected node for properties panel
  const [selectedNode, setSelectedNode] = useState(null); // { id, type, abbr, props, lat, lon, rawLabels, label, color }

  const cyRef = useRef(null);
  const layoutRef = useRef(null); // keep reference to current layout
  // prevents re-initializing Cytoscape on every React re-render
  const didInitRef = useRef(false);
  // === What-if state (ADD) ===
const [isWhatIf, setIsWhatIf] = useState(false);
const [isCompare, setIsCompare] = useState(false);
const [scenarioName, setScenarioName] = useState("");
const [scenarios, setScenarios] = useState(() => {
  try { return JSON.parse(localStorage.getItem("neigh_scenarios_v1") || "[]"); }
  catch { return []; }
});
const [selectedScenarioId, setSelectedScenarioId] = useState("");
const [compareElements, setCompareElements] = useState([]);       // NEW
const [compareReady, setCompareReady] = useState(false);
const cyCompareRef = useRef(null);

// simple helpers
const saveScenarios = (arr) => {
  setScenarios(arr);
  try { localStorage.setItem("neigh_scenarios_v1", JSON.stringify(arr)); } catch {}
};
const genId = () => Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);


// manual “tick” to decide when to rerun layout
const [layoutTick, setLayoutTick] = useState(0);


  // ---------- theme tokens ----------
  const t = useMemo(
    () =>
      theme === "light"
        ? {
            panelBg: "#f8fafc",
            cardBg: "#f1f5f9",
            border: "#e5e7eb",
            text: "#0b1219",
            edge: "#94a3b8",
            nodeText: "#0b1219",
            labelBg: "#ffffff",
          }
        : {
            panelBg: "#0f1116",
            cardBg: "#15171d",
            border: "#2c313c",
            text: "#e5e7eb",
            edge: "#475569",
            nodeText: "#e5e7eb",
            labelBg: "#0f1116",
          },
    [theme]
  );

  // ---------- type normalization + abbreviations ----------
  const TYPE_ABBR_LOOKUP = useMemo(() => {
    return new Map([
      ["distributioncenter", "DC"],
      ["distributioncenters", "DC"],
      ["distribution center", "DC"],
      ["distribution centers", "DC"],
      ["dealership", "D"],
      ["dealerships", "D"],
      ["supplier", "S"],
      ["suppliers", "S"],
    ]);
  }, []);
  const normalizeTypeKey = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const getAbbrForType = (type) => {
    const key = normalizeTypeKey(type);
    return TYPE_ABBR_LOOKUP.get(key) || null;
  };

  // ---------- helpers ----------
  function getLatLon(entry) {
    if (!entry || typeof entry !== "object") return { lat: null, lon: null };
    let rawLat =
      entry.lat ?? entry.latitude ?? entry.Lat ?? entry.Latitude ?? null;
    let rawLon =
      entry.lon ??
      entry.lng ??
      entry.longitude ??
      entry.Lon ??
      entry.Longitude ??
      null;

    if (rawLat == null || rawLon == null) {
      const gp = entry.geo_point_2d ?? entry.geo ?? entry.location ?? null;
      if (gp && typeof gp === "object") {
        rawLat =
          rawLat ?? gp.lat ?? gp.latitude ?? (Array.isArray(gp) ? gp[1] : null);
        rawLon =
          rawLon ??
          gp.lon ??
          gp.lng ??
          gp.longitude ??
          (Array.isArray(gp) ? gp[0] : null);
      }
    }
    if ((rawLat == null || rawLon == null) && Array.isArray(entry.coordinates)) {
      rawLon = rawLon ?? entry.coordinates[0];
      rawLat = rawLat ?? entry.coordinates[1];
    }
    const lat = rawLat != null ? parseFloat(rawLat) : null;
    const lon = rawLon != null ? parseFloat(rawLon) : null;
    return { lat, lon };
  }

  // Smooth, animated layout (use for reflow moments)
function runLayoutAnimated(fitPadding = 60, duration = 450) {
  if (!cyRef.current) return;
  try { layoutRef.current?.stop?.(); } catch {}
  const cy = cyRef.current;
  if (cy.nodes().length === 0) return;

  layoutRef.current = cy.layout({
    name: "cose",
    animate: true,
    animationDuration: duration,
    animationEasing: "ease-in-out-cubic",
    idealEdgeLength: 100,
    nodeRepulsion: 8000,
    gravity: 80,
    fit: true,
    padding: fitPadding,
  });

  layoutRef.current.run();

  // tiny zoom “nudge” to telegraph the reflow
  layoutRef.current.on("layoutstop", () => {
    try {
      const z = cy.zoom();
      cy.animate({ zoom: z * 1.03 }, { duration: 160, easing: "ease-out-cubic" })
        .promise("completed")
        .then(() => cy.animate({ zoom: z }, { duration: 160, easing: "ease-in-cubic" }));
    } catch {}
  });
}

// Quick visual pulse on remaining nodes
function pulseNodesAfterChange() {
  const cy = cyRef.current;
  if (!cy) return;
  const nodes = cy.nodes();

  // stop any running animations to avoid piling up
  nodes.stop(true);

  nodes.animate(
    { style: { "border-width": 6, "border-color": "#f59e0b" } },
    { duration: 150, easing: "ease-out-cubic" }
  ).animate(
    { style: { "border-width": 2, "border-color": (theme === "light" ? "#e5e7eb" : "#2c313c") } },
    { duration: 280, easing: "ease-in-cubic" }
  );
}

  function mergeById(existing, incoming) {
    const map = new Map(existing.map((e) => [e?.data?.id, e]));
    for (const e of incoming) {
      const id = e?.data?.id;
      if (!id) continue;
      if (!map.has(id)) map.set(id, e);
    }
    return Array.from(map.values());
  }

  function buildCyElementsFromNeighborhood(records) {
    const nodes = new Map(); // elementId => cy node
    const edges = [];

    for (const r of records) {
      const seed = r.get("seed");
      const other = r.get("m");
      const rid = r.get("rid");
      const relType = r.get("relType");
      const startId = r.get("startId");
      const endId = r.get("endId");

      const pushNode = (n) => {
        if (!n) return;
        const eid = n.elementId;
        if (nodes.has(eid)) return;

        const labels = n.labels || [];
        const primary = labels[0] || "node";
        const props = toJSDeep(n.properties || {});
        const nameish =
          props.name ||
          props.title ||
          props.id ||
          props.identifier ||
          props.code ||
          props.number ||
          "";

        const abbr = getAbbrForType(primary);
        const display = nameish || abbr || primary;

        const { lat, lon } = getLatLon(props);

        nodes.set(eid, {
          data: {
            id: eid,
            label: display,       // shows DC/D/S if no specific name
            type: primary,
            abbr,
            rawLabels: labels,
            props,
            lat,
            lon,
          },
        });
      };

      pushNode(seed);
      pushNode(other);

      if (rid && startId && endId) {
        edges.push({
          data: {
            id: rid,
            source: startId,
            target: endId,
            label: relType || "",
          },
        });
      }
    }

    return [...nodes.values(), ...edges];
  }

  // async function fetchNeighborhoodByElementId(eid, limit = 1500) {
  //   const driver = neo4j.driver(
  //     NEO4J_URI,
  //     neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD || "")
  //   );
  //   const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  //   try {
  //     const query = `
  //       MATCH (seed) WHERE elementId(seed) = $eid
  //       MATCH (seed)-[r]-(m)
  //       RETURN
  //         seed,
  //         m,
  //         r,
  //         elementId(r)            AS rid,
  //         type(r)                 AS relType,
  //         elementId(startNode(r)) AS startId,
  //         elementId(endNode(r))   AS endId
  //       LIMIT $limit
  //     `;
  //     const res = await session.run(query, {
  //       eid,
  //       limit: neo4j.int(limit),
  //     });
  //     return res.records;
  //   } finally {
  //     await session.close().catch(() => {});
  //     await driver.close().catch(() => {});
  //   }
  // }
  async function fetchNeighborhoodByElementId(eid, limit = 1500) {
  const driver = createDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const query = `
      MATCH (seed) WHERE elementId(seed) = $eid
      MATCH (seed)-[r]-(m)
      RETURN
        seed,
        m,
        r,
        elementId(r)            AS rid,
        type(r)                 AS relType,
        elementId(startNode(r)) AS startId,
        elementId(endNode(r))   AS endId
        LIMIT toInteger($lim)
    `;
    // const res = await session.run(query, { eid, limit });
    // const res = await session.run(query, { eid, limit: neo4j.int ? neo4j.int(limit) : limit });
    const res = await session.run(query, { eid, lim: Number(limit) });
    return res.records;
  } finally {
    await session.close().catch(() => {});
    await driver.close().catch(() => {});
  }
}


  // ---------- load on seed change ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      setSelectedNode(null);
    //   if (!seedEid) {
    //     setElements([]);
    //     return;
    //   } NEW FOR LLM
    if (!seedEid) {
  setElements([]);
  onGraphChanged?.([], { action: "seed-load", seedEid });
  return;
}
      setLoading(true);
      try {
        const recs = await fetchNeighborhoodByElementId(seedEid, 2000);
        if (cancelled) return;
        const els = buildCyElementsFromNeighborhood(recs);
        setElements(els);
        setLayoutTick((t) => t + 1);
        //NEW FOR LLM
        onGraphChanged?.(els, { action: "seed-load", seedEid });
      } catch (e) {
  if (!cancelled) setError(e?.message || "Failed to load neighborhood.");
  setElements([]);
  onGraphChanged?.([], { action: "seed-load", seedEid });
} finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seedEid]);

  // ---------- colors per node type + legend ----------
  const typeInfo = useMemo(() => {
    const m = new Map();
    for (const e of elements) {
      if (!e.data || e.data.source) continue;
      const type = e.data.type || "node";
      const abbr = getAbbrForType(type);
      const entry = m.get(type) || { count: 0, abbr };
      entry.count += 1;
      m.set(type, entry);
    }
    return m;
  }, [elements]);

  const paletteLight = [
    "#F47920", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
    "#0ea5e9", "#14b8a6", "#f97316", "#a855f7", "#84cc16",
    "#e11d48", "#06b6d4", "#10b981", "#9333ea", "#d946ef"
  ];
  const paletteDark = [
    "#6ea8fe", "#4ade80", "#fbbf24", "#f87171", "#a78bfa",
    "#67e8f9", "#2dd4bf", "#fb923c", "#c084fc", "#a3e635",
    "#fb7185", "#22d3ee", "#34d399", "#c4b5fd", "#f472b6"
  ];
  const palette = theme === "light" ? paletteLight : paletteDark;

  const typeColorMap = useMemo(() => {
    const entries = Array.from(typeInfo.keys()).sort();
    const map = new Map();
    entries.forEach((type, idx) => {
      map.set(type, palette[idx % palette.length]);
    });
    return map;
  }, [typeInfo, palette]);

  const coloredElements = useMemo(() => {
    return elements.map((e) => {
      if (e.data && !e.data.source) {
        const c = typeColorMap.get(e.data.type || "node");
        return { ...e, data: { ...e.data, color: c } };
      }
      return e;
    });
  }, [elements, typeColorMap]);

  // ---------- ensure layout after elements/expands ----------
  const runLayout = (fitPadding = 40) => {
    if (!cyRef.current) return;
    try { layoutRef.current?.stop?.(); } catch {}
    const cy = cyRef.current;
    if (cy.nodes().length === 0) return;

    layoutRef.current = cy.layout({
  name: "cose",
  animate: false,           // was true
  animationDuration: 0,
  idealEdgeLength: 100,
  nodeRepulsion: 8000,
  gravity: 80,
  fit: true,
  padding: fitPadding,
});
    layoutRef.current.run();
    layoutRef.current.on("layoutstop", () => {
      try { cy.fit(undefined, fitPadding); } catch {}
    });
  };

//   useEffect(() => {
//     const id = setTimeout(() => runLayout(60), 0);
//     return () => clearTimeout(id);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [coloredElements.length]); NEW FOR LLM
useEffect(() => {
  if (layoutTick > 0) runLayout(60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [layoutTick]);

// === What-if actions (ADD) ===
function deleteSelected() {
  if (!isWhatIf || !cyRef.current) return;
  const cy = cyRef.current;
  if (cy.$(":selected").length === 0) return;

  cy.batch(() => cy.$(":selected").remove());

  // NEW: feedback
  pulseNodesAfterChange();
  runLayoutAnimated(60, 450);
}


// Del/Backspace while What-if is ON (fullscreen)
useEffect(() => {
  if (!isFullscreen || !isWhatIf) return;
  const onKey = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [isFullscreen, isWhatIf]);

function saveScenario() {
  const cy = cyRef.current;
  if (!cy) return;

  // take full element JSONs…
  const els = cy.elements().jsons();

  // …and ensure nodes have positions captured from the live graph
  for (const e of els) {
    if (e.group === "nodes") {
      const n = cy.$id(e.data.id);
      if (n && n.nonempty()) e.position = n.position();
    }
  }

  const data = {
    id: genId(),
    name: (scenarioName || "Untitled").trim(),
    seedEid: String(seedEid || ""),
    createdAt: Date.now(),
    elements: els,
    pan: cy.pan(),
    zoom: cy.zoom(),
  };

  const next = [data, ...scenarios];
  saveScenarios(next);
  setScenarioName("");
  setSelectedScenarioId(data.id);
}


function loadScenarioToCompare(id) {
  const sc = scenarios.find((s) => s.id === id);
  if (!sc) return;
  setCompareElements(sc.elements || []);
  // fit after elements are in the DOM
  requestAnimationFrame(() => {
    const cy2 = cyCompareRef.current;
    if (!cy2) return;
    cy2.fit(cy2.elements(), 40);
    if (sc.zoom) cy2.zoom(sc.zoom);
    if (sc.pan) cy2.pan(sc.pan);
  });
}


// whenever compare dropdown changes while Compare is ON
useEffect(() => {
  if (isFullscreen && isCompare && selectedScenarioId) {
    loadScenarioToCompare(selectedScenarioId);
  }
}, [isFullscreen, isCompare, selectedScenarioId]);

// ensure loading happens after the compare canvas is mounted
useEffect(() => {
  if (isFullscreen && isCompare && selectedScenarioId && compareReady) {
    // let React paint the right canvas before we touch it
    requestAnimationFrame(() => loadScenarioToCompare(selectedScenarioId));
  }
}, [isFullscreen, isCompare, selectedScenarioId, compareReady]);

  // ---------- actions ----------
async function expandFromNode(eid) {
  setLoading(true);
  setError("");
  try {
    const recs = await fetchNeighborhoodByElementId(eid, 2000);
    const more = buildCyElementsFromNeighborhood(recs);

    setElements((prev) => {
      const merged = mergeById(prev, more);
      setLayoutTick((t) => t + 1);
      onGraphChanged?.(merged, { action: "expand", expandedNodeId: eid, seedEid });
      onExpandMeta?.(eid);
      return merged;
    });
  } catch (e) {
    setError(e?.message || "Failed to expand neighborhood.");
  } finally {
    setLoading(false);
  }
}

  function centerSelectedNodeOnMap(eid) {
    if (!onCenterOnMap) return;
    const n = coloredElements.find((e) => e.data?.id === eid);
    if (!n) return;
    const { lat, lon } = getLatLon(n?.data?.props || {});
    onCenterOnMap({
      nodeId: eid,
      labels: n?.data?.rawLabels || [],
      props: n?.data?.props || {},
      lat,
      lon,
    });
  }

  // ---------- cytoscape stylesheet ----------
  const stylesheet = useMemo(
    () => [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          label: "data(label)",
          color: t.nodeText,
          "font-size": 11,
          "text-valign": "center",
          "text-halign": "center",
          "border-width": 2,
          "border-color": theme === "light" ? "#e5e7eb" : "#2c313c",
        },
      },
      {
        selector: "edge",
        style: {
          width: 2,
          "curve-style": "unbundled-bezier",
          "control-point-distances": 20,
          "control-point-weights": 0.5,
          "line-color": t.edge,
          "target-arrow-color": t.edge,
          "target-arrow-shape": "triangle",
          label: "data(label)",
          "font-size": 8,
          "text-rotation": "autorotate",
          "text-margin-y": -6,
          color: t.text,
          "text-background-color": t.labelBg,
          "text-background-opacity": 0.85,
          "text-background-shape": "roundrectangle",
          "text-background-padding": 2,
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
    ],
    [t, theme]
  );

// keep a stable layout object so react-cytoscapejs doesn’t relayout on every render
const presetLayout = useMemo(() => ({ name: "preset" }), []);

  // ---------- layout / container styles ----------
  const containerStyle = isFullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.96)",
        display: "flex",
        flexDirection: "column",
      }
    : {
        width: 560,
        height: 460,
        background: t.panelBg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 20px rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
      };

  // ---------- render ----------
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          height: 48,
          padding: "0 10px",
          borderBottom: `1px solid ${t.border}`,
          color: t.text,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          background: t.panelBg,
        }}
      >
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          Neighborhood
          {seedEid ? (
            <code
              style={{
                fontSize: 11,
                opacity: 0.8,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                padding: "2px 6px",
                borderRadius: 6,
              }}
              title="Seed elementId"
            >
              {seedEid}
            </code>
          ) : (
            <span style={{ fontSize: 12, opacity: 0.7 }}>(no seed)</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loading && (
            <span
              style={{
                fontSize: 12,
                padding: "2px 6px",
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.text,
              }}
            >
              Loading…
            </span>
          )}
          <button
            onClick={() => {
              if (!seedEid) return;
              setSelectedNode(null);
              setLoading(true);
              setError("");
              fetchNeighborhoodByElementId(seedEid, 2000)
                // .then((recs) => setElements(buildCyElementsFromNeighborhood(recs))) NEW FOR LLM
                .then((recs) => {
  const els = buildCyElementsFromNeighborhood(recs);
  setElements(els);
  setLayoutTick((t) => t + 1);
  onGraphChanged?.(els, { action: "seed-load", seedEid });
})
                .catch((e) => setError(e?.message || "Reload failed."))
                .finally(() => setLoading(false));
            }}
            style={btnStyle(t)}
            title="Reload seed"
          >
            Reload
          </button>
          <button
            // onClick={() => { setElements([]); setSelectedNode(null); }} NEW FOR LLM
            onClick={() => {
  setElements([]);
  setSelectedNode(null);
  onGraphChanged?.([], { action: "seed-load", seedEid });
}}
            style={btnStyle(t)}
            title="Clear graph"
          >
            Clear
          </button>
          <button
  onClick={() => {
    setIsFullscreen((v) => !v);
    // tidy up modes when leaving fullscreen
setIsWhatIf(false);
setIsCompare(false);

    setTimeout(() => runLayout(80), 50);
  }}
  style={btnStyle(t)}
  title={isFullscreen ? "Exit full screen" : "Full screen"}
>
  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
</button>
{/* --- What-if controls (ADD; only when fullscreen) --- */}
{isFullscreen && (
  <>
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="checkbox"
        checked={isWhatIf}
        onChange={(e) => setIsWhatIf(e.target.checked)}
      />
      What-if
    </label>

    <button
      onClick={deleteSelected}
      style={btnStyle(t)}
      disabled={!isWhatIf}
      title="Delete selected (Del/Backspace)"
    >
      Delete
    </button>

    <input
      value={scenarioName}
      onChange={(e) => setScenarioName(e.target.value)}
      placeholder="Scenario name"
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 6,
        border: `1px solid ${t.border}`,
        background: t.cardBg,
        color: t.text,
        width: 160,
      }}
    />
    <button onClick={saveScenario} style={btnStyle(t)} title="Save scenario">
      Save
    </button>

    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
  type="checkbox"
  checked={isCompare}
  onChange={(e) => {
    const v = e.target.checked;
    setIsCompare(v);
    // If user turns on Compare without picking, select the latest saved scenario
    if (v && !selectedScenarioId && scenarios.length > 0) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }}
/>
      Compare
    </label>
    <select
      value={selectedScenarioId}
      onChange={(e) => setSelectedScenarioId(e.target.value)}
      disabled={!isCompare}
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 6,
        border: `1px solid ${t.border}`,
        background: t.cardBg,
        color: t.text,
      }}
    >
      <option value="">— choose a saved scenario —</option>
      {scenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  </>
)}

        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 12,
            color: theme === "light" ? "#b91c1c" : "#fca5a5",
            background: theme === "light" ? "#fee2e2" : "rgba(190,24,24,0.15)",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          {error}
        </div>
      )}

      {/* Graph body */}
{/* Graph body (REPLACED) */}
<div style={{ flex: 1, position: "relative", background: t.panelBg }}>
  {/* split canvas grid */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "grid",
      gridTemplateColumns: isFullscreen && isCompare ? "1fr 1fr" : "1fr",
    }}
  >
    {/* LEFT: edited neighborhood */}
    <div style={{ position: "relative" , minWidth: 0 }}>
      <CytoscapeComponent
        elements={coloredElements}
        style={{ width: "100%", height: "100%" }}
        layout={presetLayout}
        stylesheet={stylesheet}
        cy={(cy) => {
          if (didInitRef.current) return;      // keep your guard
          didInitRef.current = true;
          cyRef.current = cy;

          // reset handlers once
          cy.off("select");
          cy.off("unselect");
          cy.off("dblclick");
          cy.off("tap");

          // select → details + map center (unchanged)
          cy.on("select", "node", (evt) => {
            const id = evt.target.id();
            evt.target.addClass("selected");
            centerSelectedNodeOnMap(id);
            const data = evt.target.data() || {};
            setSelectedNode({
              id,
              type: data.type,
              abbr: data.abbr || null,
              label: data.label,
              color: data.color,
              rawLabels: data.rawLabels || [],
              props: data.props || {},
              ...getLatLon(data.props || {}),
            });
          });

          cy.on("unselect", "node", (evt) => {
            evt.target.removeClass("selected");
          });

          // double-click expand
          const onExpand = async (evt) => {
            const id = evt.target?.id?.();
            if (!id) return;
            await expandFromNode(id);
          };
          cy.on("dblclick", "node", onExpand);

          // double-tap support
          cy.on("tap", "node", (evt) => {
            const detail = evt.originalEvent?.detail ?? 1;
            if (detail >= 2) onExpand(evt);
          });

          runLayout(80);
        }}
      />
    </div>

    {/* RIGHT: baseline / saved scenario */}
    {isFullscreen && isCompare && (
      <div style={{ position: "relative", borderLeft: `1px solid ${t.border}` , minWidth: 0 }}>
       <CytoscapeComponent
// key={`compare-${selectedScenarioId}-${compareElements.length}`}
  key={`compare-${selectedScenarioId || "none"}`}
  elements={compareElements}
  style={{ width: "100%", height: "100%" }}
  layout={presetLayout}
  stylesheet={stylesheet}
  cy={(cy) => {
    cyCompareRef.current = cy;
    setCompareReady(true);

    // --- NEW: avoid duplicate listeners if this remounts
    cy.off("select");
    cy.off("unselect");
    cy.off("tap");

    // --- NEW: show details when selecting nodes on the compare canvas
    cy.on("select", "node", (evt) => {
      const id = evt.target.id();
      evt.target.addClass("selected");

      // (optional) center on map just like the main canvas
      centerSelectedNodeOnMap(id);

      const data = evt.target.data() || {};
      setSelectedNode({
        id,
        type: data.type,
        abbr: data.abbr || null,
        label: data.label,
        color: data.color,
        rawLabels: data.rawLabels || [],
        props: data.props || {},
        ...getLatLon(data.props || {}),
        _source: "compare", // (optional) if you want to label it
      });
    });

    cy.on("unselect", "node", (evt) => {
      evt.target.removeClass("selected");
      // keep the panel open until user clicks elsewhere (same behavior as left)
      // If you prefer to clear on unselect, call setSelectedNode(null) here.
    });

    // existing safety layout + fit
    const hasPositions = (compareElements || []).some(
      (e) => e.group === "nodes" && e.position && Number.isFinite(e.position.x)
    );
    if (!hasPositions) {
      cy.layout({
        name: "cose",
        animate: false,
        idealEdgeLength: 100,
        nodeRepulsion: 8000,
        padding: 40,
        fit: true,
      }).run();
    }
    cy.fit(cy.elements(), 40);
  }}
/>

        {!selectedScenarioId && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: t.text,
              opacity: 0.6,
              fontSize: 12,
            }}
          >
            Choose a saved scenario to display here.
          </div>
        )}
      </div>
    )}
  </div>

  {/* original “no seed” note */}
  {!seedEid && (
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
      Provide a seed elementId to view its neighborhood.
    </div>
  )}
        {/* Legend */}
        {typeInfo.size > 0 && (
          <div
            style={{
              position: "absolute",
              left: 10,
              bottom: 10,
              maxWidth: 460,
              background: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(15,17,22,0.9)",
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "8px 10px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              color: t.text,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Legend</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from(typeInfo.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([type, info]) => {
                  const color = typeColorMap.get(type);
                  const chip = info.abbr || type; // DC/D/S when applicable
                  return (
                    <div
                      key={type}
                      title={type}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: `1px solid ${t.border}`,
                        background: t.cardBg,
                        borderRadius: 8,
                        padding: "4px 6px",
                        fontSize: 12,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: color,
                          display: "inline-block",
                          border: "1px solid rgba(0,0,0,0.2)",
                        }}
                      />
                      <span>{chip} × {info.count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Properties Panel (slides in on single click) */}
        {selectedNode && (
          <div
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              bottom: 10,
              width: 300,
              background: theme === "light" ? "rgba(255,255,255,0.96)" : "rgba(15,17,22,0.96)",
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: 10,
              color: t.text,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 12, height: 12, borderRadius: 999, background: selectedNode.color,
                    border: "1px solid rgba(0,0,0,0.25)"
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {selectedNode.label}
                  <span style={{ opacity: 0.7, marginLeft: 6, fontWeight: 500 }}>
                    ({selectedNode.abbr || selectedNode.type})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={btnStyle(t)}
                title="Close"
              >
                Close
              </button>
            </div>

            <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.9 }}>
              <div><strong>elementId:</strong> <code>{selectedNode.id}</code></div>
              {Number.isFinite(selectedNode.lat) && Number.isFinite(selectedNode.lon) && (
                <div><strong>coords:</strong> {selectedNode.lat.toFixed(5)}, {selectedNode.lon.toFixed(5)}</div>
              )}
              {selectedNode.rawLabels?.length ? (
                <div><strong>labels:</strong> {selectedNode.rawLabels.join(", ")}</div>
              ) : null}
            </div>

            <div style={{
              borderTop: `1px solid ${t.border}`,
              marginTop: 6,
              paddingTop: 6,
              fontSize: 12,
              overflow: "auto",
              flex: 1,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Properties</div>
              {Object.keys(selectedNode.props || {}).length === 0 ? (
                <div style={{ opacity: 0.7 }}>(no properties)</div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {Object.entries(selectedNode.props)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => (
                      <li key={k} style={{
                        padding: "6px 8px",
                        border: `1px solid ${t.border}`,
                        background: t.cardBg,
                        borderRadius: 8,
                        marginBottom: 6,
                        wordBreak: "break-word",
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{k}</div>
                        <div style={{ opacity: 0.95 }}>
                          {renderValue(v)}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer (hidden in fullscreen) */}
      {!isFullscreen && (
        <div
          style={{
            padding: "6px 10px",
            borderTop: `1px solid ${t.border}`,
            color: t.text,
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: t.cardBg,
          }}
        >
          <span>
            Single-click a node to view properties. Double-click to expand neighbors.
          </span>
          <span style={{ opacity: 0.8 }}>
            {coloredElements.filter((e) => !e.data?.source).length} nodes ·{" "}
            {coloredElements.filter((e) => !!e.data?.source).length} edges
          </span>
        </div>
      )}
    </div>
  );
}

function btnStyle(t) {
  return {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${t.border}`,
    background: t.cardBg,
    color: t.text,
    cursor: "pointer",
  };
}

function renderValue(v) {
  if (v == null) return "(null)";
  if (Array.isArray(v)) {
    try { return v.map(renderValue).join(", "); } catch { return String(v); }
  }
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s === "{}" ? "(object)" : s;
    } catch {
      return String(v);
    }
  }
  return String(v);
}
