// src/components/GraphBloomClone/neighborhood-llm/NeighborhoodSyncAgent.jsx
import { useEffect, useRef } from "react";
import { useGraph } from "./GraphContext";
import { redactSnapshot, defaultRedactionRules } from "./RedactionService";
import { analyzeNeighborhood } from "./LLMClient";

/**
 * Headless component that watches the CURRENT snapshot and sends it to the LLM
 * after a short debounce. Cancels in-flight requests if a new snapshot arrives.
 *
 * Props:
 *  - enabled?: boolean (default true)
 *  - maxNodes?: number (default 1500)
 *  - maxEdges?: number (default 3000)
 *  - redactionRules?: object (allow-list; defaults to conservative rules)
 *  - debounceMs?: number (default 400)
 */
export default function NeighborhoodSyncAgent({
  enabled = true,
  maxNodes = 1500,
  maxEdges = 3000,
  redactionRules = defaultRedactionRules(),
  debounceMs = 400,
}) {
  const { snapshot, setSyncState } = useGraph();
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!enabled || !snapshot) return;

    // Enforce size caps early
    const nodeCount = snapshot.nodes?.length || 0;
    const edgeCount = snapshot.edges?.length || 0;
    if (nodeCount > maxNodes || edgeCount > maxEdges) {
      setSyncState({
        status: "error",
        error: `Snapshot too large (${nodeCount} nodes, ${edgeCount} edges). Reduce scope.`,
        result: null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // Debounce to avoid churn during rapid updates/layout
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setSyncState((s) => ({ ...s, status: "analyzing", error: null }));
        const redacted = redactSnapshot(snapshot, redactionRules);
        const result = await analyzeNeighborhood({
          snapshot: redacted,
          signal: controller.signal,
        });
        setSyncState({
          status: "fresh",
          error: null,
          result,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (controller.signal.aborted) return; // superseded by a newer snapshot
        setSyncState({
          status: "error",
          error: err?.message || "Analyze failed",
          result: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }, debounceMs);

    return () => clearTimeout(debounceRef.current);
  }, [enabled, snapshot, maxNodes, maxEdges, redactionRules, debounceMs, setSyncState]);

  return null; // headless
}
