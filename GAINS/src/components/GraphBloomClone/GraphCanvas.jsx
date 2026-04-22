// src/components/GraphBloomClone/GraphCanvas.jsx
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
// import { clampPanToKeepGraphOnScreen } from "./helper.js";

export default function GraphCanvas({
  containerRef,
  cyRef,
  baseStylesheet,
  layoutBusyRef,
  isWhatIfRef,
  setCounts,
  onNodeTap,
  topOffset = 0,
}) {
  // keep latest onNodeTap without re-initializing Cytoscape
  const onNodeTapRef = useRef(onNodeTap);
  const onEdgeTapRef = useRef(null); // NEW — store latest edge click handler

  useEffect(() => {
    onNodeTapRef.current = onNodeTap;
  }, [onNodeTap]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    // Ensure container has real size & fills the pane
    Object.assign(containerRef.current.style, {
      position: "absolute",
      left: 0,
      right: 0,
      top: `${topOffset}px`,
      height: `calc(100% - ${topOffset}px)`,
      width: "100%",
      // background: "#1f2229",
      background: "transparent",
      cursor: "default",
      zIndex: 0,
      pointerEvents: "auto",
    });

const cy = cytoscape({
  container: containerRef.current,
  style: baseStylesheet,
  minZoom: 0.08,
  maxZoom: 4,
  wheelSensitivity: 0.2,

  // crisper text on most screens
  pixelRatio: Math.min(2, window.devicePixelRatio || 1),

  // avoid blur-inducing effects
  motionBlur: false,
  textureOnViewport: false,
});


    // --- enable user selection explicitly ---
    cy.autounselectify(false);      // allow selecting by click
    cy.boxSelectionEnabled(true);   // allow drag-box multi-select
    cy.nodes().selectify();
    cy.edges().selectify();

    const updateCounts = () =>
      setCounts({
        n: cy.nodes().length,
        e: cy.edges().length,
        sel: cy.$(":selected").length,
      });

    // Debounced/RAF fit that only runs when container has size
    let raf = null;
    const scheduleFit = () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        const host = containerRef.current;
        if (!host) return;
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        if (cy.elements().length === 0) {
          updateCounts();
          return;
        }
        cy.resize();
        cy.fit(cy.elements(), 40);
        // clampPanToKeepGraphOnScreen(cy, 40);
        updateCounts();
      });
    };

    // Auto-fit on content & after layouts
    cy.on("add remove data style", scheduleFit);
    cy.on("layoutstop", scheduleFit);

    // Track layout busy flag
    cy.on("layoutstart", () => (layoutBusyRef.current = true));
    cy.on("layoutstop", () => (layoutBusyRef.current = false));

    // Live counts + reset cursor on interactions
    cy.on("add remove select unselect", updateCounts);
    cy.on("pan zoom free", () => {
      if (containerRef.current) containerRef.current.style.cursor = "default";
      updateCounts();
    });

    // Simple pointer cursor on nodes
    const setCursor = (cur) => {
      if (containerRef.current) containerRef.current.style.cursor = cur;
    };
    cy.on("mouseover", "node", () => setCursor("pointer"));
    cy.on("mouseout", "node", () => setCursor("default"));

    // Background tap clears selection (in What-if, unless Shift is held)
    cy.on("tap", (evt) => {
      if (evt.target === cy && isWhatIfRef.current) {
        const oe = evt.originalEvent || {};
        if (!oe.shiftKey && !oe.ctrlKey && !oe.metaKey) {
          cy.$(":selected").unselect();
        }
      }
    });

    // Node tap -> select node (esp. in What-if) + center + call latest onNodeTap
    cy.on("tap", "node", async (evt) => {
      if (layoutBusyRef.current) return;
      const node = evt.target;
      const oe = evt.originalEvent || {};
      const additive = oe.shiftKey || oe.ctrlKey || oe.metaKey;

      if (isWhatIfRef.current) {
        // persistent selection for What-if deletes
        if (!additive) cy.$(":selected").unselect();
        node.select();
      } else {
        // transient highlight outside What-if (keeps old behavior feel)
        node.select();
        setTimeout(() => node.unselect(), 600);
      }

      cy.animate({ center: { eles: node }, duration: 180 });
      if (onNodeTapRef.current) await onNodeTapRef.current(node.id());
    });

    // Edge tap (stay selected in What-if for deletion)
    // Edge tap (stay selected in What-if for deletion)
cy.on("tap", "edge", async (evt) => {
  if (layoutBusyRef.current) return;
  const e = evt.target;

  if (isWhatIfRef.current) {
    e.select();
  } else {
    cy.animate({ center: { eles: e }, duration: 220 });
    e.select();
    setTimeout(() => e.unselect(), 600);
  }

  // NEW — trigger edge click handler
  if (onEdgeTapRef.current) await onEdgeTapRef.current(e.id());
});

    // Resize handling
    const ro = new ResizeObserver(() => scheduleFit());
    ro.observe(containerRef.current);
    const onWindowResize = () => scheduleFit();
    window.addEventListener("resize", onWindowResize);

    // Initial counts/fit next frame
    updateCounts();
    scheduleFit();

    // Expose instance to parent
    cyRef.current = cy;
    // Let parent attach edge/node tap handlers dynamically
cy.setOnNodeTap = (fn) => (onNodeTapRef.current = fn);
cy.setOnEdgeTap = (fn) => (onEdgeTapRef.current = fn);

    return () => {
      try {
        ro.disconnect();
        window.removeEventListener("resize", onWindowResize);
      } catch {}
      if (raf != null) cancelAnimationFrame(raf);
      cy.destroy();
      cyRef.current = null;
    };
    // IMPORTANT: initialize Cytoscape only once
  }, []); // do NOT depend on onNodeTap/baseStylesheet/etc.

  return <div ref={containerRef} />;
}
