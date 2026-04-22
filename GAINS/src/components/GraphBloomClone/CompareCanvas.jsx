// src/components/GraphBloomClone/CompareCanvas.jsx
import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

export default function CompareCanvas({
  compareContainerRef,
  cyCompareRef,
  baseStylesheet,
  onNodeTap,        // call parent to open Inspector
  layoutBusyRef,    // optional but nice to have
  topOffset = 0,    // same behavior as left canvas
}) {
  const onNodeTapRef = useRef(onNodeTap);
  useEffect(() => {
    onNodeTapRef.current = onNodeTap;
  }, [onNodeTap]);

  useEffect(() => {
    // Avoid double init
    if (cyCompareRef.current) return;

    let rafId = 0;
    let cy2 = null;
    let destroyed = false;
    let ro = null; // ResizeObserver

    const fitSafe = () => {
      if (!cy2) return;
      cy2.resize();
      if (cy2.elements().length) cy2.fit(cy2.elements(), 40);
    };

    const tryInit = () => {
      if (destroyed) return;

      const host = compareContainerRef.current;
      if (!host) {
        rafId = requestAnimationFrame(tryInit);
        return;
      }

      // Ensure the host is absolutely positioned and sized just like the left canvas.
      Object.assign(host.style, {
        position: "absolute",
        // Parent controls left/right during split; we only ensure vertical sizing here.
        top: `${topOffset}px`,
        height: `calc(100% - ${topOffset}px)`,
        width: "100%",
        background: "transparent",
        cursor: "default",
        zIndex: 0,
      });

      // Wait until host has real size
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(tryInit);
        return;
      }

      cy2 = cytoscape({
        container: host,
        style: baseStylesheet,
        minZoom: 0.08,
        maxZoom: 4,
        wheelSensitivity: 0.2,
        // crisp text, but avoid excessive pixel ratio
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        motionBlur: false,
        textureOnViewport: false,
      });

      // Pointer cursor on nodes
      cy2.on("mouseover", "node", () => {
        if (compareContainerRef.current) compareContainerRef.current.style.cursor = "pointer";
      });
      cy2.on("mouseout", "node", () => {
        if (compareContainerRef.current) compareContainerRef.current.style.cursor = "default";
      });

      // Node tap => center + bubble up for Inspector
      cy2.on("tap", "node", async (evt) => {
        if (layoutBusyRef?.current) return;
        const node = evt.target;
        cy2.animate({ center: { eles: node }, duration: 180 });
        if (onNodeTapRef.current) await onNodeTapRef.current(node.id());
      });

      // Fit after layouts and after any add/remove/data/style changes
      cy2.on("layoutstop add remove data style", fitSafe);

      // Keep canvas painted on host resizes (split toggles, window resize, etc.)
      ro = new ResizeObserver(() => {
        const r = host.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) fitSafe();
      });
      ro.observe(host);

      cyCompareRef.current = cy2;

      // Initial fit next frame
      requestAnimationFrame(fitSafe);
    };

    tryInit();

    // Cleanup
    return () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      try { ro && ro.disconnect(); } catch {}
      if (cy2) {
        try { cy2.destroy(); } catch {}
      }
      cyCompareRef.current = null;
    };
  }, [baseStylesheet, topOffset, layoutBusyRef, compareContainerRef, cyCompareRef]);

  return <div ref={compareContainerRef} />;
}
