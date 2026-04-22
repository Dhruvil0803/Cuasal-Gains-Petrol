// src/components/GraphBloomClone/neighborhood-llm/RedactionService.js

/**
 * Redacts node/edge props based on allow-list rules.
 * Keeps structure identical; only props are filtered.
 *
 * @param {object} snapshot - { seedEid, nodes[], edges[], action, expandedNodeId?, timestamp }
 * @param {object} rules - { node: { [type]: string[] }, edge: { [type]: string[] } }
 *                         Types fall back to "node" / "edge" keys if not found.
 * @returns {object} redacted snapshot (new object)
 */
export function redactSnapshot(snapshot, rules = {}) {
  if (!snapshot) return snapshot;

  const nodeRules = rules.node || {};
  const edgeRules = rules.edge || {};

  const safeNodes = (snapshot.nodes || []).map((n) => {
    const type = n?.type || "node";
    const allow = nodeRules[type] || nodeRules.node || [];
    const src = n?.props || {};
    const dst = {};
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
    }
    return { ...n, props: dst };
  });

  const safeEdges = (snapshot.edges || []).map((e) => {
    const type = e?.type || "edge";
    const allow = edgeRules[type] || edgeRules.edge || [];
    const src = e?.props || {};
    const dst = {};
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
    }
    return { ...e, props: dst };
  });

  return { ...snapshot, nodes: safeNodes, edges: safeEdges };
}

/**
 * Example strict allow-list generator you can import and tweak.
 * Returns a conservative default (ids/names/geo only).
 */
export function defaultRedactionRules() {
  return {
    node: {
      DistributionCenter: ["name", "code", "lat", "lon"],
      Supplier: ["name", "code", "lat", "lon"],
      Dealership: ["name", "code", "lat", "lon"],
      node: ["name", "code", "lat", "lon"], // fallback
    },
    edge: {
      SUPPLIES: ["since", "capacity"],
      DISTRIBUTES_TO: ["since"],
      edge: [], // fallback
    },
  };
}
