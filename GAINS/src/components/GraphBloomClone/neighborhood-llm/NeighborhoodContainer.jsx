// src/components/GraphBloomClone/NeighborhoodContainer.jsx
import React, { useCallback } from "react";
import { useGraph } from "./GraphContext";
import NeighborhoodSyncAgent from "./NeighborhoodSyncAgent";
import NeighborhoodSyncStatus from "./NeighborhoodSyncStatus";
import NeighborhoodChatLauncher from "./NeighborhoodChatLauncher";
import NeighborhoodChatPanel from "./NeighborhoodChatPanel";
import NodeNeighborhoodPanel from "../NodeNeighborhoodPanel.jsx";
// IMPORTANT: adjust this path to where YOUR NodeNeighborhoodPanel.jsx lives


/**
 * This is a composition wrapper that DOES NOT modify your existing files.
 * You can render <NeighborhoodContainer/> anywhere to get:
 *  - the panel
 *  - the sync status badge
 *  - the chat launcher and panel
 *  - the headless sync agent
 *
 * Later, we will add a tiny glue hook so the container receives the current elements
 * from NodeNeighborhoodPanel (via an optional onGraphChanged prop).
 */
export default function NeighborhoodContainer({
  theme = "dark",
  seedEid,
  onCenterOnMap,
}) {
  const { setSnapshot } = useGraph();

  // When you are ready to wire: pass onGraphChanged into NodeNeighborhoodPanel
  // and call setSnapshot with a snapshot built from the elements array.
  const onGraphChanged = useCallback((elements, meta) => {
    if (!elements || elements.length === 0) return;

    // Build a current snapshot from the elements the panel already produces
    const nodes = elements
      .filter((e) => e.data && !e.data.source)
      .map((e) => ({
        elementId: e.data.id,
        labels: e.data.rawLabels || [],
        type: e.data.type || "node",
        props: e.data.props || {},
        lat: e.data.lat ?? null,
        lon: e.data.lon ?? null,
      }));

    const edges = elements
      .filter((e) => e.data && e.data.source)
      .map((e) => ({
        elementId: e.data.id,
        type: e.data.label || "",
        startId: e.data.source,
        endId: e.data.target,
        props: {},
      }));

    setSnapshot({
      seedEid: meta?.seedEid || seedEid,
      action: meta?.action || "seed-load",
      expandedNodeId: meta?.expandedNodeId || null,
      timestamp: new Date().toISOString(),
      nodes,
      edges,
    });
  }, [seedEid, setSnapshot]);

  const onHighlightById = useCallback((id) => {
    // Optional: wire into your Cytoscape instance to select/highlight the id
    // e.g., via a custom event or a ref you pass down later.
  }, []);

  return (
    <>
      {/* Small row you can place above or near the panel header */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <NeighborhoodSyncStatus />
        <NeighborhoodChatLauncher />
      </div>

<NodeNeighborhoodPanel
  theme={theme}
  seedEid={seedEid}
  onCenterOnMap={onCenterOnMap}
  onGraphChanged={onGraphChanged}
/>

      {/* Headless sync agent (does not render UI) */}
      <NeighborhoodSyncAgent enabled={true} />

      {/* Docked chat panel (opens via the launcher) */}
      <NeighborhoodChatPanel onHighlightById={onHighlightById} />
    </>
  );
}
