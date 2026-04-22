// src/components/DropdownFormUI/useGraphSchema.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import neo4j from "neo4j-driver";
// import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from "@/config/env";
import { createDriver } from "@/neo4jFacade";
import { stripTicks, safeIdent } from "./utils";

/**
 * Read-only Neo4j schema loader (labels, properties, relationship pairs, unique keys).
 * Mirrors original logic; creates a driver and closes it on cleanup.
 */
export default function useGraphSchema() {
  const [driver, setDriver] = useState(null);
  const driverRef = useRef(null);

  const [dbSchemaNodes, setDbSchemaNodes] = useState([]);           // [{id,label,title,fields:[{name,label,type,required:true}]}]
  const [dbRelTypePairs, setDbRelTypePairs] = useState(new Map());   // Map<relType, Array<{src,dst}>>
  const [dbRelTypes, setDbRelTypes] = useState([]);                  // string[]
  const [uniqueKeysByLabel, setUniqueKeysByLabel] = useState(new Map()); // Map<label, Set<prop>>
  const [connectError, setConnectError] = useState("");
  const [loading, setLoading] = useState(true);

  // ---------- init driver + load schema ----------
  useEffect(() => {
    let cancelled = false;
    let createdDriver = null;

    (async () => {
      try {
        setLoading(true);
        setConnectError("");
        // createdDriver = neo4j.driver(
        //   NEO4J_URI,
        //   neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
        // );
        // setDriver(createdDriver);
        // driverRef.current = createdDriver;
        createdDriver = createDriver();
        setDriver(createdDriver);
        driverRef.current = createdDriver;

        const session = createdDriver.session({ defaultAccessMode: neo4j.session.READ });

        // --- Node labels + properties (schema) ---
        const nodeRes = await session.run(`
          CALL db.schema.nodeTypeProperties()
          YIELD nodeType, propertyName, propertyTypes
          RETURN nodeType, propertyName, propertyTypes
          ORDER BY nodeType, propertyName
        `);

        const byLabel = new Map();
        for (const rec of nodeRes.records) {
          const nodeType = rec.get("nodeType");
          const rawLabel = Array.isArray(nodeType) ? nodeType[0] : nodeType;
          const label = stripTicks(rawLabel);
          const prop = stripTicks(rec.get("propertyName"));
          if (!label || !prop) continue;

          const types = rec.get("propertyTypes") || [];
          const tset = new Set(types.map(String));
          const isNumber =
            tset.has("Integer") || tset.has("Float") || tset.has("Long") ||
            tset.has("Double") || tset.has("Number") ||
            [...tset].some((t) => /LIST OF (INTEGER|FLOAT|NUMBER|LONG|DOUBLE)/i.test(t));
          const isBool = tset.has("Boolean");

          const field = {
            name: prop,
            label: prop,
            type: isBool ? "checkbox" : isNumber ? "number" : "text",
            required: true,
          };

          if (!byLabel.has(label)) byLabel.set(label, []);
          const arr = byLabel.get(label);
          if (!arr.some((f) => f.name === prop)) arr.push(field);
        }

        const nodes = [...byLabel.entries()]
          .map(([id, fields]) => ({ id, title: id, fields }))
          .sort((a, b) => a.title.localeCompare(b.title));

        // --- Relationship type label pairs from data ---
        const pairRes = await session.run(`
          MATCH (src)-[r]->(dst)
          RETURN type(r) AS relType,
                 head(labels(src)) AS srcLabel,
                 head(labels(dst)) AS dstLabel
          ORDER BY relType, srcLabel, dstLabel
        `);

        const pairsMap = new Map(); // relType -> Set("src|dst")
        for (const rec of pairRes.records) {
          const rtype = stripTicks(rec.get("relType"));
          const srcLabel = stripTicks(rec.get("srcLabel"));
          const dstLabel = stripTicks(rec.get("dstLabel"));
          if (!rtype || !srcLabel || !dstLabel) continue;
          if (!pairsMap.has(rtype)) pairsMap.set(rtype, new Set());
          pairsMap.get(rtype).add(`${srcLabel}|${dstLabel}`);
        }

        const relPairs = new Map();
        for (const [rtype, setPairs] of pairsMap.entries()) {
          const list = Array.from(setPairs).map((s) => {
            const [src, dst] = s.split("|");
            return { src, dst };
          }).sort((a, b) => (a.src + a.dst).localeCompare(b.src + b.dst));
          relPairs.set(rtype, list);
        }
        const allRelTypes = Array.from(relPairs.keys()).sort();

        // --- Unique constraints (best-effort) ---
        const keysMap = new Map();
        try {
          const cRes = await session.run(`
            SHOW CONSTRAINTS
            YIELD name, type, entityType, labelsOrTypes, properties
            WHERE entityType = 'NODE' AND type STARTS WITH 'UNI'
            RETURN labelsOrTypes, properties
          `);
          for (const rec of cRes.records) {
            const labels = rec.get("labelsOrTypes") || [];
            const props = rec.get("properties") || [];
            const label = labels[0] ? stripTicks(labels[0]) : null;
            if (!label || !props.length) continue;
            if (!keysMap.has(label)) keysMap.set(label, new Set());
            const set = keysMap.get(label);
            for (const p of props) set.add(stripTicks(p));
          }
        } catch { /* ignore SHOW CONSTRAINTS errors on older versions */ }

        await session.close();
        if (cancelled) return;

        setDbSchemaNodes(nodes);
        setDbRelTypes(allRelTypes);
        setDbRelTypePairs(relPairs);
        setUniqueKeysByLabel(keysMap);
      } catch (e) {
        if (!cancelled) {
          setConnectError(e.message || String(e));
          setDbSchemaNodes([]);
          setDbRelTypes([]);
          setDbRelTypePairs(new Map());
          setUniqueKeysByLabel(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      try { driverRef.current && driverRef.current.close(); } catch {}
    };
  }, []);

  // ---------- Convenience: query instances for a label (DB, read-only) ----------
  const fetchDbInstancesForLabel = useCallback(
  async (label, limit = 500) => {
    if (!driver || !label) return [];
    let session;
    try {
      session = driver.session({ defaultAccessMode: neo4j.session.READ });
      const cypher = `
        MATCH (n:\`${safeIdent(label)}\`)
        RETURN id(n) AS id, properties(n) AS props
        LIMIT toInteger($lim)
      `;
      const res = await session.run(cypher, { lim: Number(limit) });
      return res.records.map((r) => {
        const idVal = r.get("id");
        const id = idVal?.toNumber ? idVal.toNumber() : idVal;
        return { id, props: r.get("props") };
      });
    } catch {
      return [];
    } finally {
      try { await session?.close(); } catch {}
    }
  },
  [driver]
);

  return {
    driver,
    loading,
    connectError,
    dbSchemaNodes,
    dbRelTypePairs,
    dbRelTypes,
    uniqueKeysByLabel,
    fetchDbInstancesForLabel,
  };
}
