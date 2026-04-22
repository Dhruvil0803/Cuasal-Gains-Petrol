// src/components/DropdownFormUI/utils.js

// ---------- Local-storage keys ----------
export const LS = {
  NODE_TYPES: "ui.local.schema.nodeTypes",   // [{label, properties:[{name,type}]}]
  REL_TYPES:  "ui.local.schema.relTypes",    // [{type, srcLabel, dstLabel, properties:[{name,type}]}]
  NODES:      "ui.local.data.nodes",         // [{id, label, props, createdAt}]
  RELS:       "ui.local.data.rels",          // [{id, type, srcRef, dstRef, srcLabel, dstLabel, createdAt, props}]
};

// ---------- Local-storage helpers ----------
export const readLS = (k, defVal) => {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : defVal;
  } catch {
    return defVal;
  }
};

export const writeLS = (k, v) => {
  try { window.localStorage.setItem(k, JSON.stringify(v)); } catch {}
};

export const genId = (p = "local") =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

// ---------- String/identifier helpers ----------
export const stripTicks = (s) => String(s).replace(/^:+/, "").replace(/`/g, "").trim();

export const safeIdent = (s) =>
  stripTicks(String(s)).replace(/[^A-Za-z0-9_]/g, "_");

// ---------- Display helper (no hardcoded property names) ----------
export const displayFromProps = (props, id) => {
  if (!props || typeof props !== "object" || Object.keys(props).length === 0) {
    return `(#${id})`;
  }
  const entries = Object.entries(props).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );
  if (!entries.length) return `(#${id})`;

  const strings = entries.filter(([, v]) => typeof v === "string");
  const numbers = entries.filter(([, v]) => typeof v === "number");

  const parts = [];
  const takeSome = (arr) => {
    for (const [k, v] of arr) {
      parts.push(`${k}: ${String(v)}`);
      if (parts.length >= 2) break;
    }
  };

  takeSome(strings);
  if (parts.length < 2) takeSome(numbers);
  if (parts.length < 2) takeSome(entries);

  const text = parts.join(" | ");
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
};
