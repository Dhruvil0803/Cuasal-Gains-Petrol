// src/components/DropdownFormUI/ImportPlanner/ImportPlanner.jsx
import React, { useMemo, useRef, useState } from "react";

/**
 * Dependencies you need installed:
 *   npm i papaparse xlsx
 *
 * DRY-RUN importer:
 *  - Accepts CSV and XLSX
 *  - Supports simple formats:
 *      Nodes: Id, ...props   (label inferred from sheet/file name)
 *      Rels : SourceId,TargetId,Type  (labels auto-filled if only one node label exists)
 *  - Still supports the old explicit formats (keyField/keyValue, src,dst columns)
 *  - Builds a dry-run plan: constraints, MERGEs for nodes and relationships
 *  - Detects intra-file duplicates; optional DB existence checks via props
 *  - Renders preview Cypher (no writes)
/


/* ---------------- Small helpers ---------------- */
import Papa from "papaparse";
import * as XLSX from "xlsx";
// Toggle to hide on-screen previews
const SHOW_PREVIEW = false;

const strip = (v) => (v == null ? "" : String(v).trim());
const asBool = (v) => {
  if (typeof v === "boolean") return v;
  const s = strip(v).toLowerCase();
  return ["true", "1", "yes", "y"].includes(s);
};
const coerce = (value) => {
  const s = strip(value);
  if (s === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (["true", "false", "yes", "no", "1", "0"].includes(s.toLowerCase())) return asBool(s);
  return value;
};

// Parse a header like "movieId:ID", "year:int", ":LABEL", ":START_ID(Person)"
const parseHeader = (h = "") => {
  const raw = String(h).trim();
  const mStart = raw.match(/^:START_ID(?:\(([^)]+)\))?$/i);
  const mEnd   = raw.match(/^:END_ID(?:\(([^)]+)\))?$/i);
  if (/^:label$/i.test(raw)) return { name: ":LABEL", role: "label" };
  if (/^:type$/i.test(raw))  return { name: ":TYPE",  role: "relType" };
  if (mStart) return { name: ":START_ID", role: "start", labelHint: mStart[1] || null };
  if (mEnd)   return { name: ":END_ID",   role: "end",   labelHint: mEnd[1]   || null };

  // typed or ID suffix: "movieId:ID" or "year:int"
  const parts = raw.split(":");
  // inside parseHeader, replace the typed-suffix branch with:
if (parts.length >= 2) {
  const base = parts[0];
  const suf  = parts.slice(1).join(":"); // e.g. "string[]"
  if (/^id$/i.test(suf)) return { name: base, role: "id" };

  // capture arrays like string[], int[], boolean[]
  const mArr = suf.match(/^(string|int|float|double|boolean|bool|long|date|datetime)\[\]$/i);
  if (mArr) return { name: base, role: "prop", type: mArr[1].toLowerCase() + "[]" };

  if (/^(int|float|double|boolean|bool|long|date|datetime|string)$/i.test(suf))
    return { name: base, role: "prop", type: suf.toLowerCase() };
}

  // plain column -> property
  return { name: raw, role: "prop" };
};

// Coerce by explicit type (if given on header)
const coerceByType = (val, type) => {
  const s = String(val ?? "").trim();
  if (s === "") return null;

  // arrays: split on ; or | (common CSV patterns)
  const splitTo = (t) =>
    s.split(/[;|]/).map(x => String(x).trim()).filter(x => x !== "").map(x => coerceByType(x, t));

  switch (type) {
    case "string[]":   return splitTo("string");
    case "int[]":
    case "long[]":     return splitTo("int");
    case "float[]":
    case "double[]":   return splitTo("float");
    case "boolean[]":
    case "bool[]":     return splitTo("boolean");

    case "string":     return s;
    case "int":
    case "long":       return Number.parseInt(s, 10);
    case "float":
    case "double":     return Number.parseFloat(s);
    case "boolean":
    case "bool":       return /^(true|1|yes|y)$/i.test(s);
    case "date":
    case "datetime":   return s; // leave as-is or plug stricter parser
    default:           return val;
  }
};

const baseName = (name = "") =>
  String(name).trim().replace(/\.(csv|tsv|xlsx|xls|json)$/i, "");

const niceLabel = (raw = "") => {
  const s = strip(raw).replace(/[^A-Za-z0-9_]+/g, " ").trim();
  if (!s) return "Entity";
  return s
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
};

// Infer label/type from sheet or file name
const inferFromSheetName = (sheetName = "") => {
  const s = baseName(sheetName);
  if (/^nodes[_\-\s]/i.test(s)) return { kind: "node", name: s.replace(/^nodes[_\-\s]/i, "") };
  if (/^rels?[_\-\s]/i.test(s)) return { kind: "rel",  name: s.replace(/^rels?[_\-\s]/i, "") };
  return null;
};

// Fallback: if not prefixed, use whole base name as label
const labelFromNameOrFallback = (sheetName = "") => {
  const inferred = inferFromSheetName(sheetName);
  if (inferred?.kind === "node") return niceLabel(inferred.name);
  const b = baseName(sheetName);
  if (b && !/^rels?$/i.test(b)) return niceLabel(b);
  return "Entity";
};

// Accept both explicit (keyField/keyValue) and simple Id-based node sheets
const looksLikeNode = (cols) => {
  const lc = cols.map(c => c.toLowerCase());
  const hasLegacy = lc.includes("keyfield") && lc.includes("keyvalue");
  const hasSimple = lc.includes("id");
  const hasNeo4j  = lc.some(c => /:id$/.test(c));      // e.g. "movieId:ID"
  const hasLabel  = lc.includes(":label");
  return hasLegacy || hasSimple || hasNeo4j || hasLabel;
};

const looksLikeRel = (cols) => {
  const lc = cols.map(c => c.toLowerCase());
  const explicit =
    lc.includes("type") &&
    lc.includes("srclabel") && lc.includes("srckeyfield") && lc.includes("srckeyvalue") &&
    lc.includes("dstlabel") && lc.includes("dstkeyfield") && lc.includes("dstkeyvalue");
  const simple   = lc.includes("type") && lc.includes("sourceid") && lc.includes("targetid");
  const neo4j    = lc.includes(":type") && lc.some(c => c.startsWith(":start_id")) && lc.some(c => c.startsWith(":end_id"));
  return explicit || simple || neo4j;
};


export default function ImportPlanner({
  getExistingNode, // optional async (label, keyField, keyValue) => truthy
  getExistingRel,  // optional async (relObj) => truthy
}) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef(null);

  const onPickFiles = () => fileInputRef.current?.click();
  const reset = () => { setPlan(null); setMsg(""); };

  const parseCSVFile = (file) =>
    new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: (res) => resolve({ rows: res.data, meta: res.meta }),
        error: (err) => reject(err),
      });
    });

  const parseXLSXFile = async (file) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      return { sheetName: name, rows };
    });
    return sheets;
  };

  /* ---------------- Classification ---------------- */

  const classifyNodesSheet = (rows, sheetName) => {
  const normalized = [];
  const errors = [];
  const seen = new Set();

  // Inspect headers (from first row)
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const parsedHeaders = headers.map(parseHeader);

  // find id column: prefer ":ID", else legacy keyField/keyValue, else "Id"
  const idIdx = parsedHeaders.findIndex(h => h.role === "id");
  const hasLegacy = headers.some(h => /^(keyfield|keyvalue)$/i.test(h));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    let label = null;
    // Label: from :LABEL cell if present, else infer from name
    const labelColIdx = parsedHeaders.findIndex(h => h.role === "label");
    if (labelColIdx >= 0) {
      const labelVal = String(r[headers[labelColIdx]] ?? "").trim();
      label = labelVal || labelFromNameOrFallback(sheetName);
    } else {
      label = labelFromNameOrFallback(sheetName);
    }

    let keyField = "";
    let keyValue = "";

    if (idIdx >= 0) {
      keyField = parsedHeaders[idIdx].name || "Id"; // base name before :ID
      keyValue = String(r[headers[idIdx]] ?? "").trim();
    } else if (hasLegacy) {
      const kf = String(r["keyField"] ?? r["KeyField"] ?? "").trim();
      const kv = String(r["keyValue"] ?? r["KeyValue"] ?? "").trim();
      if (!kf || !kv) {
        errors.push(`Row ${i + 1}: Empty keyField/keyValue`);
        continue;
      }
      keyField = kf; keyValue = kv;
    } else if ("Id" in r || "id" in r) {
      keyField = "Id";
      keyValue = String(r["Id"] ?? r["id"] ?? "").trim();
    } else {
      errors.push(`Row ${i + 1}: No :ID, no keyField/keyValue, and no Id column`);
      continue;
    }

    if (!label || !keyField || !keyValue) {
      errors.push(`Row ${i + 1}: Missing label or key`);
      continue;
    }

    // Build props: skip id & :LABEL; apply type coercion if header has :int/:boolean/...
    const props = {};
    for (let c = 0; c < headers.length; c++) {
      const head = headers[c];
      const hInfo = parsedHeaders[c];
      if (c === idIdx) continue;           // skip :ID column
      if (hInfo.role === "label") continue; // skip :LABEL
      if (hasLegacy && /^(keyfield|keyvalue)$/i.test(head)) continue;

      const propName = hInfo.role === "prop" ? hInfo.name : head; // remove type suffix if present
      const rawVal = r[head];
      const val = hInfo.type ? coerceByType(rawVal, hInfo.type) : coerce(rawVal);
      props[propName] = val;
    }

    const sig = `${label}::${keyField}::${keyValue}`;
    const conflict = seen.has(sig);
    seen.add(sig);

    normalized.push({
      label,
      keyField,
      keyValue,
      props,
      conflict,
      existsInDb: null,
    });
  }

  return { kind: "node", labelOrType: null, nodes: normalized, errors };
};

const classifyRelsSheet = (rows, sheetName) => {
  const normalized = [];
  const errors = [];
  const seen = new Set();

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const parsedHeaders = headers.map(parseHeader);

  const idxStart = parsedHeaders.findIndex(h => h.role === "start");
  const idxEnd   = parsedHeaders.findIndex(h => h.role === "end");
  const idxType  = parsedHeaders.findIndex(h => h.role === "relType");

  const explicit = rows[0] && "srcLabel" in rows[0] && "dstLabel" in rows[0];
  const simple   = rows[0] && "SourceId" in rows[0] && "TargetId" in rows[0] && "Type" in rows[0];
  const neo4j    = idxStart >= 0 && idxEnd >= 0 && idxType >= 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    let type = "";
    let srcLabel = "";
    let dstLabel = "";
    let srcKeyField = "Id";
    let dstKeyField = "Id";
    let srcKeyValue = "";
    let dstKeyValue = "";

    if (neo4j) {
      type = String(r[headers[idxType]] ?? "").trim();
      srcKeyValue = String(r[headers[idxStart]] ?? "").trim();
      dstKeyValue = String(r[headers[idxEnd]] ?? "").trim();
      // Labels may be hinted: :START_ID(Person)
      srcLabel = parsedHeaders[idxStart].labelHint || "";
      dstLabel = parsedHeaders[idxEnd].labelHint || "";
      // If no label hints, we’ll fill later (same single-label logic as before)
    } else if (simple) {
      type = String(r["Type"] ?? r["type"] ?? "").trim();
      srcKeyValue = String(r["SourceId"] ?? "").trim();
      dstKeyValue = String(r["TargetId"] ?? "").trim();
      // src/dst labels will be filled later if only one node label exists
    } else if (explicit) {
      type = String(r["type"] ?? r["Type"] ?? "").trim();
      srcLabel = String(r["srcLabel"] ?? "").trim();
      dstLabel = String(r["dstLabel"] ?? "").trim();
      srcKeyField = String(r["srcKeyField"] ?? "").trim();
      dstKeyField = String(r["dstKeyField"] ?? "").trim();
      srcKeyValue = String(r["srcKeyValue"] ?? "").trim();
      dstKeyValue = String(r["dstKeyValue"] ?? "").trim();
    } else {
      errors.push(`Row ${i + 1}: Not a relationship row (need :START_ID/:END_ID/:TYPE or SourceId/TargetId/Type or src*/dst*)`);
      continue;
    }

    if (!type || !srcKeyValue || !dstKeyValue) {
      errors.push(`Row ${i + 1}: Missing Type or endpoint IDs`);
      continue;
    }

    const sig = `${type}::${srcLabel}:${srcKeyField}=${srcKeyValue}->${dstLabel}:${dstKeyField}=${dstKeyValue}`;
    const conflict = seen.has(sig);
    seen.add(sig);

    // carry over any extra props (typed headers become clean names)
    const props = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      const info = parsedHeaders[c];
      const low = h.toLowerCase();
      if (info.role === "start" || info.role === "end" || info.role === "relType") continue;
      if (["type","sourceid","targetid","srclabel","srckeyfield","srckeyvalue","dstlabel","dstkeyfield","dstkeyvalue"].includes(low)) continue;
      const name = info.role === "prop" ? info.name : h;
      const val  = info.type ? coerceByType(r[h], info.type) : coerce(r[h]);
      props[name] = val;
    }

    normalized.push({
      type,
      srcLabel,
      srcKeyField,
      srcKeyValue,
      dstLabel,
      dstKeyField,
      dstKeyValue,
      props,
      conflict,
      existsInDb: null,
    });
  }

  return { kind: "rel", labelOrType: null, rels: normalized, errors };
};


  const classifyUnknown = (rows, sheetName) => {
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    if (looksLikeRel(cols)) return classifyRelsSheet(rows, sheetName);
    if (looksLikeNode(cols)) return classifyNodesSheet(rows, sheetName);
    return { kind: "unknown", labelOrType: null, errors: ["Unrecognized columns; not Node or Relationship"] };
  };

  /* ---------------- Plan helpers ---------------- */

  const buildConstraintsFromNodes = (sheets) => {
    const map = new Map(); // label -> keyField
    for (const sh of sheets) {
      if (sh.kind !== "node" || !sh.nodes) continue;
      for (const n of sh.nodes) {
        if (!n.label || !n.keyField) continue;
        if (!map.has(n.label)) map.set(n.label, n.keyField);
      }
    }
    return Array.from(map.entries()).map(([label, keyField]) => ({ label, keyField }));
  };

  const fillMissingRelLabelsIfPossible = (files) => {
    // Find unique node labels across all node sheets
    const nodeLabels = new Set();
    for (const f of files) {
      for (const s of f.sheets) {
        if (s.kind === "node" && s.nodes?.length) {
          for (const n of s.nodes) nodeLabels.add(n.label);
        }
      }
    }
    const labels = Array.from(nodeLabels);

    for (const f of files) {
      for (const s of f.sheets) {
        if (s.kind !== "rel" || !s.rels) continue;

        // If we have exactly one node label discovered, use it on both ends where missing
        if (labels.length === 1) {
          const only = labels[0];
          for (const r of s.rels) {
            if (!r.srcLabel) r.srcLabel = only;
            if (!r.dstLabel) r.dstLabel = only;
            if (!r.srcKeyField) r.srcKeyField = "Id";
            if (!r.dstKeyField) r.dstKeyField = "Id";
          }
        } else {
          // If multiple labels exist and rel row lacks labels → add an error hint
          for (const [idx, r] of s.rels.entries()) {
            if (!r.srcLabel || !r.dstLabel) {
              s.errors = s.errors || [];
              s.errors.push(
                `Row ${idx + 1}: Multiple node labels in dataset; please add srcLabel/dstLabel columns.`
              );
            }
          }
        }
      }
    }
  };

  const stampExistsFlags = async (sheets) => {
    if (!getExistingNode && !getExistingRel) return sheets;
    const work = [];
    for (const sh of sheets) {
      if (sh.kind === "node" && sh.nodes?.length && getExistingNode) {
        for (const n of sh.nodes) {
          work.push(
            (async () => {
              try { n.existsInDb = !!(await getExistingNode(n.label, n.keyField, n.keyValue)); }
              catch { n.existsInDb = null; }
            })()
          );
        }
      }
      if (sh.kind === "rel" && sh.rels?.length && getExistingRel) {
        for (const r of sh.rels) {
          work.push(
            (async () => {
              try { r.existsInDb = !!(await getExistingRel(r)); }
              catch { r.existsInDb = null; }
            })()
          );
        }
      }
    }
    await Promise.all(work);
    return sheets;
  };

  const summarize = (sheet) => {
    const stats = { rows: 0, creates: 0, merges: 0, conflicts: 0, errors: 0 };
    if (sheet.kind === "node" && sheet.nodes) {
      stats.rows = sheet.nodes.length;
      for (const n of sheet.nodes) {
        if (n.conflict) stats.conflicts++;
        if (n.existsInDb === true) stats.merges++;
        else stats.creates++;
      }
    } else if (sheet.kind === "rel" && sheet.rels) {
      stats.rows = sheet.rels.length;
      for (const r of sheet.rels) {
        if (r.conflict) stats.conflicts++;
        if (r.existsInDb === true) stats.merges++;
        else stats.creates++;
      }
    }
    stats.errors = (sheet.errors || []).length;
    return stats;
  };

  /* ---------- Cypher preview builders (no execution) ---------- */

  const cypherForConstraints = (constraints) =>
    constraints.map(
      ({ label, keyField }) =>
        `CREATE CONSTRAINT IF NOT EXISTS FOR (n:\`${label}\`) REQUIRE n.\`${keyField}\` IS UNIQUE;`
    );

  // Batch Node MERGE with UNWIND
  const cypherForNodes = (label, keyField, rows) => {
    const items = rows.map((n) => ({
      keyValue: n.keyValue,
      props: n.props || {},
    }));
    return {
      params: { rows: items },
      cypher: `
UNWIND $rows AS row
MERGE (n:\`${label}\` { \`${keyField}\`: row.keyValue })
ON CREATE SET n += row.props, n.createdAt = coalesce(n.createdAt, timestamp())
ON MATCH  SET n += row.props, n.updatedAt = timestamp();`.trim(),
    };
  };

  // Batch Relationship MERGE with UNWIND (per (type, srcLabel, srcKeyField, dstLabel, dstKeyField) bucket)
  const cypherForRels = (type, rows) => {
    const items = rows.map((r) => ({
      srcKeyValue: r.srcKeyValue,
      dstKeyValue: r.dstKeyValue,
      props: r.props || {},
    }));
    const { srcLabel, srcKeyField, dstLabel, dstKeyField } = rows[0];
    return {
      params: { rows: items },
      cypher: `
UNWIND $rows AS row
MATCH (a:\`${srcLabel}\` { \`${srcKeyField}\`: row.srcKeyValue })
MATCH (b:\`${dstLabel}\` { \`${dstKeyField}\`: row.dstKeyValue })
MERGE (a)-[r:\`${type}\`]->(b)
ON CREATE SET r += row.props, r.createdAt = coalesce(r.createdAt, timestamp())
ON MATCH  SET r += row.props, r.updatedAt = timestamp();`.trim(),
    };
  };

  const bucketRels = (rels) => {
    const buckets = new Map();
    for (const r of rels) {
      const k = [r.type, r.srcLabel, r.srcKeyField, r.dstLabel, r.dstKeyField].join("|");
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(r);
    }
    return Array.from(buckets.entries()).map(([k, items]) => {
      const [type, srcLabel, srcKeyField, dstLabel, dstKeyField] = k.split("|");
      return { type, srcLabel, srcKeyField, dstLabel, dstKeyField, items };
    });
  };

  /* ------------------------- File handling ------------------------- */

  const handleFiles = async (evt) => {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;

    setBusy(true);
    setMsg("");
    try {
      const out = [];
      for (const file of files) {
        const entry = { fileName: file.name, sheets: [] };

        if (file.name.toLowerCase().endsWith(".csv")) {
          const { rows } = await parseCSVFile(file);
          const cols = rows[0] ? Object.keys(rows[0]) : [];
          let parsed;
          if (looksLikeRel(cols)) parsed = classifyRelsSheet(rows, file.name);
          else if (looksLikeNode(cols)) parsed = classifyNodesSheet(rows, file.name);
          else parsed = classifyUnknown(rows, file.name);
          entry.sheets.push({ sheetName: file.name, ...parsed });
        } else if (file.name.toLowerCase().endsWith(".xlsx")) {
          const sheets = await parseXLSXFile(file);
          for (const s of sheets) {
            const rows = s.rows;
            const cols = rows[0] ? Object.keys(rows[0]) : [];
            let parsed;
            if (looksLikeRel(cols)) parsed = classifyRelsSheet(rows, s.sheetName);
            else if (looksLikeNode(cols)) parsed = classifyNodesSheet(rows, s.sheetName);
            else parsed = classifyUnknown(rows, s.sheetName);
            entry.sheets.push({ sheetName: s.sheetName, ...parsed });
          }
        } else {
          entry.sheets.push({
            sheetName: file.name,
            kind: "unknown",
            labelOrType: null,
            errors: ["Unsupported file type (only .csv, .xlsx)"],
          });
        }

        out.push(entry);
      }

      // Fill missing rel labels if we only have one node label overall
      fillMissingRelLabelsIfPossible(out);

      // Optional existence stamping
      for (const f of out) {
        f.sheets = await stampExistsFlags(f.sheets);
        f.sheets = f.sheets.map((sh) => ({ ...sh, stats: summarize(sh) }));
      }

      const allSheets = out.flatMap((f) => f.sheets);
      const constraints = buildConstraintsFromNodes(allSheets);

      const nodeBuckets = new Map(); // label -> keyField
for (const s of allSheets) {
  if (s.kind === "node" && s.nodes?.length) {
    for (const n of s.nodes) {
      if (n.label && n.keyField) nodeBuckets.set(n.label, n.keyField);
    }
  }
}
const onlyOneLabel = nodeBuckets.size === 1 ? [...nodeBuckets.keys()][0] : null;
const onlyOneKey   = onlyOneLabel ? nodeBuckets.get(onlyOneLabel) : null;

// fill missing rel labels if we have exactly one node label in input
if (onlyOneLabel && onlyOneKey) {
  for (const s of allSheets) {
    if (s.kind === "rel" && s.rels?.length) {
      for (const r of s.rels) {
        if (!r.srcLabel)    r.srcLabel = onlyOneLabel;
        if (!r.dstLabel)    r.dstLabel = onlyOneLabel;
        if (!r.srcKeyField) r.srcKeyField = onlyOneKey;
        if (!r.dstKeyField) r.dstKeyField = onlyOneKey;
      }
    }
  }
}
      setPlan({ files: out, constraints });
      setMsg("Dry-run complete. Nothing was written. Please Export Dry-Run Json and check for any errors and if any errors follow rules for importing the data.");
    } catch (e) {
      console.error(e);
      setMsg(`Error: ${e?.message || String(e)}`);
      setPlan(null);
    } finally {
      setBusy(false);
      evt.target.value = "";
    }
  };

  const exportPlan = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neo4j-import-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------- Render helpers ------------------------ */

  const renderNodeSheet = (sheet) => {
    if (!SHOW_PREVIEW) return null;
    const buckets = new Map(); // `${label}|${keyField}` -> array
    for (const n of sheet.nodes || []) {
      const k = `${n.label}|${n.keyField}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(n);
    }

    return (
      <div style={{ margin: "12px 0 20px" }}>
        {Array.from(buckets.entries()).map(([k, items]) => {
          const [label, keyField] = k.split("|");
          const { cypher, params } = cypherForNodes(
            label,
            keyField,
            items.map((n) => ({ keyValue: n.keyValue, props: n.props }))
          );

          return (
            <div key={k} style={{ marginBottom: 16, padding: 12, border: "1px solid #2f3645", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                MERGE Nodes — Label: <code>{label}</code> (key: <code>{keyField}</code>) — {items.length} rows
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{cypher}</pre>
              <div style={{ opacity: 0.8, fontSize: 12, marginTop: 6 }}>Params sample (first 2):</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify({ rows: params.rows.slice(0, 2) }, null, 2)}
              </pre>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRelSheet = (sheet) => {
    if (!SHOW_PREVIEW) return null;
    const buckets = bucketRels(sheet.rels || []);
    return (
      <div style={{ margin: "12px 0 20px" }}>
        {buckets.map((b, i) => {
          // Skip buckets that still have missing labels (ambiguous dataset)
          if (!b.srcLabel || !b.dstLabel) return (
            <div key={i} style={{ color: "#fca5a5", marginBottom: 8 }}>
              Relationship bucket has missing labels. Add srcLabel/dstLabel to the CSV or provide a single node sheet.
            </div>
          );

          const { cypher, params } = cypherForRels(b.type, b.items);

          return (
            <div key={i} style={{ marginBottom: 16, padding: 12, border: "1px solid #2f3645", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                MERGE Relationships — Type: <code>{b.type}</code> — {b.items.length} rows
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  ({b.srcLabel}.{b.srcKeyField} → {b.dstLabel}.{b.dstKeyField})
                </div>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{cypher}</pre>
              <div style={{ opacity: 0.8, fontSize: 12, marginTop: 6 }}>Params sample (first 2):</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify({ rows: params.rows.slice(0, 2) }, null, 2)}
              </pre>
            </div>
          );
        })}
      </div>
    );
  };

  const summary = useMemo(() => {
    if (!plan) return null;
    const out = [];
    for (const f of plan.files) {
      for (const s of f.sheets) {
        out.push({
          file: f.fileName,
          sheet: s.sheetName,
          kind: s.kind,
          labelOrType: s.labelOrType || "",
          ...s.stats,
        });
      }
    }
    return out;
  }, [plan]);

  return (
    <div style={{ color: "var(--text)" }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={onPickFiles}
          style={{
            background: "transparent",
            color: "#93c5fd",
            border: "1px dashed #374151",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={busy}
          title="Upload CSV or XLSX"
        >
          + Import (CSV / XLSX)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          multiple
          style={{ display: "none" }}
          onChange={handleFiles}
        />

        {plan && (
          <>
            <button
              onClick={exportPlan}
              style={{
                background: "transparent",
                color: "#cbd5e1",
                border: "1px dashed #374151",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Download dry-run JSON"
            >
              Export Dry-Run JSON
            </button>
            <button
              onClick={reset}
              style={{
                background: "transparent",
                color: "#fca5a5",
                border: "1px dashed #374151",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          </>
        )}

        {busy && <span style={{ marginLeft: 8, opacity: 0.85 }}>Parsing…</span>}
      </div>

      {msg && <div style={{ marginBottom: 12, opacity: 0.9 }}>{msg}</div>}

      {/* {!plan && (
        <div style={{ opacity: 0.8 }}>
          Upload:
          <ul style={{ margin: "6px 0 0 18px" }}>
            <li><code>Id,Name,House</code> … (Nodes)</li>
            <li><code>SourceId,TargetId,Type</code> … (Relationships)</li>
          </ul>
          Labels are taken from the sheet/file name (e.g., <code>Nodes_Person.csv</code> → <code>Person</code>).
          If you only provide one node sheet, relationship labels are auto-filled.
        </div>
      )} */}

{plan && SHOW_PREVIEW ? (
  <>
    {/* Constraints preview */}
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Constraints we would ensure</div>
      {plan.constraints.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No unique keys discovered (no node sheets?)</div>
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {cypherForConstraints(plan.constraints).join("\n")}
        </pre>
      )}
    </div>

    {/* Summary table */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Sheets summary</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)" }}>
          <thead>
            <tr>
              {["File", "Sheet", "Kind", "Label/Type", "Rows", "Creates", "Merges", "Conflicts", "Errors"].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #334155", padding: "6px 8px", fontWeight: 700 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(plan ? plan.files.flatMap(f => f.sheets) : []).map((s, idx) => (
              <tr key={idx}>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{/* file */}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.sheetName}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.kind}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.labelOrType || ""}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.stats?.rows ?? 0}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.stats?.creates ?? 0}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.stats?.merges ?? 0}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.stats?.conflicts ?? 0}</td>
                <td style={{ borderBottom: "1px solid #1f2937", padding: "6px 8px" }}>{s.stats?.errors ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Per-file details */}
    {plan.files.map((f) => (
      <div key={f.fileName} style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          File: <span style={{ opacity: 0.9 }}>{f.fileName}</span>
        </div>
        {f.sheets.map((s) => (
          <div key={s.sheetName} style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>
              <strong>Sheet:</strong> {s.sheetName} &nbsp;•&nbsp; <strong>Kind:</strong> {s.kind}
              {s.labelOrType ? (
                <>
                  &nbsp;•&nbsp; <strong>Inferred:</strong> <code>{s.labelOrType}</code>
                </>
              ) : null}
              {s.errors?.length ? (
                <div style={{ color: "#fca5a5", marginTop: 6 }}>
                  {s.errors.slice(0, 3).map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                  {s.errors.length > 3 && <div>…and {s.errors.length - 3} more</div>}
                </div>
              ) : null}
            </div>

            {s.kind === "node" && s.nodes?.length ? renderNodeSheet(s) : null}
            {s.kind === "rel"  && s.rels?.length  ? renderRelSheet(s)  : null}
          </div>
        ))}
      </div>
    ))}
  </>
) : null}
    </div>
  );
}
