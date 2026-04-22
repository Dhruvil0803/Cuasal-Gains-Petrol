// src/neo4jFacade.js
import neo4j from "neo4j-driver";

const USE_BACKEND = import.meta.env.VITE_USE_BACKEND_NEO4J === "true";

/**
 * Drop-in replacement for neo4j.driver(...)
 *
 * - USE_BACKEND=false → return the real browser driver (original behavior)
 * - USE_BACKEND=true  → return a facade whose session().run() hits your backend
 *   - READs → POST /api/neo4j/query
 *   - WRITEs → POST /api/neo4j/write  (only if you call session({ defaultAccessMode: WRITE }))
 *
 * The facade mimics neo4j-driver's result shape enough for existing code:
 *   - result.records is an array of objects with:
 *       { keys: string[], get(kOrIdx), toObject() }
 */
export function createDriver() {
  if (!USE_BACKEND) {
    // Original in-browser driver path
    return neo4j.driver(
      import.meta.env.VITE_NEO4J_URI,
      neo4j.auth.basic(
        import.meta.env.VITE_NEO4J_USER,
        import.meta.env.VITE_NEO4J_PASSWORD
      )
    );
  }

  // Facade session that proxies queries to the backend API
  const mkSession = (mode = "READ") => ({
    async run(cypher, params) {
      const isWrite =
        mode === "WRITE" ||
        mode === neo4j.session?.WRITE ||
        /^(?=.*\b(create|merge|delete|detach|set|remove|drop|index|constraint)\b)/i.test(
          String(cypher || "")
        );

      const endpoint = isWrite ? "/api/neo4j/write" : "/api/neo4j/query";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cypher, params }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Neo4j query failed (${res.status})`);
      }

      // Make facade records feel like neo4j-driver Records
      const records = (data.records || []).map((row) => {
        const keys = Object.keys(row);
        const get = (kOrIdx) =>
          typeof kOrIdx === "number" ? row[keys[kOrIdx]] : row[kOrIdx];

        return {
          keys,
          get,
          toObject: () => row,
        };
      });

      return { records };
    },
    async close() {},
  });

  // Driver-like object
  return {
    session({ defaultAccessMode } = {}) {
      const mode =
        defaultAccessMode === neo4j.session?.WRITE || defaultAccessMode === "WRITE"
          ? "WRITE"
          : "READ";
      return mkSession(mode);
    },
    async verifyConnectivity() {
      const r = await mkSession("READ").run("RETURN 1 AS ok");
      if (!r?.records?.length) throw new Error("Connectivity check failed");
    },
    async close() {},
  };
}
