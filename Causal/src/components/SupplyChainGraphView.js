import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";

const NODE_STYLE = {
  Supplier:          { bg: "#6366f1", border: "#4f46e5" },
  Factory:           { bg: "#10b981", border: "#059669" },
  Warehouse:         { bg: "#f59e0b", border: "#d97706" },
  DistributionCenter:{ bg: "#8b5cf6", border: "#7c3aed" },
  Retailer:          { bg: "#ef4444", border: "#dc2626" },
  Unknown:           { bg: "#64748b", border: "#475569" },
};

const CY_STYLE = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "font-size": 11,
      "font-weight": "bold",
      "font-family": "Inter, system-ui, sans-serif",
      width: 56,
      height: 56,
      "text-halign": "center",
      "text-valign": "center",
      "text-wrap": "wrap",
      "text-max-width": 72,
      "border-width": 3,
      color: "#ffffff",
      "background-color": "data(color)",
      "border-color": "#475569",
    },
  },
  ...Object.entries(NODE_STYLE).map(([type, c]) => ({
    selector: `node[type="${type}"]`,
    style: { "background-color": c.bg, "border-color": c.border },
  })),
  {
    selector: "node:selected",
    style: {
      "border-width": 5,
      "border-color": "#1e293b",
      "overlay-color": "#1e293b",
      "overlay-padding": 4,
      "overlay-opacity": 0.08,
    },
  },
  { selector: "node.highlighted", style: { "border-width": 6, "border-color": "#ef4444" } },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "line-color": "#cbd5e1",
      "target-arrow-color": "#cbd5e1",
      width: 2.5,
      label: "data(label)",
      "font-size": 9,
      "font-family": "Inter, system-ui, sans-serif",
      "text-background-color": "#f8fafc",
      "text-background-opacity": 0.85,
      "text-background-padding": "3px",
      "text-rotation": "autorotate",
      color: "#94a3b8",
    },
  },
  {
    selector: "edge:selected",
    style: { "line-color": "#6366f1", "target-arrow-color": "#6366f1", width: 3.5 },
  },
];

const LAYOUT = {
  name: "breadthfirst",
  directed: true,
  spacingFactor: 1.8,
  avoidOverlap: true,
  padding: 40,
  animate: false,
};

function buildElements(graph) {
  if (!graph) return [];
  const els = [];
  for (const n of graph.nodes || []) {
    els.push({ data: { id: n.id, label: n.label, type: n.type || "Unknown", ...n } });
  }
  for (let i = 0; i < (graph.edges || []).length; i++) {
    const e = graph.edges[i];
    els.push({
      data: {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: (e.relationship || "").replace(/_/g, " ").replace(" TO ", " → "),
        ...e,
      },
    });
  }
  return els;
}

export default function SupplyChainGraphView({
  graph,
  onNodeClick,
  onEdgeClick,
  selectedId,
  overlay,
  height = 500,
}) {
  const wrapperRef   = useRef(null);   // outer div — stays in DOM across remounts
  const cyRef        = useRef(null);
  const callbacksRef = useRef({ onNodeClick, onEdgeClick });

  useEffect(() => { callbacksRef.current = { onNodeClick, onEdgeClick }; });

  // ── Mount once — fresh inner div avoids Cytoscape auto-destroying a sibling ─
  useEffect(() => {
    if (!wrapperRef.current) return;

    // Create a brand-new container so Cytoscape never finds an existing _cyreg
    // on this element, preventing it from auto-destroying a previous instance.
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%";
    wrapperRef.current.appendChild(container);

    const cy = cytoscape({ container, elements: [], style: CY_STYLE });

    cy.on("tap", "node", (evt) => callbacksRef.current.onNodeClick?.(evt.target.data()));
    cy.on("tap", "edge", (evt) => callbacksRef.current.onEdgeClick?.(evt.target.data()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        callbacksRef.current.onNodeClick?.(null);
        callbacksRef.current.onEdgeClick?.(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cyRef.current = null;
      cy.stop(true);
      // Remove the canvas from DOM BEFORE destroy so that even if a
      // document-level mousemove listener fires in the next JS task it
      // can no longer resolve any element bounding boxes.
      if (container.parentNode) container.parentNode.removeChild(container);
      // destroy() removes the document-level mousemove listener Cytoscape
      // registers. _private becomes null after this but the canvas is gone.
      cy.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update elements whenever graph changes (handles initial load too) ────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graph) return;
    cy.elements().remove();
    cy.add(buildElements(graph));
    cy.layout(LAYOUT).run();
    cy.fit(undefined, 40);
  }, [JSON.stringify(graph)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overlay ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !overlay?.nodeScores) return;
    const scores = overlay.nodeScores;
    cy.nodes().forEach((n) => {
      const score = scores[n.id()] || 0;
      if (score > 0.4) {
        n.addClass("highlighted");
        n.style("border-color", `rgba(239,68,68,${0.4 + score * 0.6})`);
        n.style("border-width", 3 + score * 5);
      } else {
        n.removeClass("highlighted");
      }
    });
  }, [overlay]);

  // ── Selected node sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().unselect();
    if (selectedId) {
      try { cy.$(`[id="${selectedId}"]`).select(); } catch (_) {}
    }
  }, [selectedId]);

  const handleFit = useCallback(() => cyRef.current?.fit(undefined, 40), []);
  const handleReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout(LAYOUT).run();
    cy.fit(undefined, 40);
  }, []);

  return (
    <div className="relative w-full" style={{ height }}>
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <button onClick={handleFit}   className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-50 shadow-sm">Fit</button>
        <button onClick={handleReset} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-50 shadow-sm">Reset</button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-2.5 shadow-sm">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Node Types</p>
        <div className="flex flex-col gap-1">
          {Object.entries(NODE_STYLE).filter(([k]) => k !== "Unknown").map(([type, c]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.bg }} />
              <span className="text-[10px] text-slate-600">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* wrapperRef stays mounted; fresh inner div is created per effect run */}
      <div
        ref={wrapperRef}
        className="w-full h-full border border-slate-200 rounded-xl overflow-hidden"
        style={{ backgroundColor: "#f8fafc" }}
      />
    </div>
  );
}
