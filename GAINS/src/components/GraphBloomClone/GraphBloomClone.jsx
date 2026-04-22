// src/components/GraphBloomClone/GraphBloomClone.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import neo4j from "neo4j-driver";
import { createDriver } from "@/neo4jFacade";
import {
  rerunLayoutAndFit,
  applyActiveRule as applyActiveRuleRuntime,
  getActiveRule,
  setActiveRule as setActiveRuleRuntime,
} from "./ruleStylingRuntime";

import { readScenarios, writeScenarios, genId } from "./scenariosStore";
import { readActiveStyleRule } from "./styleRuleStore";
import MapOverlayFromZip from "./MapOverlayFromZip";
import NodesTable from "./NodesTable";

// subcomponents
import GraphCanvas from "./GraphCanvas";
import CompareCanvas from "./CompareCanvas";
import Toolbar from "./Toolbar";
import LeftPanel from "./LeftPanel";
import Inspector from "./Inspector";

// helpers
import {
  qIdent,
  isInt,
  toJSDeep,
  wrapLabel,
  sizeForWrapped,
  pickDisplay,
  intFromElementId,
  toStr,
  getNodeEid,
  getRelIds,
  nodePropKey,
  relPropKey,
  labelFlagKey,
  colorForIndex,
  isNeoNode,
  isNeoRel,
  isNeoPath,
  isVirtualRel,
  asEidFromAnyNodeRef,
  synthRelId,
  clampPanToKeepGraphOnScreen,
  HUD_SWATCHES,
  HUD_SIZES,
} from "./helper.js";
import { baseStylesheet } from "./styleManager.js";
// import { readScenarios, writeScenarios } from "./scenariosStore";
// import { nodePropKey } from "./helper";


/* --------- Env via Vite (no alias import) --------- */
// const NEO4J_URI = import.meta.env.VITE_NEO4J_URI ?? "";
// const NEO4J_USER = import.meta.env.VITE_NEO4J_USER ?? "";
// const NEO4J_PASSWORD = import.meta.env.VITE_NEO4J_PASSWORD ?? "";

/* ----------------------------- layout constants ----------------------------- */
const TOOLBAR_H = 56;
const INSPECTOR_GAP = 12;
const SPLIT_GUTTER = 12;

/* ----------------------------- component ----------------------------- */
export default function GraphBloomClone(props = {}) {
  const {
    mapOverlayVisible = false,
    onRequestCloseMapOverlay = () => {},
  } = props;
  const cyRef = useRef(null);
  const containerRef = useRef(null);

  // Compare (right) pane
  const cyCompareRef = useRef(null);

  // ===== DOWNLOAD HELPERS =====
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const downloadDataURI = (dataURI, filename) => {
  const a = document.createElement("a");
  a.href = dataURI;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// ===== LEFT (NORMAL) GRAPH: Download JSON =====
const handleDownloadLeftJSON = () => {
  try {
    const cyL = cyRef?.current;
    if (!cyL) {
      alert("Left graph is not ready.");
      return;
    }
    // Prefer the baseline captured when the graph was loaded; fallback to live elements.
    const els = (baselineRef.current?.elements?.length
      ? baselineRef.current.elements
      : cyL.elements().jsons()) || [];

    const payload = {
      source: baselineRef.current?.userQuery ? "cypher" : "graph-ui",
      userQuery: baselineRef.current?.userQuery || "",
      elements: els,
      pan: cyL.pan(),
      zoom: cyL.zoom(),
      meta: { counts: { nodes: cyL.nodes().length, edges: cyL.edges().length } },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "left_graph.json");
  } catch (e) {
    console.error(e);
    alert("Failed to download left graph JSON.");
  }
};

// ===== COMPARE: JSON of what loaded the RIGHT graph =====
const handleDownloadCompareJSON = () => {
  try {
    const all = readScenarios();
    const sc = all.find((s) => s.id === selectedScenarioId);
    if (!sc) {
      alert("No compare scenario found.");
      return;
    }
    const payload = {
      id: sc.id,
      name: sc.name,
      elements: sc.elements || [],
      meta: sc.meta || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const safe = (sc.name || sc.id || "compare").replace(/[^\w\-]+/g, "_");
    downloadBlob(blob, `${safe}_compare.json`);
  } catch (e) {
    console.error(e);
    alert("Failed to download compare JSON.");
  }
};

// ===== WHAT-IF: PDF (PNG fallback) of the LEFT graph =====
const handleDownloadWhatIfPDF = async () => {
  try {
    const cyL = cyRef?.current;
    if (!cyL) {
      alert("Graph is not ready.");
      return;
    }
    const pngData = cyL.png({ full: true, scale: 2, output: "base64uri" });
    try {
      const mod = await import("jspdf"); // optional; will fallback if not installed
      const { jsPDF } = mod;

      const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.src = pngData;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      const iw = img.width, ih = img.height;
      const ratio = Math.min(pageW / iw, pageH / ih);
      const w = Math.floor(iw * ratio);
      const h = Math.floor(ih * ratio);
      const x = Math.floor((pageW - w) / 2);
      const y = Math.floor((pageH - h) / 2);

      pdf.addImage(pngData, "PNG", x, y, w, h);
      pdf.save("what-if-graph.pdf");
    } catch {
      downloadDataURI(pngData, "what-if-graph.png");
      alert("PDF library not found; downloaded PNG instead.");
    }
  } catch (e) {
    console.error(e);
    alert("Failed to export the What-If graph.");
  }
};

// ===== LEFT (NORMAL) GRAPH: Save edited node properties (localStorage only) =====
const saveEditedPropsToLeft = async (nodeId, newProps) => {
  const cyL = cyRef.current;
  if (!cyL) return;
  const nid = String(nodeId);

  // 1) Patch live left graph so user sees it immediately
  const n = cyL.getElementById(nid);
  if (n && n.length) {
    cyL.batch(() => {
      Object.entries(newProps || {}).forEach(([k, v]) => n.data(nodePropKey(k), v));
    });
  }

  // 2) Update our baseline snapshot if present (keeps “what loaded” in sync)
  if (baselineRef.current?.elements?.length) {
    baselineRef.current.elements = baselineRef.current.elements.map((el) => {
      if (el?.group === "nodes" && String(el?.data?.id) === nid) {
        const flat = {};
        Object.entries(newProps || {}).forEach(([k, v]) => (flat[nodePropKey(k)] = v));
        return { ...el, data: { ...el.data, ...flat } };
      }
      return el;
    });
  }

  // 3) Persist a working copy for normal graph to localStorage (no scenarios touched)
  try {
    const snap = {
      updatedAt: Date.now(),
      elements: cyL.elements().jsons(),
      pan: cyL.pan(),
      zoom: cyL.zoom(),
      userQuery: baselineRef.current?.userQuery || userQuery || "",
    };
    window.localStorage.setItem("normal_graph_working_copy", JSON.stringify(snap));
  } catch (e) {
    console.warn("Could not persist normal_graph_working_copy:", e);
  }
};

  const compareContainerRef = useRef(null);

  // Baseline snapshot (original DB draw)
  const baselineRef = useRef({
    elements: [],
    pan: null,
    zoom: null,
    userQuery: "",
  });

  const [driver, setDriver] = useState(null);
  const driverRef = useRef(null);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  const [labels, setLabels] = useState([]);
  const [relTypes, setRelTypes] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [selectedRel, setSelectedRel] = useState("");
  const [limit, setLimit] = useState(100);
  const [status, setStatus] = useState("");

  const [nodeDetails, setNodeDetails] = useState(null);
  const [inspectorTab, setInspectorTab] = useState("details");
  const [showTable, setShowTable] = useState(true);

  // Query runner
  const [userQuery, setUserQuery] = useState(
    "MATCH p=(n)-[r]-(m) RETURN p LIMIT 50"
  );
  const [clearBeforeQuery, setClearBeforeQuery] = useState(true);

  // Rule system state (nodes only)
  const [rules, setRules] = useState([]);
  const baseStyleRef = useRef([]);
  const dynamicStyleRef = useRef([]);
  const quickStyleRef = useRef([]); // HUD + toolbar quick styles

  // Node rule UI (scoped to selectedLabel)
  const [nodeProps, setNodeProps] = useState([]);
  const [nProp, setNProp] = useState("");
  const [nMode, setNMode] = useState("single-equals");
  const [nEqualsVal, setNEqualsVal] = useState(null);
  const [nRangeMin, setNRangeMin] = useState("");
  const [nRangeMax, setNRangeMax] = useState("");
  const [nColor, setNColor] = useState("#22c55e");
  const [nSize, setNSize] = useState(0);
  const [nTextColor, setNTextColor] = useState("#0b1219");
  const [nDistinct, setNDistinct] = useState([]);
  const [nValueOptions, setNValueOptions] = useState([]);
  // ---- Gradient controls (range → mapData) ----
const [nSizeMin, setNSizeMin] = useState(20);
const [nSizeMax, setNSizeMax] = useState(64);
const [nColorMin, setNColorMin] = useState("#fde68a"); // light yellow
const [nColorMax, setNColorMax] = useState("#ef4444"); // red
const [nUseSizeGrad, setNUseSizeGrad] = useState(false);
const [nUseColorGrad, setNUseColorGrad] = useState(false);

  // --- NEW: Two-node compare rule UI state ---
const [cmpNodeA, setCmpNodeA] = useState("");
const [cmpNodeB, setCmpNodeB] = useState("");
const [cmpProp, setCmpProp] = useState("");
const [cmpGreaterColor, setCmpGreaterColor] = useState("#22c55e");
const [cmpLesserColor, setCmpLesserColor] = useState("#ef4444");
const [cmpEqualColor, setCmpEqualColor] = useState("#f59e0b");
const [cmpGreaterSize, setCmpGreaterSize] = useState(44);
const [cmpLesserSize, setCmpLesserSize] = useState(32);

// live list of all nodes on the LEFT canvas (id + caption used in the dropdowns)
const [canvasNodeOptions, setCanvasNodeOptions] = useState([]);

  // --- NEW: Rule target & node dropdown state ---
const [nTarget, setNTarget] = useState("property"); // 'property' | 'node'
const [nNodeId, setNNodeId] = useState("");         // selected node EID when nTarget='node'
const [hudNodes, setHudNodes] = useState([]);       // nodes for the dropdown [{id, caption}]

// --- NEW: Per-node numeric property picks & options ---
const [cmpPropA, setCmpPropA] = useState("");
const [cmpPropB, setCmpPropB] = useState("");
const [cmpPropsA, setCmpPropsA] = useState([]); // [{key, value}] numeric-only
const [cmpPropsB, setCmpPropsB] = useState([]);

  // Relationship color (only change we allow)
  const [rColor, setRColor] = useState("#f59e0b");

  const layoutBusyRef = useRef(false);

  // HUD state & presets
  const [hudCat, setHudCat] = useState(null);
  const [hudProps, setHudProps] = useState([]);
  const [hudCaption, setHudCaption] = useState(null);

  // Layout/UI
  const [fullGraph, setFullGraph] = useState(false);

  const HUD_SWATCHES_LOCAL = HUD_SWATCHES; // (not modified)
  const HUD_SIZES_LOCAL = HUD_SIZES;

  /* ---------------- Browser-like toolbar state ---------------- */
  const [layoutName, setLayoutName] = useState("cose");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [counts, setCounts] = useState({ n: 0, e: 0, sel: 0 });

  /* ---------------- What-if + Scenarios + Compare ---------------- */
  const [isWhatIf, setIsWhatIf] = useState(false);
  const isWhatIfRef = useRef(false); // for event handlers
  const [scenarioName, setScenarioName] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [isCompare, setIsCompare] = useState(false);
  const [showLeftTable, setShowLeftTable] = useState(true);
  const [showRightTable, setShowRightTable] = useState(true);
  const [inspectorPane, setInspectorPane] = useState("left"); // which pane's details
  // Legend visibility
const [showLegend, setShowLegend] = useState(true);
// --- Legend-based visibility (LEFT/original pane only) ---
const [visibleCats, setVisibleCats] = useState([]);         // categories selected in legend
const [isolatedNodeId, setIsolatedNodeId] = useState(null); // if set, show only this node

  
  // Save edited node properties back to the SAME compare scenario in localStorage only
const saveEditedPropsToScenario = async (nodeId, newProps) => {
  if (!isCompare || !selectedScenarioId) return;

  const all = readScenarios();
  const idx = all.findIndex((s) => s.id === selectedScenarioId);
  if (idx < 0) return;

  const sc = { ...all[idx] };
  const nid = String(nodeId);

  sc.elements = (sc.elements || []).map((el) => {
    if (el?.group === "nodes" && String(el?.data?.id) === nid) {
      const flat = {};
      Object.entries(newProps || {}).forEach(([k, v]) => {
        flat[nodePropKey(k)] = v; // store under p__* keys
      });
      return { ...el, data: { ...el.data, ...flat } };
    }
    return el;
  });

  all[idx] = sc;
  writeScenarios(all);       // <-- localStorage ONLY
  setScenarios(all);         // keep React state in-sync

  // live-patch the RIGHT (compare) Cytoscape view so edits are visible immediately
  const cyR = cyCompareRef.current;
  if (cyR && !cyR.destroyed) {
    const n = cyR.getElementById(nid);
    if (n && n.length) {
      cyR.batch(() => {
        Object.entries(newProps || {}).forEach(([k, v]) => {
          n.data(nodePropKey(k), v);
        });
      });
    }
  }
  // left/baseline graph is untouched
};

  // Theme: 'dark' | 'light'
  const [theme, setTheme] = useState("dark");

  //NEW
  // --- Caption preference per label (e.g., { Person: "name", Movie: "title" }) ---
const [captionByLabel, setCaptionByLabel] = useState(() => {
  try { return JSON.parse(localStorage.getItem("captionByLabel") || "{}"); }
  catch { return {}; }
});


// Heuristic when user didn't choose a caption yet
const autoPickCaptionField = (props) => {
  if (!props || typeof props !== "object") return null;
  const prefer = ["name", "title", "description"];
  for (const k of prefer) {
    const v = props[k];
    if (v != null && String(v).trim?.()) return k;
  }
  // fallback: first scalar-ish prop
  for (const [k, v] of Object.entries(props)) {
    if (v != null && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      return k;
    }
  }
  return null;
};

// Turn props + labels + eid into a final caption string
const buildCaptionText = (props, labels, eid, chosenField) => {
  const firstLabel = (labels?.[0] || "").trim();

  // Special tokens
  if (chosenField === "<id>") return String(eid || "");
  if (chosenField === "<label>") return firstLabel || "(unlabeled)";

  // Concrete property
  if (chosenField && props && props[chosenField] != null) {
    const v = props[chosenField];
    const s = Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
    if (s.trim()) return s;
  }

  // Fallback chain when chosenField missing/empty
  const auto = autoPickCaptionField(props);
  if (auto && props && props[auto] != null) {
    const v = props[auto];
    const s = Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
    if (s.trim()) return s;
  }
  if (firstLabel) return firstLabel;
  return "(node)";
};

// Update preference & re-caption existing nodes of that label
const setCaptionPref = (label, field) => {
  setCaptionByLabel((prev) => {
    const next = { ...prev };
    try { localStorage.setItem("captionByLabel", JSON.stringify(next)); } catch {}
    if (!field || field === "<auto>") delete next[label];
    else next[label] = field;
    return next;
  });
  // Re-caption already drawn nodes of this label
  setCaptionForCategorySingle(label, field === "<auto>" ? null : field);
};


  const THEMES = {
    dark: {
      appBg: "#0b0e13",
      panelBg: "#0f1116",
      cardBg: "#15171d",
      border: "#2c313c",
      text: "#e5e7eb",
      subtext: "#9aa3b2",
      ctrlBg: "#15171d",
      ctrlBr: "#374151",
    },
    light: {
      appBg: "#ffffff",
      panelBg: "#f8fafc",
      cardBg: "#f1f5f9",
      border: "#e5e7eb",
      text: "#0b1219",
      subtext: "#334155",
      ctrlBg: "#ffffff",
      ctrlBr: "#e2e8f0",
    },
  };
  const t = THEMES[theme];

  // Which pane was clicked last (for Auto mode)
  const [lastPane, setLastPane] = useState("left"); // 'left' | 'right'

  // Toolbar target: which pane(s) actions apply to
  const [targetMode, setTargetMode] = useState("auto"); // 'left' | 'right' | 'both' | 'auto'

  // Get cy by pane name
  const getCy = useCallback((pane) => {
    if (pane === "right") return cyCompareRef.current;
    return cyRef.current; // 'left' default
  }, []);

  // Resolve pane list from target
  const resolvePanes = useCallback(
    (mode) => {
      const m = mode || targetMode;
      if (m === "left" || m === "right") return [m];
      if (m === "both") return ["left", "right"];
      // auto
      return [lastPane || "left"];
    },
    [targetMode, lastPane]
  );

  // Call a function for each target pane
  const forEachTarget = useCallback(
    (fn, mode) => {
      resolvePanes(mode).forEach((p) => {
        const cy = getCy(p);
        if (cy) fn(cy, p);
      });
    },
    [getCy, resolvePanes]
  );

  const colorSeqRef = React.useRef(0);

  /* ---- Color-by-name (label) + Legend helpers ---- */
  const CAT_PALETTE = useMemo(
    () =>
      theme === "light"
        ? [
            "#b91c1c",
            "#b45309",
            "#3f6212",
            "#0f766e",
            "#0e7490",
            "#1d4ed8",
            "#6d28d9",
            "#9d174d",
            "#0d9488",
            "#a16207",
            "#15803d",
            "#4d7c0f",
            "#16a34a",
            "#0e7490",
            "#2563eb",
            "#4f46e5",
            "#7c3aed",
            "#db2777",
            "#c2410c",
            "#a16207",
            "#059669",
            "#06b6d4",
            "#3b82f6",
            "#ec4899",
          ]
        : [
            "#ef4444",
            "#f59e0b",
            "#84cc16",
            "#10b981",
            "#06b6d4",
            "#3b82f6",
            "#8b5cf6",
            "#ec4899",
            "#14b8a6",
            "#eab308",
            "#22c55e",
            "#a3e635",
            "#4ade80",
            "#2dd4bf",
            "#60a5fa",
            "#818cf8",
            "#a78bfa",
            "#f472b6",
            "#f97316",
            "#fde047",
            "#34d399",
            "#67e8f9",
            "#93c5fd",
            "#f9a8d4",
          ],
    [theme]
  );

  const hashString = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h);
  };

  const colorForCategory = useCallback(
    (cat) => CAT_PALETTE[hashString(String(cat)) % CAT_PALETTE.length],
    [CAT_PALETTE]
  );

  // legend items [{cat, color, count}]
  const [legendItems, setLegendItems] = useState([]);

  
  const rebuildLegend = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const groups = new Map();
    cy.nodes().forEach((n) => {
      const cat = n.data("bgCat") || (n.data("_labels")?.[0] || "(unlabeled)");
      const color = n.data("bgColor");
      if (!cat || !color) return;
      const g = groups.get(cat) || { cat, color, count: 0 };
      g.count++;
      groups.set(cat, g);
    });
    setLegendItems(
      Array.from(groups.values()).sort((a, b) => a.cat.localeCompare(b.cat))
    );
  }, []);

  const fitNow = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.elements().length === 0) return;
    cy.resize();
    cy.fit(cy.elements(), 40);
    setCounts({
      n: cy.nodes().length,
      e: cy.edges().length,
      sel: cy.$(":selected").length,
    });
  }, [setCounts]);

  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyRef.current;
      if (!cy) return;
      const saved = readActiveStyleRule();
      if (saved) {
        setActiveRuleRuntime(cy, saved);
        applyActiveRuleRuntime(cy);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
  // Sync the outer shell/content background with the graph theme
  const root = document.documentElement;
  const prev = root.style.getPropertyValue("--app-bg");
  root.style.setProperty("--app-bg", t.appBg || "#0b0e13");
  return () => {
    // optional cleanup: restore previous value on unmount
    root.style.setProperty("--app-bg", prev || "");
  };
}, [t.appBg]);

  useEffect(() => {
    setScenarios(readScenarios());
  }, []);
  useEffect(() => {
    isWhatIfRef.current = isWhatIf;
    const cy = cyRef.current;
    if (cy) cy.boxSelectionEnabled(isWhatIf);
  }, [isWhatIf]);

  /* ------------------------------ style & cy init ------------------------------ */
  const toolbarStyle = useMemo(
    () => ({
      position: "absolute",
      top: 10,
      left: 10,
      right: 10,
      zIndex: 50,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      background: t.panelBg,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "6px 8px",
      boxShadow: "0 8px 20px rgba(0,0,0,.15)",
      maxWidth: "calc(100% - 20px)",
      overflowX: "auto",
    }),
    [t.panelBg, t.border]
  );

  useEffect(() => {
    baseStyleRef.current = baseStylesheet;
  }, []);

  // --- helper: sync node border to fill on both panes ---
  const syncBordersToFill = useCallback(() => {
    const sync = (cy) => {
      if (!cy) return;
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          const fill = n.style("background-color");
          if (fill) n.style("border-color", fill);
        });
      });
    };
    sync(cyRef.current);
    sync(cyCompareRef.current);
  }, []);

  // --- applyStyle with pane-aware quick styles ---
  const applyStyle = useCallback(() => {
    const cyL = cyRef.current;
    const cyR = cyCompareRef.current;

    const base = [...baseStyleRef.current, ...dynamicStyleRef.current];

    const quick = quickStyleRef.current; // items may have __pane: 'left' | 'right'
    const leftQuick = quick.filter((s) => !s.__pane || s.__pane === "left");
    const rightQuick = quick.filter((s) => !s.__pane || s.__pane === "right");

    if (cyL) cyL.batch(() => cyL.style().fromJson([...base, ...leftQuick]).update());
    if (cyR) cyR.batch(() => cyR.style().fromJson([...base, ...rightQuick]).update());

    syncBordersToFill();
  }, [syncBordersToFill]);

  useEffect(() => {
    const recolorByTheme = (cy) => {
      if (!cy) return;
      cy.batch(() => {
  cy.nodes().forEach((n) => {
    const cat = n.data("bgCat") || (n.data("_labels")?.[0] || "(unlabeled)");
    const col = colorForCategory(cat);
    n.data("bgColor", col);
    n.data("borderColor", col);
  });
});

    };

    recolorByTheme(cyRef.current);
    recolorByTheme(cyCompareRef.current);
    applyStyle();
    rebuildLegend();
  }, [theme, applyStyle, rebuildLegend]);

  /* ------------------- Compare: split left canvas width only ------------------- */
  useEffect(() => {
  const left  = containerRef.current;
  const right = compareContainerRef.current;
  if (!left) return;

  const half  = `calc(50% - ${SPLIT_GUTTER / 2}px)`;
  const topPx = `${TOOLBAR_H}px`;
  const h     = `calc(100% - ${TOOLBAR_H}px)`;

  let raf = 0;

  let tries = 0;
const MAX_TRIES = 120; // ~2 seconds at 60fps

  const applySplit = () => {
    const cyL = cyRef.current;
    const cyR = cyCompareRef.current;

    if (!isCompare) {
      // Compare OFF → single canvas
      Object.assign(left.style, {
        position: "absolute", left: 0, right: 0, width: "auto",
        top: topPx, height: h,
      });
      if (right) Object.assign(right.style, { display: "none" });
      requestAnimationFrame(() => {
        if (cyL) { cyL.resize(); if (cyL.elements().length) cyL.fit(cyL.elements(), 40); }
      });
      return;
    }

    // Compare ON → wait for right to mount & have size
   const host = right;
const rect = host?.getBoundingClientRect?.();
if (!host || !rect || rect.width === 0 || rect.height === 0) {
  if (tries++ < MAX_TRIES) {
    raf = requestAnimationFrame(applySplit);
  } else {
    console.warn("Compare split: right pane never sized; leaving left full-width.");
  }
  return; // ⬅️ don’t proceed until the right pane has a real size
}


    // Right ready → split
    Object.assign(left.style, {
      position: "absolute", left: 0, right: "auto", width: half,
      top: topPx, height: h,
    });
    Object.assign(right.style, {
      position: "absolute",
      left: `calc(50% + ${SPLIT_GUTTER / 2}px)`,
      right: 0, width: half,
      top: topPx, height: h, display: "block",
    });

    requestAnimationFrame(() => {
      if (cyL) { cyL.resize(); if (cyL.elements().length) cyL.fit(cyL.elements(), 40); }
      if (cyR) { cyR.resize(); if (cyR.elements().length) cyR.fit(cyR.elements(), 40); }
    });
  };

  // first pass
  applySplit();
  // second pass to catch late mount/size of the right pane
  if (isCompare) raf = requestAnimationFrame(applySplit);

  return () => { if (raf) cancelAnimationFrame(raf); };
}, [isCompare]);

  const fit = useCallback(() => {
    forEachTarget((cy) => {
      if (!cy || cy.elements().length === 0) return;
      cy.resize();
      cy.fit(cy.elements(), 40);
    });
  }, [forEachTarget]);

  const runLayout = useCallback(() => {
    const makeOptions = () => {
      switch (layoutName) {
        case "breadthfirst":
          return {
            name: "breadthfirst",
            directed: false,
            spacingFactor: 1.1,
            padding: 80,
            animate: false,
          };
        case "concentric":
          return { name: "concentric", minNodeSpacing: 60, padding: 80, animate: false };
        case "circle":
          return { name: "circle", padding: 80, animate: false };
        case "grid":
          return { name: "grid", padding: 80, avoidOverlap: true, animate: false };
        case "cose":
        default:
          return {
            name: "cose",
            animate: false,
            randomize: false,
            idealEdgeLength: 120,
            nodeRepulsion: 900000,
            nodeOverlap: 10,
            gravity: 80,
            numIter: 1200,
            componentSpacing: 90,
            padding: 80,
          };
      }
    };
    const options = makeOptions();
    forEachTarget((cy) => {
      if (!cy) return;
      const invalid = cy
        .nodes()
        .toArray()
        .some(
          (n) =>
            !Number.isFinite(n.position("x")) || !Number.isFinite(n.position("y"))
        );
      if (invalid) cy.layout({ name: "grid", padding: 80, animate: false }).run();
      requestAnimationFrame(() => {
        cy.layout(options).run();
        cy.once("layoutstop", () => {
          cy.resize();
          if (cy.elements().length) cy.fit(cy.elements(), 40);
        });
      });
    });
  }, [layoutName, forEachTarget]);

  /* ---------- force render + fit (and grid fallback if positions invalid) ---------- */
  const forceRenderAndFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const invalid = cy
      .nodes()
      .toArray()
      .some(
        (n) =>
          !Number.isFinite(n.position("x")) || !Number.isFinite(n.position("y"))
      );
    if (invalid) {
      cy.layout({ name: "grid", padding: 80, animate: false }).run();
    }

    requestAnimationFrame(() => {
      cy.resize();
      if (cy.elements().length) {
        cy.fit(cy.elements(), 40);
      }
      setCounts({
        n: cy.nodes().length,
        e: cy.edges().length,
        sel: cy.$(":selected").length,
      });
    });
  }, [setCounts]);

  /* --------------------------- connect Neo4j (safe) --------------------------- */
  // useEffect(() => {
  //   if (!NEO4J_URI) {
  //     setStatus("Configure VITE_NEO4J_* in .env.local and restart the dev server.");
  //     return;
  //   }

  //   let d;
  //   try {
  //     d = neo4j.driver(
  //       NEO4J_URI,
  //       neo4j.auth.basic(NEO4J_USER || "", NEO4J_PASSWORD || "")
  //     );
  //   } catch (e) {
  //     console.error("Driver init error:", e);
  //     setStatus("Neo4j driver init error: " + (e.message || String(e)));
  //     return;
  //   }

  //   setDriver(d);

  //   (async () => {
  //     try {
  //       await d.verifyConnectivity();
  //       setStatus("Connected to Neo4j.");
  //       const s1 = d.session({ defaultAccessMode: neo4j.session.READ });
  //       const r1 = await s1.run(
  //         "CALL db.labels() YIELD label RETURN label ORDER BY label"
  //       );
  //       await s1.close();
  //       const s2 = d.session({ defaultAccessMode: neo4j.session.READ });
  //       const r2 = await s2.run(
  //         "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType"
  //       );
  //       await s2.close();
  //       setLabels(r1.records.map((r) => String(r.get("label"))));
  //       setRelTypes(r2.records.map((r) => String(r.get("relationshipType"))));
  //     } catch (e) {
  //       console.error(e);
  //       setStatus("Connection error: " + (e.message || String(e)));
  //     }
  //   })();

  //   return () => {
  //     try {
  //       d.close();
  //     } catch {}
  //   };
  // }, []);
  /* --------------------------- connect Neo4j (safe) --------------------------- */
useEffect(() => {
  let d;
  try {
    d = createDriver(); // 👈 use the backend-powered facade (read-only)
  } catch (e) {
    console.error("Driver init error:", e);
    setStatus("Neo4j driver init error: " + (e.message || String(e)));
    return;
  }

  setDriver(d);

  (async () => {
    try {
      // Facade provides verifyConnectivity() that does a cheap RETURN 1
      if (typeof d.verifyConnectivity === "function") {
        await d.verifyConnectivity();
      }
      setStatus("Connected to Neo4j.");

      const s1 = d.session({ defaultAccessMode: neo4j.session.READ });
      const r1 = await s1.run(
        "CALL db.labels() YIELD label RETURN label ORDER BY label"
      );
      await s1.close();

      const s2 = d.session({ defaultAccessMode: neo4j.session.READ });
      const r2 = await s2.run(
        "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType"
      );
      await s2.close();

      setLabels(r1.records.map((r) => String(r.get("label"))));
      setRelTypes(r2.records.map((r) => String(r.get("relationshipType"))));
    } catch (e) {
      console.error(e);
      setStatus("Connection error: " + (e.message || String(e)));
    }
  })();

  return () => {
    try {
      d.close(); // no-op in facade; still fine
    } catch {}
  };
}, []);


  /* ----------------------------- adders ----------------------------- */
  const addNodeByEid = (cy, neoNode, eid, fallbackLabel) => {
    const id = String(eid);
    if (cy.getElementById(id).length) return cy.getElementById(id);

    const labels = neoNode?.labels?.map(String) ?? [];
    // const props = toJSDeep(neoNode?.properties || {});
    // const title = (pickDisplay(props, fallbackLabel) || fallbackLabel || "(node)").trim();
    // const wrapped = wrapLabel(title, 8, 3);
    //NEW
    const props = toJSDeep(neoNode?.properties || {});
// Which field to use for this label?
const chosenField =
  captionByLabel[(labels[0] || fallbackLabel || "").trim()] ?? "<auto>";
const title = buildCaptionText(
  props,
  labels,
  id, // elementId as string
  chosenField === "<auto>" ? null : chosenField
).trim();
const wrapped = wrapLabel(title, 8, 3);

    const sizeRaw = sizeForWrapped(wrapped);
    const size = Math.max(28, Number.isFinite(sizeRaw) ? sizeRaw : 0);

    const flat = {};
Object.entries(props).forEach(([k, v]) => {
  let out = v;

  // Coerce number-like strings (allow commas & decimals) to real numbers
  if (typeof out === "string") {
    const s = out.trim();
    const looksNumeric =
      /^[+-]?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s) || // e.g. 100,000.50
      /^[+-]?\d+(\.\d+)?$/.test(s);                // e.g. 100000 or 100000.5
    if (looksNumeric) out = parseFloat(s.replace(/,/g, ""));
  }

  flat[nodePropKey(k)] = out;
});
labels.forEach((lb) => {
  flat[labelFlagKey(lb)] = 1;
});
flat._labels = labels;


    // color-by-name (label)
    // keep category for legend/filtering, but color each node uniquely by its id
// color-by-name (label) → same label/type gets same color
const cat = (labels[0] || fallbackLabel || "(unlabeled)").trim();
flat.bgCat = cat;
flat.bgColor = flat.bgColor ?? colorForCategory(cat);
flat.borderColor = flat.bgColor;


    cy.add({ group: "nodes", data: { id, label: wrapped, size, ...flat } });

    return cy.getElementById(id);
  };

  const addEdgeByEids = (cy, neoRelOrVRel, rid, sid, tid) => {
    const id = String(rid);
    if (cy.getElementById(id).length) return;
    const type = String(neoRelOrVRel?.type || "");
    const props = toJSDeep(neoRelOrVRel?.properties || {});
    const flat = {};
    Object.entries(props).forEach(([k, v]) => {
      flat[relPropKey(k)] = v;
    });

    if (!cy.getElementById(String(sid)).length) addNodeByEid(cy, null, sid, "(no value)");
    if (!cy.getElementById(String(tid)).length) addNodeByEid(cy, null, tid, "(no value)");

    cy.add({
      group: "edges",
      data: { id, source: String(sid), target: String(tid), type, ...flat },
    });
  };

  /* ----------------------------- loaders ----------------------------- */
const loadNodesByLabel = async () => {
  if (!driver || !selectedLabel) return;
  setNodeDetails(null);

  const cy = cyRef.current;
  const s = driver.session({ defaultAccessMode: neo4j.session.READ });

  // normalize mode defensively (handles stray spaces or case)
  const mode = String(nMode || "").toLowerCase().trim();
  const isSingleEquals = mode === "single-equals";

  try {
    let res;

    // tiny debug to verify which branch we take (remove later if you want)
    setStatus(
      `Mode=${mode} · prop=${String(nProp || "")} · val=${JSON.stringify(
        nEqualsVal
      )} · label=${selectedLabel}`
    );

    if (isSingleEquals) {
      // Always load exactly ONE node in this mode (ignore the Limit box)
      if (nProp && nEqualsVal !== null && nEqualsVal !== undefined) {
        const q = `
          MATCH (n:${qIdent(selectedLabel)})
          WHERE n[$prop] = $val
          RETURN n, elementId(n) AS eid
          LIMIT 1
        `;
        res = await s.run(q, { prop: nProp, val: nEqualsVal });
      } else {
        const q = `
          MATCH (n:${qIdent(selectedLabel)})
          RETURN n, elementId(n) AS eid
          LIMIT 1
        `;
//         const q = `
//   MATCH (n:${qIdent(selectedLabel)})
//   RETURN n, elementId(n) AS eid
//   LIMIT toInteger($limit)
// `;

        res = await s.run(q);
      }
    } else {
  // Other modes keep honoring the Limit input
  const lim = Math.max(0, parseInt(limit || 0, 10) || 0);
  const q = `
    MATCH (n:${qIdent(selectedLabel)})
    RETURN n, elementId(n) AS eid
    LIMIT toInteger($limit)
  `;
  res = await s.run(q, { limit: Number(lim) });
}

   res.records.forEach((rec) =>
      addNodeByEid(cy, rec.get("n"), rec.get("eid"), selectedLabel)
    );

    setStatus(
      `Loaded ${res.records.length} “${selectedLabel}” node${res.records.length === 1 ? "" : "s"}.`
    );

    runLayout();
    applyStyle();
    rebuildLegend();
    cy.once("layoutstop", forceRenderAndFit);
    setTimeout(forceRenderAndFit, 0);

    baselineRef.current = {
      elements: cy.elements().jsons(),
      pan: cy.pan(),
      zoom: cy.zoom(),
      userQuery: "",
    };
  } catch (e) {
    console.error(e);
    setStatus(e.message || String(e));
  } finally {
    await s.close();
  }
};

  const loadRelationships = async () => {
    if (!driver || !selectedRel) return;
    setNodeDetails(null);
    const cy = cyRef.current;
    const s = driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const lim = Math.max(0, parseInt(limit || 0, 10) || 0);
      // const q = `
      //   MATCH (a)-[r:${qIdent(selectedRel)}]-(b)
      //   RETURN a, b, r, elementId(a) AS aid, elementId(b) AS bid, elementId(r) AS rid
      //   LIMIT $limit
      // `;
      const q = `
  MATCH (a)-[r:${qIdent(selectedRel)}]-(b)
  RETURN a, b, r, elementId(a) AS aid, elementId(b) AS bid, elementId(r) AS rid
  LIMIT toInteger($limit)
`;
      // const res = await s.run(q, { limit: neo4j.int(lim) });
      const res = await s.run(q, { limit: Number(lim) });
      res.records.forEach((rec) => {
        const a = rec.get("a"),
          b = rec.get("b"),
          r = rec.get("r");
        const aid = rec.get("aid"),
          bid = rec.get("bid"),
          rid = rec.get("rid");
        addNodeByEid(cy, a, aid, a?.labels?.[0] || "");
        addNodeByEid(cy, b, bid, b?.labels?.[0] || "");
        addEdgeByEids(cy, r, rid, aid, bid);
      });
      setStatus(`Loaded ${res.records.length} “${selectedRel}” relationships.`);
      runLayout();
      applyStyle();
      rebuildLegend();
      cy.once("layoutstop", forceRenderAndFit);
      setTimeout(forceRenderAndFit, 0);
      baselineRef.current = {
        elements: cy.elements().jsons(),
        pan: cy.pan(),
        zoom: cy.zoom(),
        userQuery: "",
      };
    } catch (e) {
      console.error(e);
      setStatus(e.message || String(e));
    } finally {
      await s.close();
    }
  };

  /* --------------------- details on click --------------------- */
  const fetchAndShowNodeDetails = async (eid) => {
    const d = driverRef.current;
    if (!d || !eid) return;
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      let res = await s.run(
        `
        MATCH (n) WHERE elementId(n) = $id
        RETURN n, labels(n) AS labels, elementId(n) AS eid
      `,
        { id: String(eid) }
      );

      if (!res.records.length) {
        const idInt = intFromElementId(eid);
        if (idInt) {
          res = await s.run(
            `
            MATCH (n) WHERE id(n) = $idInt
            RETURN n, labels(n) AS labels, elementId(n) AS eid
          `,
            { idInt }
          );
        }
      }

      if (!res.records.length) {
        setStatus(`No node matched elementId "${eid}".`);
        setNodeDetails({ id: String(eid), labels: [], props: {} });
        return;
      }

      const rec = res.records[0];
      const node = rec.get("n");
      const labels = (rec.get("labels") || node.labels || []).map(String);
      const props = toJSDeep(node.properties || {});
      const eidExact = rec.get("eid") || String(eid);

      setNodeDetails({ id: String(eidExact), labels, props });
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(e.message || String(e));
    } finally {
      await s.close();
    }
  };

  // --- NEW: fetch and show relationship (edge) details ---
const fetchAndShowEdgeDetails = async (eid) => {
  const d = driverRef.current;
  if (!d || !eid) return;

  const s = d.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const q = `
      MATCH ()-[r]->()
      WHERE elementId(r) = $id
      RETURN r, type(r) AS type,
             elementId(startNode(r)) AS startId,
             elementId(endNode(r)) AS endId
    `;
    const res = await s.run(q, { id: String(eid) });
    if (!res.records.length) return;

    const rec = res.records[0];
    const r = rec.get("r");
    const type = rec.get("type");
    const props = toJSDeep(r.properties || {});
    const startId = rec.get("startId");
    const endId = rec.get("endId");

    setNodeDetails({
      id: String(eid),
      labels: [type],
      props: {
        ...props,
        startNodeId: startId,
        endNodeId: endId,
      },
    });
    setInspectorTab("details");
  } catch (e) {
    console.error(e);
    setStatus("Failed to fetch relationship details: " + e.message);
  } finally {
    await s.close();
  }
};

  /* ------------------- Expand like Neo4j Browser ------------------- */
  const expandKHops = async (eid, hops = 1) => {
    const d = driverRef.current;
    const cy = cyRef.current;
    if (!d || !cy || !eid) return;
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      // Use the UI "Limit" if it is a positive integer; otherwise fall back to 50
      const parsed = parseInt(limit, 10);
      const lim = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
      let q = `
        MATCH (n) WHERE elementId(n) = $id
        MATCH p=(n)-[r*1..${hops}]-()
        UNWIND relationships(p) AS rel
        WITH DISTINCT rel
        WITH startNode(rel) AS a, rel AS r, endNode(rel) AS b
        RETURN a, b, r, elementId(a) AS aid, elementId(b) AS bid, elementId(r) AS rid
        LIMIT toInteger($limit)
      `;
      let res = await s.run(q, { id: String(eid), limit: Number(lim) });

      if (!res.records.length) {
        const idInt = intFromElementId(eid);
        if (idInt) {
          q = q.replace("elementId(n) = $id", "id(n) = $idInt");
          // res = await s.run(q, { idInt, limit: neo4j.int(lim) });
          res = await s.run(q, { idInt, limit: Number(lim) });
        }
      }

      let added = 0;
      res.records.forEach((rec) => {
        const a = rec.get("a"),
          b = rec.get("b"),
          r = rec.get("r");
        const aid = rec.get("aid"),
          bid = rec.get("bid"),
          rid = rec.get("rid");
        addNodeByEid(cy, a, aid, a?.labels?.[0] || "");
        addNodeByEid(cy, b, bid, b?.labels?.[0] || "");
        const before = cy.elements().length;
        addEdgeByEids(cy, r, rid, aid, bid);
        const after = cy.elements().length;
        if (after > before) added++;
      });

      if (added > 0) runLayout();
      setStatus(added ? `Expanded ${added} connection(s).` : "Nothing new to expand.");
      applyStyle();
      rebuildLegend();
    } catch (e) {
      console.error(e);
      setStatus(e.message || String(e));
    } finally {
      await s.close();
    }
  };

  const clearGraph = () => {
    const cy = cyRef.current;
    cy?.elements().remove();
    setLegendItems([]);
    setNodeDetails(null);
    setSelectedLabel("");
    setSelectedRel("");
    setStatus("");
    setVisibleCats([]);
setIsolatedNodeId(null);

    baselineRef.current = {
      elements: [],
      pan: null,
      zoom: null,
      userQuery: "",
    };
  };

  /* ========================= Query runner (APOC vRels + connect result nodes) ========================= */
  const harvestFromPath = (p, nodeMap, relMap, idMap) => {
    const segs = p.segments || [];
    segs.forEach((seg) => {
      const se = getNodeEid(seg.start),
        ee = getNodeEid(seg.end);
      nodeMap.set(se, seg.start);
      nodeMap.set(ee, seg.end);
      if (seg.start?.identity) idMap.set(toStr(seg.start.identity), se);
      if (seg.end?.identity) idMap.set(toStr(seg.end.identity), ee);
      const [rid, sidRaw, tidRaw] = getRelIds(seg.relationship);
      const sid = idMap.get(String(sidRaw)) ?? String(sidRaw);
      const tid = idMap.get(String(tidRaw)) ?? String(tidRaw);
      relMap.set(rid, { rel: seg.relationship, sid, tid });
    });
  };

  const harvestAny = (val, nodeMap, relMap, idMap) => {
    if (!val && val !== 0) return;

    if (isVirtualRel(val)) {
      const type = String(val.type || "");
      const props = toJSDeep(val.properties || val.props || {});
      const sRef =
        "startNode" in val
          ? val.startNode
          : "start" in val
          ? val.start
          : "startNodeId" in val
          ? val.startNodeId
          : "from" in val
          ? val.from
          : null;
      const tRef =
        "endNode" in val
          ? val.endNode
          : "end" in val
          ? val.end
          : "endNodeId" in val
          ? val.endNodeId
          : "to" in val
          ? val.to
          : null;

      const sid = asEidFromAnyNodeRef(sRef, idMap);
      const tid = asEidFromAnyNodeRef(tRef, idMap);
      if (sid && tid) {
        const rid = synthRelId(type, sid, tid, props);
        relMap.set(rid, { rel: { type, properties: props }, sid, tid });
      }
      return;
    }

    if (isNeoRel(val)) {
      const [rid, sidRaw, tidRaw] = getRelIds(val);
      const sid = idMap.get(String(sidRaw)) ?? String(sidRaw);
      const tid = idMap.get(String(tidRaw)) ?? String(tidRaw);
      relMap.set(rid, { rel: val, sid, tid });
      return;
    }

    if (isNeoNode(val)) {
      const eid = getNodeEid(val);
      nodeMap.set(eid, val);
      if (val.identity) idMap.set(toStr(val.identity), eid);
      return;
    }

    if (isNeoPath(val)) {
      harvestFromPath(val, nodeMap, relMap, idMap);
      return;
    }

    if (Array.isArray(val)) {
      val.forEach((v) => harvestAny(v, nodeMap, relMap, idMap));
      return;
    }
    if (typeof val === "object") {
      Object.values(val).forEach((v) => harvestAny(v, nodeMap, relMap, idMap));
    }
  };

  const connectResultNodes = async (nodeIds, edgeCap = 2000) => {
    const d = driverRef.current;
    const cy = cyRef.current;
    if (!d || !cy) return;
    const eids = [];
    const ints = [];
    // for (const id of nodeIds) {
    //   if (/^\d+$/.test(id)) ints.push(neo4j.int(id));
    //   else eids.push(String(id));
    // }
    for (const id of nodeIds) {
if (/^\d+$/.test(id)) ints.push(Number(id));
else eids.push(String(id));
}
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const addFromResult = (res) => {
        res.records.forEach((rec) => {
          const a = rec.get("a"),
            b = rec.get("b"),
            r = rec.get("r");
          const aid = rec.get("aid"),
            bid = rec.get("bid"),
            rid = rec.get("rid");
          addNodeByEid(cy, a, aid, a?.labels?.[0] || "");
          addNodeByEid(cy, b, bid, b?.labels?.[0] || "");
          addEdgeByEids(cy, r, rid, aid, bid);
        });
      };
      if (eids.length) {
        const q1 = `
          UNWIND $ids AS id
          MATCH (n) WHERE elementId(n) = id
          WITH collect(n) AS ns
          UNWIND ns AS a
          MATCH (a)-[r]-(b)
          WHERE b IN ns
          RETURN a,b,r, elementId(a) AS aid, elementId(b) AS bid, elementId(r) AS rid
          LIMIT toInteger($edgeCap)
        `;
        // const res1 = await s.run(q1, {
        //   ids: eids,
        //   edgeCap: neo4j.int(edgeCap),
        // });
        const res1 = await s.run(q1, { ids: eids, edgeCap: Number(edgeCap) });
        addFromResult(res1);
      }
      if (ints.length) {
        const q2 = `
          UNWIND $ids AS idInt
          MATCH (n) WHERE id(n) = idInt
          WITH collect(n) AS ns
          UNWIND ns AS a
          MATCH (a)-[r]-(b)
          WHERE b IN ns
          RETURN a,b,r, elementId(a) AS aid, elementId(b) AS bid, elementId(r) AS rid
          LIMIT toInteger($edgeCap)

        `;
        // const res2 = await s.run(q2, {
        //   ids: ints,
        //   edgeCap: neo4j.int(edgeCap),
        // });
        const res2 = await s.run(q2, { ids: ints, edgeCap: Number(edgeCap) });
        addFromResult(res2);
      }
    } catch (e) {
      console.error(e);
      setStatus((prev) =>
        prev ? prev + " · connect step error" : "connect step error"
      );
    } finally {
      await s.close();
    }
  };

  const runUserQuery = async (qOverride) => {
    const d = driverRef.current;
    const cy = cyRef.current;
    if (!d || !cy) return;

    const q = String((qOverride ?? userQuery) || "").trim();
    // ensure LIMIT params are integers even if the param value is floaty (e.g., 100.0)
   const qEff = q
  .replace(/LIMIT\s+\$limit/gi, "LIMIT toInteger($limit)")
  .replace(/LIMIT\s+\$edgecap/gi, "LIMIT toInteger($edgeCap)");

    if (!q) {
      setStatus("Enter a Cypher query.");
      return;
    }

    const dangerous =
  /\b(merge|delete|detach|set|remove|drop|index|constraint|load\s+csv|import)\b/i;
    const usesCreate = /\bcreate\b/i.test(q);
    const apocVirtualOK =
      /\bapoc\.create\.(vRelationship|vNode|vNodes|vPath)\b/i.test(q);

    if (dangerous.test(q) || (usesCreate && !apocVirtualOK)) {
      setStatus("Write operations are disabled in this app. Please run read-only queries.");
      return;
    }

    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    const startTs = performance.now();

    try {
      // const res = await s.run(q);
      // Bind params only if they appear in the user query
const params = {};
// if (/\$limit\b/i.test(q)) {
//   params.limit = neo4j.int(Math.max(0, parseInt(limit || 0, 10) || 0));
// }
// if (/\$edgeCap\b/i.test(q)) {
//   const cap = Math.min((Math.max(0, parseInt(limit || 0, 10) || 100)) * 10, 2000);
//   params.edgeCap = neo4j.int(cap);
// }
if (/\$limit\b/i.test(q)) {
  params.limit = Number(Math.max(0, parseInt(limit || 0, 10) || 0));
}
if (/\$edgeCap\b/i.test(q)) {
  const cap = Math.min((Math.max(0, parseInt(limit || 0, 10) || 100)) * 10, 2000);
  params.edgeCap = Number(cap);
}

// const res = await s.run(q, params);
const res = await s.run(qEff, params);



      const nodeMap = new Map();
      const relMap = new Map();
      const idMap = new Map();

      res.records.forEach((rec) =>
        rec.keys.forEach((k) => harvestAny(rec.get(k), nodeMap, relMap, idMap))
      );

      if (clearBeforeQuery) {
        cy.elements().remove();
      }

      let addedN = 0,
        addedE = 0;
      nodeMap.forEach((n, eid) => {
        addNodeByEid(cy, n, eid, n?.labels?.[0] || "");
        addedN++;
      });
      relMap.forEach(({ rel, sid, tid }, rid) => {
        addEdgeByEids(cy, rel, rid, sid, tid);
        addedE++;
      });

      const returnedNodeIds = Array.from(nodeMap.keys());
      if (returnedNodeIds.length >= 2) {
        const edgeCap = Math.min((parseInt(limit || 0, 10) || 100) * 10, 2000);
        await connectResultNodes(returnedNodeIds, edgeCap);
      }

      if (addedN || addedE || returnedNodeIds.length) {
        runLayout();
        await enrichVisibleNodes();
        applyStyle();
        rebuildLegend();
        cy.once("layoutstop", forceRenderAndFit);
        setTimeout(forceRenderAndFit, 0);

        const ms = Math.round(performance.now() - startTs);
        const drawnE = cy.edges().length;
        const drawnN = cy.nodes().length;

        setStatus(`Drew ${drawnN} node(s), ${drawnE} relationship(s) · ${ms} ms`);
        setCounts({ n: drawnN, e: drawnE, sel: cy.$(":selected").length });

        baselineRef.current = {
          elements: cy.elements().jsons(),
          pan: cy.pan(),
          zoom: cy.zoom(),
          userQuery: q,
        };
      } else {
        setStatus("Query returned no graph elements.");
      }
    } catch (e) {
      console.error(e);
      setStatus("Query error: " + (e.message || String(e)));
    } finally {
      await s.close();
    }
  };

  /* ========================= Rule-based styling ========================= */
  const fetchPropsForCategory = useCallback(async (target, cat) => {
    const d = driverRef.current;
    if (!d || !cat) return [];
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      if (target === "node") {
        let props = [];
        try {
          const r = await s.run(
            `CALL db.schema.nodeTypeProperties() YIELD nodeType, propertyName WHERE nodeType = $cat OR nodeType = ":" + $cat RETURN DISTINCT propertyName`,
            { cat }
          );
          props = r.records.map((x) => String(x.get("propertyName")));
        } catch {}
        if (!props.length) {
          const r = await s.run(
            `MATCH (n:${qIdent(
              cat
            )}) WITH n LIMIT 50 RETURN apoc.coll.toSet(apoc.coll.flatten(collect(keys(n)))) AS ks`
          );
          props = r.records[0]?.get("ks")?.map(String) ?? [];
        }
        return props.sort();
      } else {
        return [];
      }
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      await s.close();
    }
  }, []);

  // --- NEW: fetch a few nodes (eid + caption) for the selected label ---
const fetchNodesForCategory = useCallback(async (cat, sample = 250) => {
  const d = driverRef.current;
  if (!d || !cat) return [];
  const s = d.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const q = `
      MATCH (n:${qIdent(cat)})
      RETURN elementId(n) AS eid, n AS node
      LIMIT toInteger($sample)
    `;
    const r = await s.run(q, { sample: Number(sample) });
    return r.records.map(rec => {
      const eid = String(rec.get("eid"));
      const neoNode = rec.get("node");
      const labels = (neoNode?.labels || []).map(String);
      const props = toJSDeep(neoNode?.properties || {});
      // use the same caption logic you already built:
      const chosenField =
        captionByLabel[(labels[0] || cat || "").trim()] ?? "<auto>";
      const caption = buildCaptionText(
        props, labels, eid, chosenField === "<auto>" ? null : chosenField
      );
      return { id: eid, caption: caption || eid };
    });
  } catch (e) {
    console.error(e);
    return [];
  } finally {
    await s.close();
  }
}, [captionByLabel]);


  // Read-only: fetch numeric min/max for a label+property (global in DB)
  const fetchMinMax = useCallback(async (cat, prop) => {
    const d = driverRef.current;
    if (!d || !cat || !prop) return { min: null, max: null };
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      let r;
      try {
        r = await s.run(
          `MATCH (n:${qIdent(cat)}) WITH toFloat(n[$prop]) AS v
           WHERE v IS NOT NULL
           RETURN min(v) AS min, max(v) AS max`,
          { prop }
        );
      } catch {
        r = await s.run(
          `MATCH (n:${qIdent(cat)}) WITH toFloat(apoc.map.get(properties(n), $prop, null)) AS v
           WHERE v IS NOT NULL
           RETURN min(v) AS min, max(v) AS max`,
          { prop }
        );
      }
      const rec = r.records[0];
      const min = rec?.get("min");
      const max = rec?.get("max");
      const toNum = (x) =>
        neo4j.isInt?.(x)
          ? x.toNumber()
          : typeof x === "number"
          ? x
          : Number(x);
      const mn = Number.isFinite(toNum(min)) ? toNum(min) : null;
      const mx = Number.isFinite(toNum(max)) ? toNum(max) : null;
      return { min: mn, max: mx };
    } catch (e) {
      console.error(e);
      return { min: null, max: null };
    } finally {
      await s.close();
    }
  }, []);

  const fetchDistinctValues = async (target, cat, prop) => {
    const d = driverRef.current;
    if (!d || !cat || !prop) return [];
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      let r;
      if (target === "node") {
        try {
          r = await s.run(
            `MATCH (n:${qIdent(
              cat
            )}) WITH DISTINCT n[$prop] AS v WHERE v IS NOT NULL RETURN v LIMIT 300`,
            { prop }
          );
        } catch {
          r = await s.run(
            `MATCH (n:${qIdent(
              cat
            )}) WITH apoc.map.get(properties(n), $prop, null) AS v WHERE v IS NOT NULL RETURN DISTINCT v LIMIT 300`,
            { prop }
          );
        }
      } else {
        return [];
      }
      return r.records.map((rec) => toJSDeep(rec.get("v")));
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      await s.close();
    }
  };

  useEffect(() => {
    (async () => {
      if (!selectedLabel) {
        setNodeProps([]);
        setNProp("");
        setNDistinct([]);
        setNValueOptions([]);
        setNEqualsVal(null);
        return;
      }
      const props = await fetchPropsForCategory("node", selectedLabel);
      setNodeProps(props);
    })();
  }, [selectedLabel, fetchPropsForCategory]);

  useEffect(() => {
    (async () => {
      return;
    })();
  }, [selectedRel, fetchPropsForCategory]);

  useEffect(() => {
    (async () => {
      if (!selectedLabel || !nProp) {
        setNValueOptions([]);
        setNDistinct([]);
        setNEqualsVal(null);
        return;
      }
      const vals = await fetchDistinctValues("node", selectedLabel, nProp);
      setNValueOptions(vals);
      setNDistinct(vals);
      if (vals.length && nMode === "single-equals") setNEqualsVal(vals[0]);
    })();
  }, [selectedLabel, nProp, nMode]);

const addRule = (target) => {
  if (target !== "node") {
    setStatus("Relationship color is applied via Apply. No rule added.");
    return;
  }

  // NEW: node-target branch
  if (nTarget === "node") {
    if (!nNodeId) {
      setStatus("Pick a node in the dropdown.");
      return;
    }
    const id = Math.random().toString(36).slice(2);
    const rule = {
      id,
      target: "node",
      category: selectedLabel || "",
      mode: "node-id",
      nodeIds: [String(nNodeId)],
      color: nColor,
      size: Number(nSize) || 0,
      textColor: nTextColor,
    };
    setRules((rs) => [...rs, rule]);
    setStatus("Node rule added. Click Apply to style.");
    return;
  }

  // Existing: property-target branch
  const category = selectedLabel;
  const prop = nProp;
  const mode = nMode;
  if (!category || !prop) {
    setStatus("Pick a category and property.");
    return;
  }
  const id = Math.random().toString(36).slice(2);
  const rule = {
  id,
  target: "node",
  category,
  prop,
  mode,                       // can be "range-gradient"
  equals: nEqualsVal,
  rangeMin: nRangeMin,
  rangeMax: nRangeMax,
  color: nColor,
  size: Number(nSize) || 0,
  textColor: nTextColor,
  unique: nMode === "unique" ? [...nDistinct] : [],
  // NEW:
  colorGradient: nMode === "range-gradient" && nUseColorGrad
    ? { from: nColorMin, to: nColorMax }
    : null,
  sizeGradient: nMode === "range-gradient" && nUseSizeGrad
    ? { min: Number(nSizeMin) || 0, max: Number(nSizeMax) || 0 }
    : null,
};
  setRules((rs) => [...rs, rule]);
  setStatus("Rule added. Click Apply to style.");
};

  const removeRule = (id) => setRules((rs) => rs.filter((r) => r.id !== id));
  const clearRules = () => {
    setRules([]);
    dynamicStyleRef.current = [];
    applyStyle();
  };

  const enrichVisibleNodes = async () => {
    const d = driverRef.current;
    const cy = cyRef.current;
    if (!d || !cy) return;
    const need = cy.nodes().filter((n) => {
      const data = n.data();
      const hasFlag = Object.keys(data).some((k) => k.startsWith("l__"));
      const hasProps = Object.keys(data).some((k) => k.startsWith("p__"));
      return !(hasFlag && hasProps);
    });
    if (!need.length) return;
    const ids = need.map((n) => n.id());
    const s = d.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const res = await s.run(
        `
        UNWIND $ids AS id
        MATCH (n) WHERE elementId(n) = id
        RETURN elementId(n) AS eid, labels(n) AS labels, properties(n) AS props
      `,
        { ids }
      );
      res.records.forEach((rec) => {
        const eid = String(rec.get("eid"));
        const labels = (rec.get("labels") || []).map(String);
        const props = toJSDeep(rec.get("props") || {});
        const flat = {};
        labels.forEach((lb) => {
          flat[labelFlagKey(lb)] = 1;
        });
        Object.entries(props).forEach(([k, v]) => {
          flat[nodePropKey(k)] = v;
        });
        flat._labels = labels;
        const el = cy.getElementById(eid);
        if (el.length) el.data({ ...el.data(), ...flat });
      });
    } catch (e) {
      console.error(e);
    } finally {
      await s.close();
    }
  };

  const compileEqualsSelector = (selBase, propKey, val) => {
    if (val === null) return null;
    const t = typeof val;
    if (t === "number" || t === "boolean")
      return `${selBase}[${propKey} = ${JSON.stringify(val)}]`;
    return `${selBase}[${propKey} = "${String(val).replace(/"/g, '\\"')}"]`;
  };

  const buildCompiledStyles = (rulesToUse) => {
    const styles = [];

    // Node rules only
    rulesToUse.forEach((r) => {
      if (r.target !== "node") return;
      const propKey = nodePropKey(r.prop);
      const catSel = `[${labelFlagKey(r.category)}]`;

      const commonStyle = {};
      // --- NEW: node-id mode → style specific node(s) by elementId ---

      if (r.color) {
        commonStyle["background-color"] = r.color;
        commonStyle["border-color"] = r.color;
      }
      if (r.textColor) commonStyle["color"] = r.textColor;
      if (r.size > 0) commonStyle["width"] = commonStyle["height"] = r.size;

      if (r.mode === "node-id" && Array.isArray(r.nodeIds) && r.nodeIds.length) {
  r.nodeIds.forEach((id) => {
    styles.push({
      selector: `node[id = "${String(id)}"]`,
      style: commonStyle,
    });
  });
  return; // skip the rest of this iteration
}
      const selBase = "node" + catSel;

      if (r.mode === "single-equals") {
        const sel = compileEqualsSelector(selBase, propKey, r.equals);
        if (sel) styles.push({ selector: sel, style: commonStyle });
      } else if (r.mode === "single-exists") {
        styles.push({ selector: `${selBase}[?${propKey}]`, style: commonStyle });
      } else if (r.mode === "range") {
        const parts = [];
        if (r.rangeMin !== "") parts.push(`[${propKey} >= ${Number(r.rangeMin)}]`);
        if (r.rangeMax !== "") parts.push(`[${propKey} <= ${Number(r.rangeMax)}]`);
        styles.push({ selector: selBase + parts.join(""), style: commonStyle });
      } else if (r.mode === "unique") {
        const vals = r.unique || [];
        vals.forEach((v, i) => {
          const col = colorForIndex(i, Math.max(3, vals.length));
          const s = { ...commonStyle };
          if (!r.color) {
            s["background-color"] = col;
            s["border-color"] = col;
          }
          const sel = compileEqualsSelector(selBase, propKey, v);
          if (sel) styles.push({ selector: sel, style: s });
        });
      }
            // --- continuous size and/or color by value (range → mapData) ---
      else if (r.mode === "range-gradient") {
        const mnNum = Number(r.rangeMin);
        const mxNum = Number(r.rangeMax);
        const [minVal, maxVal] =
          Number.isFinite(mnNum) && Number.isFinite(mxNum) && mnNum !== mxNum
            ? [mnNum, mxNum]
            : [0, 1];

        const sel = selBase + `[?${propKey}]`;
        const s = {};

        if (r.sizeGradient && Number.isFinite(r.sizeGradient.min) && Number.isFinite(r.sizeGradient.max)) {
          const a = r.sizeGradient.min;
          const b = r.sizeGradient.max;
          s.width  = `mapData(${propKey}, ${minVal}, ${maxVal}, ${a}, ${b})`;
          s.height = `mapData(${propKey}, ${minVal}, ${maxVal}, ${a}, ${b})`;
        }

        if (r.colorGradient && r.colorGradient.from && r.colorGradient.to) {
          const from = r.colorGradient.from;
          const to   = r.colorGradient.to;
          s["background-color"] = `mapData(${propKey}, ${minVal}, ${maxVal}, ${from}, ${to})`;
          s["border-color"]     = s["background-color"];
        }

        if (r.textColor) s.color = r.textColor;

        styles.push({ selector: sel, style: s });
      }

    });

    // Relationship color-only styling for the selected type
    if (selectedRel && rColor) {
      styles.push({
        selector: `edge[type = "${selectedRel}"]`,
        style: {
          "line-color": rColor,
          "target-arrow-color": rColor,
          "source-arrow-color": rColor,
        },
      });
    }

    return styles;
  };

  const stagedRules = () => {
  const out = [];

  // NEW: node-target mode (preview)
  if (nTarget === "node" && nNodeId) {
    out.push({
      id: "_tmp_node",
      target: "node",
      category: selectedLabel || "",
      mode: "node-id",
      nodeIds: [String(nNodeId)],
      color: nColor,
      size: Number(nSize) || 0,
      textColor: nTextColor,
    });
    return out;
  }

  // Existing: property-target mode (preview)
   if (selectedLabel && nProp) {
    out.push({
      id: "_tmp_n",
      target: "node",
      category: selectedLabel,
      prop: nProp,
      mode: nMode,                    // may be "range-gradient"
      equals: nEqualsVal,
      rangeMin: nRangeMin,
      rangeMax: nRangeMax,
      color: nColor,
      size: Number(nSize) || 0,
      textColor: nTextColor,
      unique: nMode === "unique" ? [...nDistinct] : [],
      // NEW: gradient payloads (used only when mode === "range-gradient")
      colorGradient: nMode === "range-gradient" && nUseColorGrad
        ? { from: nColorMin, to: nColorMax }
        : null,
      sizeGradient: nMode === "range-gradient" && nUseSizeGrad
        ? { min: Number(nSizeMin) || 0, max: Number(nSizeMax) || 0 }
        : null,
    });
  }
  return out;
};

  const applyRules = async () => {
    await enrichVisibleNodes();
    const compiled = buildCompiledStyles([...rules, ...stagedRules()]);
    dynamicStyleRef.current = compiled;
    applyStyle();
    setStatus(compiled.length ? "Styles applied." : "No rules to apply.");
  };

  /* ---------------------- QUICK STYLE / CAPTION HELPERS ---------------------- */
  const setQuickStyleForCategory = (cat, partialStyle) => {
    const sel = `node[${labelFlagKey(cat)}]`;
    const arr = quickStyleRef.current;

    const style = { ...partialStyle };
    if (style["background-color"] && !style["border-color"]) {
      style["border-color"] = style["background-color"];
    }

    const idx = arr.findIndex((s) => s.selector === sel && s.__kind === "catstyle");
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], style: { ...arr[idx].style, ...style } };
    } else {
      arr.push({ selector: sel, style, __kind: "catstyle" });
    }
    applyStyle();
  };

  // const buildCaptionFromField = (n, field) => {
  //   if (!field) return n.data("label");
  //   if (field === "<id>") return String(n.id());
  //   const v = n.data(nodePropKey(field));
  //   if (v == null) return n.data("label");
  //   const s =
  //     Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
  //   return s.trim() ? s : n.data("label");
  // };
  //NEW
  const buildCaptionFromField = (n, field) => {
  if (!field) return n.data("label");
  if (field === "<id>") return String(n.id());
  if (field === "<label>") return (n.data("_labels")?.[0] || "(unlabeled)");
  const v = n.data(nodePropKey(field));
  if (v == null) return n.data("label");
  const s = Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.trim() ? s : n.data("label");
};

// === NEW: read nodes from the CURRENT CANVAS and return unique names ===
const collectCanvasNodesForLabel = (cat) => {
  const cy = cyRef.current;
  if (!cy || !cat) return [];

  // only nodes of this label/category
  const col = cy.nodes(`[${labelFlagKey(cat)}]`);
  if (!col || col.length === 0) return [];

  const seen = new Set();
  const out = [];

  col.forEach((n) => {
    // Prefer the already-rendered label (single-line)
    let caption = String(n.data("label") || "").replace(/\n/g, " ").trim();

    // Fallback to "name" or "title" property if label is empty
    if (!caption) {
      const data = n.data() || {};
      const nameVal = data[nodePropKey("name")];
      const titleVal = data[nodePropKey("title")];
      caption = String(nameVal ?? titleVal ?? n.id());
    }

    const dedupeKey = caption.toLowerCase();
    if (seen.has(dedupeKey)) return;   // keep only unique names
    seen.add(dedupeKey);

    out.push({ id: n.id(), caption });
  });

  // Sort nicely
  out.sort((a, b) => a.caption.localeCompare(b.caption));
  return out;
};

// Return numeric properties for a node on LEFT canvas as [{key, value}]
// Return ALL properties for a node on LEFT canvas as [{key, value}]
const listAllPropsForNode = (eid) => {
  const cy = cyRef.current;
  if (!cy || !eid) return [];
  const el = cy.getElementById(String(eid));
  if (!el || !el.length) return [];
  const data = el.data() || {};
  const out = [];
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith("p__")) continue;
    out.push({ key: k.slice(3), value: v }); // strip "p__" and keep raw value (any type)
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
};

// --- NEW: collect ALL current canvas nodes (Left pane) for dropdowns
const collectAllCanvasNodes = () => {
  const cy = cyRef.current;
  if (!cy) return [];
  const seen = new Set();
  const out = [];
  cy.nodes().forEach((n) => {
    let caption = String(n.data("label") || "").replace(/\n/g, " ").trim();
    if (!caption) {
      const data = n.data() || {};
      caption =
        String(data[nodePropKey("name")] ??
               data[nodePropKey("title")] ??
               n.id());
    }
    const key = `${n.id()}|${caption}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: n.id(), caption });
  });
  out.sort((a, b) => a.caption.localeCompare(b.caption));
  return out;
};

  const setCaptionForCategorySingle = async (cat, field) => {
    await enrichVisibleNodes();
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes(`[${labelFlagKey(cat)}]`).forEach((n) => {
        const text = buildCaptionFromField(n, field);
        const wrapped = wrapLabel(text, 8, 3);
        const size = sizeForWrapped(wrapped);
        n.data({ label: wrapped, size });
      });
    });
    applyStyle();
  };

 const openHudForCategory = async (cat) => {
  setHudCat(cat);
  const props = await fetchPropsForCategory("node", cat);
  setHudProps(props);

  // NEW: load nodes for the Node dropdown
  // Prefer nodes that are ALREADY ON THE CANVAS (expanded graph).
// If none (e.g., nothing drawn yet), fallback to DB sample.
const canvasNodes = collectCanvasNodesForLabel(cat);
const nodes = canvasNodes.length ? canvasNodes : await fetchNodesForCategory(cat, 250);

setHudNodes(nodes);
setHudCaption(null);
setNTarget("property");
setNNodeId(nodes[0]?.id || "");

};

  /* --------------------- Toolbar toggles (labels/arrows) --------------------- */
  const setOrRemoveQuickStyle = useCallback(
    (kind, selector, styleObj, pane = "both") => {
      const arr = quickStyleRef.current;
      const panes = pane === "both" ? ["left", "right"] : [pane];

      panes.forEach((p) => {
        const key = `${kind}::${p}`;
        const idx = arr.findIndex((s) => s.__kind === key);
        if (styleObj) {
          const entry = { selector, style: styleObj, __kind: key, __pane: p };
          if (idx >= 0) arr[idx] = entry;
          else arr.push(entry);
        } else {
          if (idx >= 0) arr.splice(idx, 1);
        }
      });

      applyStyle();
    },
    [applyStyle]
  );

  // Apply visibility filter to LEFT pane only.
// If isolatedNodeId is set -> show only that node (hide everything else).
// Else if visibleCats has items -> show only those categories.
// Else -> show all.
// Apply visibility filter to LEFT pane only.
// --- NEW: apply a two-node compare rule (color/size only those two nodes) ---
// --- NEW: apply a two-node compare rule (color/size only those two nodes) ---
const applyTwoNodeCompareRule = () => {
  const cy = cyRef.current;
  if (!cy) {
    setStatus("Canvas is not ready.");
    return;
  }

  // validate picks
  if (!cmpNodeA || !cmpNodeB || cmpNodeA === cmpNodeB) {
    setStatus("Pick two different nodes.");
    return;
  }
  if (!cmpPropA || !cmpPropB) {
    setStatus("Pick numeric properties for both nodes.");
    return;
  }

  // fetch the nodes
  const a = cy.getElementById(String(cmpNodeA));
  const b = cy.getElementById(String(cmpNodeB));
  if (!a?.length || !b?.length) {
    setStatus("One or both selected nodes are not on the canvas.");
    return;
  }

  // get numeric values from p__* props
  const keyA = nodePropKey(cmpPropA);
  const keyB = nodePropKey(cmpPropB);
  const va = Number(a.data(keyA));
  const vb = Number(b.data(keyB));

  // validate numeric
  const hasA = a.data(keyA) != null;
  const hasB = b.data(keyB) != null;
  if (!Number.isFinite(va) || !Number.isFinite(vb)) {
    setStatus(
      !hasA && !hasB
        ? `Properties "${cmpPropA}" and "${cmpPropB}" not found on the chosen nodes (or not numeric).`
        : !hasA
        ? `Property "${cmpPropA}" missing or non-numeric on Node A.`
        : !hasB
        ? `Property "${cmpPropB}" missing or non-numeric on Node B.`
        : `Both properties must be numeric.`
    );
    return;
  }

  // purge old compare styles first (left pane only)
  quickStyleRef.current = quickStyleRef.current.filter(
    (s) => s.__kind !== "cmp_rule" || s.__pane !== "left"
  );

  // decide styles
  let styleA = {};
  let styleB = {};
  if (va > vb) {
    styleA = {
      "background-color": cmpGreaterColor,
      "border-color": cmpGreaterColor,
      width: cmpGreaterSize,
      height: cmpGreaterSize,
    };
    styleB = {
      "background-color": cmpLesserColor,
      "border-color": cmpLesserColor,
      width: cmpLesserSize,
      height: cmpLesserSize,
    };
  } else if (va < vb) {
    styleA = {
      "background-color": cmpLesserColor,
      "border-color": cmpLesserColor,
      width: cmpLesserSize,
      height: cmpLesserSize,
    };
    styleB = {
      "background-color": cmpGreaterColor,
      "border-color": cmpGreaterColor,
      width: cmpGreaterSize,
      height: cmpGreaterSize,
    };
  } else {
    styleA = { "background-color": cmpEqualColor, "border-color": cmpEqualColor };
    styleB = { "background-color": cmpEqualColor, "border-color": cmpEqualColor };
  }

  // record quick styles (left pane only)
  quickStyleRef.current.push({
    selector: `node[id = "${String(cmpNodeA)}"]`,
    style: styleA,
    __kind: "cmp_rule",
    __pane: "left",
  });
  quickStyleRef.current.push({
    selector: `node[id = "${String(cmpNodeB)}"]`,
    style: styleB,
    __kind: "cmp_rule",
    __pane: "left",
  });

  applyStyle();
  setStatus(
    `Compared ${cmpPropA} (A: ${va}) vs ${cmpPropB} (B: ${vb}) — styles applied.`
  );
};

const applyLegendVisibility = useCallback(() => {
  // remove prior left-pane visibility styles
  quickStyleRef.current = quickStyleRef.current.filter(
    (s) => !(s.__pane === "left" && s.__kind && s.__kind.startsWith("vis_"))
  );

  // if nothing selected, show everything
  if (!isolatedNodeId && (!visibleCats || visibleCats.length === 0)) {
    applyStyle();
    return;
  }

  const add = (selector, style, kind) => {
    quickStyleRef.current.push({ selector, style, __kind: kind, __pane: "left" });
  };

  // hide everything by default
  add("node", { display: "none" }, "vis_nodes_all");
add("edge", { display: "none" }, "vis_edges_all");

  // add("edge", { display: "none" }, "vis_edges_all");

  if (isolatedNodeId) {
    // show only this node
    add(`node[id = "${String(isolatedNodeId)}"]`, { display: "element" }, "vis_only_node");
    add(
  `edge[source = "${String(isolatedNodeId)}"], edge[target = "${String(isolatedNodeId)}"]`,
  { display: "element" },
  "vis_edges_iso"
);

    // Optional: show edges connected to this node
    // add(`edge[source = "${String(isolatedNodeId)}"], edge[target = "${String(isolatedNodeId)}"]`,
    //     { display: "element" }, "vis_edges_iso");
  } else {
    // show only selected categories
    (visibleCats || []).forEach((cat) => {
      add(`node[${labelFlagKey(cat)}]`, { display: "element" }, `vis_cat_${cat}`);
      add("edge[source @shown][target @shown]", { display: "element" }, "vis_edges_between");
    });
    // Optional: show edges whose both ends are visible nodes
    // add("edge[source @shown][target @shown]", { display: "element" }, "vis_edges_between");
  }

  applyStyle();
}, [applyStyle, visibleCats, isolatedNodeId]);



const toggleLegendCategory = (cat) => {
  setIsolatedNodeId(null); // category filter takes precedence over isolation
  setVisibleCats((prev) => {
    const has = prev.includes(cat);
    return has ? prev.filter((c) => c !== cat) : [...prev, cat];
  });
};

const clearLegendFilters = () => {
  setVisibleCats([]);
  setIsolatedNodeId(null);
};


useEffect(() => {
  applyLegendVisibility();
}, [visibleCats, isolatedNodeId, applyLegendVisibility]);

// When the graph node count changes (e.g., after Expand), refresh the Node dropdown
// if the Style tab is active and a HUD category is selected.
useEffect(() => {
  if (inspectorTab !== "style" || !hudCat) return;
  const canvasNodes = collectCanvasNodesForLabel(hudCat);
  if (canvasNodes.length) {
    setHudNodes(canvasNodes);
    setNNodeId((prev) =>
      prev && canvasNodes.some((n) => n.id === prev)
        ? prev
        : (canvasNodes[0]?.id || "")
    );
  }
}, [counts.n, inspectorTab, hudCat, collectCanvasNodesForLabel]);

// Keep Compare dropdowns in sync with the left canvas
useEffect(() => {
  // Refresh the list of all nodes currently on the LEFT canvas
  setCanvasNodeOptions(collectAllCanvasNodes());

  // Ensure selected A/B ids are still valid after graph changes
  setCmpNodeA((prev) =>
    prev && cyRef.current?.getElementById(prev)?.length ? prev : ""
  );
  setCmpNodeB((prev) =>
    prev && cyRef.current?.getElementById(prev)?.length ? prev : ""
  );
}, [
  counts.n,
  counts.e,
  captionByLabel,
  theme,
  visibleCats,
  isolatedNodeId,
]);

// Refresh numeric property list for Node A
// Refresh property list for Node A (all properties)
useEffect(() => {
  if (!cmpNodeA) { setCmpPropsA([]); setCmpPropA(""); return; }
  const props = listAllPropsForNode(cmpNodeA);
  setCmpPropsA(props);
  setCmpPropA((prev) => (props.some(p => p.key === prev) ? prev : (props[0]?.key || "")));
}, [cmpNodeA, counts.n, counts.e, captionByLabel, theme]);

// Refresh property list for Node B (all properties)
useEffect(() => {
  if (!cmpNodeB) { setCmpPropsB([]); setCmpPropB(""); return; }
  const props = listAllPropsForNode(cmpNodeB);
  setCmpPropsB(props);
  setCmpPropB((prev) => (props.some(p => p.key === prev) ? prev : (props[0]?.key || "")));
}, [cmpNodeB, counts.n, counts.e, captionByLabel, theme]);

  // THEME → Cytoscape defaults (core, node text, edge)
  useEffect(() => {
    const nodeLabelColor = theme === "light" ? "#ffffff" : "#e5e7eb";
    const nodeOutline = theme === "light" ? "#0b1219" : "#1f2937";

    const edgeLine = theme === "light" ? "#64748b" : "#94a3b8";
    const edgeLabel = theme === "light" ? "#1f2937" : "#d1d5db";

    const canvasBg = theme === "light" ? "#ffffff" : "#0b0e13";

    setOrRemoveQuickStyle(
      "theme_core",
      "core",
      {
        "background-color": canvasBg,
        "selection-box-color": edgeLine,
        "selection-box-opacity": 0.25,
        "active-bg-color": edgeLine,
        "active-bg-opacity": 0.08,
      },
      "both"
    );

    setOrRemoveQuickStyle(
      "theme_node_text",
      "node",
      {
        color: nodeLabelColor,
        "font-size": 13,
        "font-weight": "600",
        "min-zoomed-font-size": 9,
        "text-outline-width": theme === "light" ? 1.25 : 1.5,
        "text-outline-color": nodeOutline,
      },
      "both"
    );

    setOrRemoveQuickStyle(
      "theme_node_border",
      "node",
      {
        "border-width": 2,
        "border-color": "data(bgColor)",
        "border-opacity": theme === "light" ? 0.9 : 1,
      },
      "both"
    );

    //NEW
  //   setOrRemoveQuickStyle(
  //   "theme_node_fill",
  //   "node",
  //   { "background-color": "data(bgColor)" },
  //   "both"
  // );

    setOrRemoveQuickStyle(
      "theme_edge",
      "edge",
      {
        "line-color": edgeLine,
        "target-arrow-color": edgeLine,
        "source-arrow-color": edgeLine,
        color: edgeLabel,
        "font-size": 11,
        "min-zoomed-font-size": 9,
        "text-rotation": "autorotate",
        "text-outline-width": 0,
        "text-background-color": canvasBg,
        "text-background-opacity": 1,
        "text-background-padding": 1.5,
        "text-background-shape": "roundrectangle",
        "text-margin-y": -1,
      },
      "both"
    );
  }, [theme, setOrRemoveQuickStyle]);

  const togglePaneTarget = targetMode === "auto" ? lastPane : targetMode;

  useEffect(() => {
    setOrRemoveQuickStyle(
      "global_edge_labels",
      "edge",
      showEdgeLabels ? null : { label: "" },
      togglePaneTarget
    );
  }, [showEdgeLabels, setOrRemoveQuickStyle, togglePaneTarget]);

  useEffect(() => {
    document.body.style.background = t.appBg;
    document.body.style.color = t.text;

    const hdr = document.getElementById("appHeader");
    if (hdr) {
      hdr.style.background = t.panelBg;
      hdr.style.borderBottom = `1px solid ${t.border}`;
      hdr.style.color = t.text;
    }
  }, [t.appBg, t.text, t.panelBg, t.border]);

  useEffect(() => {
    const isLight = theme === "light";
    document.body.classList.toggle("theme-light", isLight);
    document.body.classList.toggle("theme-dark", !isLight);

    document.body.style.background = t.appBg;
    document.body.style.color = t.text;

    const root = document.getElementById("root");
    if (root) {
      root.style.background = t.appBg;
      root.style.color = t.text;
    }
  }, [theme, t.appBg, t.text]);

  useEffect(() => {
    setOrRemoveQuickStyle(
      "global_edge_arrows",
      "edge",
      showArrows ? null : { "target-arrow-shape": "none", "source-arrow-shape": "none" },
      togglePaneTarget
    );
  }, [showArrows, setOrRemoveQuickStyle, togglePaneTarget]);

  const zoomIn = useCallback(() => {
    forEachTarget((cy) => {
      const lvl = Math.min(cy.maxZoom(), cy.zoom() * 1.2);
      cy.zoom({
        level: lvl,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    });
  }, [forEachTarget]);

  const zoomOut = useCallback(() => {
    forEachTarget((cy) => {
      const lvl = Math.max(cy.minZoom(), cy.zoom() / 1.2);
      cy.zoom({
        level: lvl,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    });
  }, [forEachTarget]);

  /* ---------------- What-if mode: delete selection + save scenario ---------------- */
  useEffect(() => {
    if (!isWhatIf) return;
    const handler = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const cy = cyRef.current;
        if (cy && cy.$(":selected").length) {
          e.preventDefault();
          cy.$(":selected").remove();
          setStatus("Deleted selection (What-if).");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isWhatIf]);

  const enterWhatIf = () => {
    const cy = cyRef.current;
    if (!cy) return;
    if (!baselineRef.current.elements?.length) {
      baselineRef.current = {
        elements: cy.elements().jsons(),
        pan: cy.pan(),
        zoom: cy.zoom(),
        userQuery,
      };
    }
    setIsWhatIf(true);
    setStatus("What-if mode ON. Delete nodes/edges and Save as scenario.");
  };

  const restoreBaseline = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().remove();
    if (baselineRef.current.elements?.length) {
      cy.add(baselineRef.current.elements);
      if (baselineRef.current.zoom != null) cy.zoom(baselineRef.current.zoom);
      if (baselineRef.current.pan) cy.pan(baselineRef.current.pan);
      applyStyle();
      rebuildLegend();
      requestAnimationFrame(() => {
  try {
    cy.resize();
    if (cy.elements().length) cy.fit(cy.elements(), 40);
  } catch {}
});

      setStatus("Restored original graph from DB (baseline).");
    }
  };

  const exitWhatIf = () => {
    restoreBaseline();
    setIsWhatIf(false);
  };

  const deleteSelection = () => {
    const cy = cyRef.current;
    if (!cy) return;

    let col = cy.$(":selected");

    if (!col.length && nodeDetails?.id != null) {
      const fallback = cy.$id(String(nodeDetails.id));
      if (fallback && fallback.nonempty()) col = fallback;
    }

    if (!col || !col.length) {
      setStatus?.("Nothing selected or focused to delete.");
      return;
    }

    const nodesToRemove = col.filter("node");
    const edgesDirect = col.filter("edge");
    const incidentEdges = nodesToRemove.connectedEdges();
    const edgeCount = edgesDirect.length + incidentEdges.length;

    col.remove();

    rerunLayoutAndFit(cy, typeof layoutName === "string" ? layoutName : "cose");
    applyActiveRuleRuntime(cy);

    setStatus?.(`Deleted ${nodesToRemove.length} node(s), ${edgeCount} edge(s).`);
  };

  const saveScenario = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const name = (scenarioName || "").trim() || `Scenario ${new Date().toLocaleString()}`;
    const snap = {
      id: genId(),
      name,
      createdAt: Date.now(),
      fromQuery: baselineRef.current.userQuery || userQuery || "",
      elements: cy.elements().jsons(),
      pan: cy.pan(),
      zoom: cy.zoom(),
      meta: { counts: { nodes: cy.nodes().length, edges: cy.edges().length } },
      styleRule: getActiveRule(cy) || null,
    };
    const all = readScenarios();
    all.push(snap);
    writeScenarios(all);
    setScenarios(all);
    setSelectedScenarioId(snap.id);
    setStatus(`Scenario “${name}” saved.`);
  };

  const deleteScenario = (id) => {
    const all = readScenarios().filter((s) => s.id !== id);
    writeScenarios(all);
    setScenarios(all);
    if (selectedScenarioId === id) setSelectedScenarioId("");
    setStatus("Scenario deleted.");
  };
// --- HELPER: copy node positions + viewport from left -> right ---
const alignRightToLeft = () => {
  const cyL = cyRef.current;
  const cyR = cyCompareRef.current;
  if (!cyL || !cyR) return;

  cyR.batch(() => {
    cyR.nodes().forEach((n) => {
      const m = cyL.getElementById(n.id());
      if (m && m.nonempty()) {
        const p = m.position();
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) n.position(p);
      }
    });
  });

  cyR.zoom(cyL.zoom());
  cyR.pan(cyL.pan());
};

// const loadScenarioIntoCompare = (id) => {
//   const cy2 = cyCompareRef.current;
//   if (!cy2) return false;

//   const sc = scenarios.find((s) => s.id === id);
//   if (!sc) return false;

//   cy2.elements().remove();

//   const els = Array.isArray(sc.elements) ? sc.elements : [];
//   if (els.length) cy2.add(els);

//   if (sc.styleRule) {
//     setActiveRuleRuntime(cy2, sc.styleRule);
//     applyActiveRuleRuntime(cy2);
//   }
//   applyStyle();

//   // If the scenario already has node positions, keep them and sync the viewport.
//   // If not, align the right pane to the left pane (copies positions/pan/zoom).
//   const positionsMissing = cy2.nodes().some(
//     (n) => !Number.isFinite(n.position("x")) || !Number.isFinite(n.position("y"))
//   );

//   if (positionsMissing) {
//     alignRightToLeft();
//   } else {
//     const cyL = cyRef.current;
//     if (cyL) {
//       cy2.zoom(cyL.zoom());
//       cy2.pan(cyL.pan());
//     } else {
//       cy2.fit(cy2.elements(), 40);
//     }
//   }

//   setStatus(
//     `Compare: loaded “${sc.name}” · ${cy2.nodes().length} node(s), ${cy2.edges().length} rel(s).`
//   );
//   return cy2.elements().length > 0;
// };

  /* --------- Compare toggle: wait for right pane mount & size, then load --------- */
// --------- Compare toggle: guarantee the right pane shows something ---------
// --------- Compare toggle: guarantee the right pane shows something ---------
useEffect(() => {
  if (!isCompare) return;

  const host = compareContainerRef.current;
  const cyL  = cyRef.current;
  const cyR  = cyCompareRef.current;

if (!host || !cyR) {
  let raf = 0, tries = 0;
  const tick = () => {
    const ok = compareContainerRef.current && cyCompareRef.current;
    if (ok || tries++ > 120) return; // ~2s max
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

  const fitSafe = () => {
    cyR.resize();
    if (cyR.elements().length) cyR.fit(cyR.elements(), 40);
  };

  const cloneLeftIntoRight = () => {
    if (!cyL) return false;
    const els = cyL.elements().jsons();
    if (!els.length) return false;

    cyR.batch(() => {
      cyR.elements().remove();
      cyR.add(els);
    });

    applyStyle();

    // If positions are missing/invalid, use grid once to get something visible
    const invalid = cyR.nodes().toArray().some(
      (n) => !Number.isFinite(n.position("x")) || !Number.isFinite(n.position("y"))
    );

    cyR.layout({
      name: invalid ? "grid" : (typeof layoutName === "string" ? layoutName : "cose"),
      padding: 80,
      animate: false,
    }).run();

    requestAnimationFrame(fitSafe);
    setStatus(`Compare: cloned left graph · ${cyR.nodes().length} node(s).`);
    return true;
  };

  const loadScenarioIntoRight = () => {
    if (!selectedScenarioId) return false;
    const sc = scenarios.find((s) => s.id === selectedScenarioId);
    if (!sc || !Array.isArray(sc.elements) || sc.elements.length === 0) return false;

    cyR.batch(() => {
      cyR.elements().remove();
      cyR.add(sc.elements);
    });

    // apply saved styles (if any) + global styles
    applyStyle();
    if (sc.styleRule) {
      setActiveRuleRuntime(cyR, sc.styleRule);
      applyActiveRuleRuntime(cyR);
    }

    // sync node positions + viewport from the left pane
    alignRightToLeft();

    // fallback layout in case positions are missing or there are no edges
    const noEdges = cyR.edges().length === 0;
    cyR.layout({
      name: noEdges ? "grid" : (typeof layoutName === "string" ? layoutName : "cose"),
      padding: 80,
      animate: false,
    }).run();

    // ensure render + fit after DOM resize
    requestAnimationFrame(fitSafe);

    setStatus(
      `Compare: loaded “${sc.name}” · ${cyR.nodes().length} node(s), ${cyR.edges().length} rel(s).`
    );
    return true;
  };

  // 1) Prefer loading the selected scenario
  let ok = loadScenarioIntoRight();

  // 2) If none/empty, clone left
  if (!ok) ok = cloneLeftIntoRight();

  // 3) Double-fit after a short delay to be safe with late resizes
  setTimeout(fitSafe, 80);

  // 4) If the left graph changes shortly after (e.g., user just drew it),
  //    try once more to populate the right.
  const t = setTimeout(() => {
    if (cyR.elements().length === 0) {
      if (!loadScenarioIntoRight()) cloneLeftIntoRight();
      fitSafe();
    }
  }, 300);

  return () => clearTimeout(t);
  // Include counts.n so we’ll re-run when the left graph gets drawn
}, [isCompare, selectedScenarioId, scenarios, layoutName, counts.n]);


  // on node tap handler (knows which pane invoked it)
  const handleNodeTap = async (nodeId, pane = "left") => {
    setLastPane(pane);
    setInspectorPane(pane);
    setInspectorTab("details");
    setNodeDetails({ id: nodeId, labels: ["Loading…"], props: {} });
    await fetchAndShowNodeDetails(nodeId);
      if (pane === "left") {
    // Isolate ONLY this node on the left/original pane
    setVisibleCats([]);                // clear category filters
    setIsolatedNodeId(null);           // do not hide other nodes
  }

  };

  // --- connect node and edge click handlers to the GraphCanvas ---
  useEffect(() => {
    if (!cyRef.current) return;

    // Attach handlers so node clicks also update the inspector + rule styler
    cyRef.current.setOnNodeTap(handleNodeTap);
    cyRef.current.setOnEdgeTap(fetchAndShowEdgeDetails);
  }, [handleNodeTap]);

  /* -------------------------------- RENDER -------------------------------- */
  return (
    <div
      style={{
        display: "flex",
        height: "100%", // viewport height for reliability
        width: "100%",
        overflow: "hidden",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        background: t.appBg,
        color: t.text,
      }}
    >
      {/* Left panel */}
      <div
        style={{
          width: fullGraph ? 0 : 440,
          display: fullGraph ? "none" : "block",
          borderRight: `1px solid ${t.border}`,
          padding: 0,
          background: t.cardBg,
          color: t.text,
          overflow: "auto",
        }}
      >
        <LeftPanel
          t={t}
          status={status}
          limit={limit}
          setLimit={setLimit}
          fit={fit}
          clearGraph={clearGraph}
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
          removeRule={removeRule}
          relTypes={relTypes}
          selectedRel={selectedRel}
          setSelectedRel={setSelectedRel}
          loadRelationships={loadRelationships}
          rColor={rColor}
          setRColor={setRColor}
          userQuery={userQuery}
          setUserQuery={setUserQuery}
          clearBeforeQuery={clearBeforeQuery}
          setClearBeforeQuery={setClearBeforeQuery}
          runUserQuery={runUserQuery}
          captionByLabel={captionByLabel}
          setCaptionPref={setCaptionPref}
        />
      </div>

      {/* Canvas + Browser-like toolbar + Inspector */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        {/* Graph toolbar (Browser-like) */}
        <Toolbar
          toolbarStyle={toolbarStyle}
          fullGraph={fullGraph}
          setFullGraph={setFullGraph}
          layoutName={layoutName}
          setLayoutName={setLayoutName}
          runLayout={runLayout}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          fit={fit}
          showEdgeLabels={showEdgeLabels}
          setShowEdgeLabels={setShowEdgeLabels}
          showArrows={showArrows}
          setShowArrows={setShowArrows}
          counts={counts}
          isWhatIf={isWhatIf}
          enterWhatIf={enterWhatIf}
          exitWhatIf={exitWhatIf}
          deleteSelection={deleteSelection}
          scenarioName={scenarioName}
          setScenarioName={setScenarioName}
          saveScenario={saveScenario}
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          isCompare={isCompare}
          setIsCompare={setIsCompare}
          deleteScenario={deleteScenario}
          showTable={showTable}
          setShowTable={setShowTable}
          showLeftTable={showLeftTable}
          setShowLeftTable={setShowLeftTable}
          showRightTable={showRightTable}
          setShowRightTable={setShowRightTable}
          targetMode={targetMode}
          setTargetMode={setTargetMode}
          theme={theme}
          setTheme={setTheme}
          t={t}
          onDownloadWhatIfPDF={handleDownloadWhatIfPDF}
          onDownloadCompareJSON={handleDownloadCompareJSON}
          onDownloadLeftJSON={handleDownloadLeftJSON}
        />

        {/* Left (DB/baseline or What-if working) canvas */}
        <GraphCanvas
          containerRef={containerRef}
          cyRef={cyRef}
          baseStylesheet={baseStylesheet}
          layoutBusyRef={layoutBusyRef}
          isWhatIfRef={isWhatIfRef}
          setCounts={setCounts}
          onNodeTap={(id) => handleNodeTap(id, "left")}
          topOffset={TOOLBAR_H}
        />

        {/* Right compare canvas */}
        {/* {isCompare && (
          <CompareCanvas
            compareContainerRef={compareContainerRef}
            cyCompareRef={cyCompareRef}
            baseStylesheet={baseStylesheet}
            onNodeTap={(id) => handleNodeTap(id, "right")}
            layoutBusyRef={layoutBusyRef}
            topOffset={TOOLBAR_H}
          />
        )} */}
{isCompare && (
  <CompareCanvas
    compareContainerRef={compareContainerRef}
    cyCompareRef={cyCompareRef}
    baseStylesheet={baseStylesheet}
    onNodeTap={(id) => handleNodeTap(id, "right")}
    layoutBusyRef={layoutBusyRef}
    topOffset={TOOLBAR_H}
  />
)}

        {isCompare && (
          <div
            style={{
              position: "absolute",
              top: TOOLBAR_H,
              bottom: 0,
              left: "50%",
              width: 1,
              background: t.border,
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Legend */}
       {/* Legend (single source of truth) */}
{showLegend && legendItems.length > 0 && !isWhatIf && (
  <div
    style={{
      position: "absolute",
      bottom: isCompare && showRightTable ? 180 : 12,
      right: 12,
      background: t.panelBg,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "8px 10px",
      maxWidth: isCompare ? "calc(50% - 24px)" : "min(40vw, 500px)",
      color: t.text,
      fontSize: 12,
      lineHeight: 1.4,
      zIndex: 120,
      pointerEvents: "auto",
    }}
  >
    {/* header: title + actions */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
      }}
    >
      <div style={{ fontWeight: 600 }}>Legend (Original)</div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={clearLegendFilters}
          style={{
            border: `1px solid ${t.border}`,
            background: t.cardBg,
            color: t.text,
            borderRadius: 6,
            padding: "2px 8px",
            cursor: "pointer",
            lineHeight: 1,
          }}
          title="Show all"
        >
          Show all
        </button>
        <button
          onClick={() => setShowLegend(false)}
          style={{
            border: `1px solid ${t.border}`,
            background: t.cardBg,
            color: t.text,
            borderRadius: 6,
            padding: "2px 6px",
            cursor: "pointer",
            lineHeight: 1,
          }}
          aria-label="Hide legend"
          title="Hide legend"
        >
          ✕
        </button>
      </div>
    </div>

    {/* items with checkboxes */}
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {legendItems.map((it) => (
  <div
    key={it.cat}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 6px",
      background: t.cardBg,
      borderRadius: 6,
      border: `1px solid ${t.border}`,
      whiteSpace: "nowrap",
      // parent is no longer clickable, so use default cursor:
      cursor: "default",
    }}
  >
    <input
      type="checkbox"
      checked={visibleCats.includes(it.cat)}
      onChange={() => toggleLegendCategory(it.cat)}
      style={{ cursor: "pointer" }}
    />
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: 12,
        background: it.color,
        border: "2px solid rgba(255,255,255,.25)",
      }}
    />
    <span>{it.cat}</span>
    <span style={{ opacity: 0.6 }}>×{it.count}</span>
  </div>
))}
    </div>
  </div>
)}

        {/* Inspector */}
{nodeDetails && (
  <div
    style={{
      position: "fixed",                       // keep above canvases
      top: TOOLBAR_H + INSPECTOR_GAP,
      right: INSPECTOR_GAP,
      bottom: INSPECTOR_GAP,
      zIndex: 10000,                           // well above Cytoscape
      width: "min(42vw, 560px)",
      maxWidth: 560,
      minWidth: 360,
      overflow: "auto",
      pointerEvents: "auto",
    }}
    // onPointerDownCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
    // onClickCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
    // onWheelCapture={(e) => { e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.(); }}
  >
    <Inspector
      t={t}
      cy={inspectorPane === "right" ? cyCompareRef.current : cyRef.current}
      fetchMinMax={fetchMinMax}
      nodeDetails={nodeDetails}
      setNodeDetails={setNodeDetails}
      hudCat={hudCat}
      setHudCat={setHudCat}
      hudProps={hudProps}
      hudCaption={hudCaption}
      setHudCaption={setHudCaption}
      inspectorTab={inspectorTab}
      setInspectorTab={setInspectorTab}
      openHudForCategory={openHudForCategory}
      setQuickStyleForCategory={setQuickStyleForCategory}
      setCaptionForCategorySingle={setCaptionForCategorySingle}
      expandKHops={expandKHops}
      fit={fit}
      isCompare={isCompare}
      inspectorPane={inspectorPane}
      selectedScenarioId={selectedScenarioId}
      onSaveNodeProps={saveEditedPropsToScenario}
      onSaveNodePropsLeft={saveEditedPropsToLeft}
      nTarget={nTarget}
      setNTarget={setNTarget}
      hudNodes={hudNodes}
      nNodeId={nNodeId}
      setNNodeId={setNNodeId}
      canvasNodeOptions={canvasNodeOptions}
      cmpNodeA={cmpNodeA} setCmpNodeA={setCmpNodeA}
      cmpNodeB={cmpNodeB} setCmpNodeB={setCmpNodeB}
      cmpProp={cmpProp}   setCmpProp={setCmpProp}
      cmpGreaterColor={cmpGreaterColor} setCmpGreaterColor={setCmpGreaterColor}
      cmpLesserColor={cmpLesserColor}   setCmpLesserColor={setCmpLesserColor}
      cmpEqualColor={cmpEqualColor}     setCmpEqualColor={setCmpEqualColor}
      cmpGreaterSize={cmpGreaterSize}   setCmpGreaterSize={setCmpGreaterSize}
      cmpLesserSize={cmpLesserSize}     setCmpLesserSize={setCmpLesserSize}
      onApplyTwoNodeCompare={applyTwoNodeCompareRule}
      cmpPropA={cmpPropA} setCmpPropA={setCmpPropA}
      cmpPropB={cmpPropB} setCmpPropB={setCmpPropB}
      cmpPropsA={cmpPropsA}
      cmpPropsB={cmpPropsB}
            /* gradient controls */
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
  </div>
)}

        {/* Left table: baseline/working graph */}
        {showLeftTable && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              width: isCompare ? "calc(50% - 24px)" : "min(40vw, 500px)",
              maxWidth: 500,
              maxHeight: "35vh",
              overflow: "auto",
              zIndex: 70,
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              color: t.text,
              borderRadius: 10,
              padding: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
              Nodes Table (Baseline / Left)
            </div>
            <NodesTable
              cy={cyRef.current}
              visible={showLeftTable}
              setVisible={setShowLeftTable}
              t={t}
            />
          </div>
        )}

        {/* Right table: compare scenario */}
        {isCompare && showRightTable && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              width: "calc(50% - 24px)",
              maxWidth: 500,
              maxHeight: "35vh",
              overflow: "auto",
              zIndex: 70,
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              color: t.text,
              borderRadius: 10,
              padding: 8,
             
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
              Nodes Table (Compare / Right)
            </div>
            <NodesTable
              cy={cyCompareRef.current}
              visible={showRightTable}
              setVisible={setShowRightTable}
              t={t}
            />
          </div>
        )}
        <MapOverlayFromZip
          theme={theme}
          visible={mapOverlayVisible}
          onClose={onRequestCloseMapOverlay}
        />

        {/* tiny debug chip (remove later if you want) */}
        {/* <div
          style={{
            position: "fixed",
            bottom: 8,
            left: 8,
            zIndex: 99999,
            padding: "6px 8px",
            border: "1px solid #374151",
            borderRadius: 6,
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 12,
          }}
        > */}
          {/* <div>mounted ✅</div>
          <div>URI set: {String(Boolean(NEO4J_URI))}</div>
          <div>isCompare: {String(isCompare)}</div>
          <div>rightDiv: {String(!!compareContainerRef.current)}</div>
          <div>cyRight: {String(!!cyCompareRef.current)}</div>
          <div style={{ opacity: 0.7 }}>status: {status || "(idle)"} </div> */}
        {/* </div> */}
      </div>
     
{/* Toggle Button */}
<button
  onClick={() => setShowLegend((v) => !v)}
  style={{
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 90,
    background: "#1f2937",
    color: "#e5e7eb",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
  }}
>
  {showLegend ? "Hide Legend" : "Show Legend"}
</button>

    </div>
  );
}
