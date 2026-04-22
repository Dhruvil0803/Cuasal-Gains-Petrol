// // src/components/GraphBloomClone/helpers.js
// import neo4j from "neo4j-driver";

// /* ----------------------------- helpers ----------------------------- */
// export const stripTicks = (s) => String(s || "").replace(/`/g, "").trim();
// export const qIdent = (s) => "`" + stripTicks(s) + "`";
// export const isInt = (v) =>
//   neo4j.isInt?.(v) || (v && typeof v === "object" && "toNumber" in v);
// export const toJSDeep = (v) =>
//   isInt(v) ? v.toNumber()
//   : Array.isArray(v) ? v.map(toJSDeep)
//   : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k, toJSDeep(x)]))
//   : v;

// export const TEXT_MAX_PX = 84, FONT_SIZE = 12, LINE_HEIGHT = 15, NODE_PAD = 14;
// export const hardWrapWords = (t, n) => {
//   const out=[]; for (const w of String(t??"").split(/\s+/)) {
//     if (w.length<=n) out.push(w); else for (let i=0;i<w.length;i+=n) out.push(w.slice(i,i+n));
//   } return out;
// };
// export const wrapLabel = (text, maxCharsPerLine=8, maxLines=3) => {
//   const s = String(text ?? "").trim(); if (!s) return "(no value)";
//   const words = hardWrapWords(s, maxCharsPerLine); const lines=[]; let cur="";
//   for (const w of words){ const next=(cur?cur+" ":"")+w; if(next.length>maxCharsPerLine){ if(cur) lines.push(cur); cur=w; if(lines.length>=maxLines-1) break; } else cur=next; }
//   if(lines.length<maxLines && cur) lines.push(cur);
//   if(lines.join(" ").length < s.length){ const last=lines.pop()??""; lines.push(last.replace(/\.*$/,"")+"…"); }
//   return lines.join("\n");
// };
// export const sizeForWrapped = (wrapped) => {
//   const lines = String(wrapped).split("\n").length;
//   const needH = lines*LINE_HEIGHT + NODE_PAD*2;
//   const needW = TEXT_MAX_PX + NODE_PAD*2;
//   return Math.round(Math.min(140, Math.max(54, Math.max(needW, needH))));
// };
// export const pickDisplay = (props={}, fb="") => { for (const k of Object.keys(props)){ const v=props[k]; if(v==null) continue; const s=String(v); if(s.trim()) return s; } return fb; };
// export const intFromElementId = (eid) => { const tail = String(eid).split(":").pop(); return /^\d+$/.test(tail) ? neo4j.int(tail) : null; };
// export const toStr = (v) => isInt(v) ? String(v.toNumber()) : String(v);
// export const getNodeEid = (n) => String(n?.elementId ?? toStr(n?.identity ?? ""));
// export const getRelIds = (r) => {
//   if (!r) return ["","",""];
//   const rid = String(r.elementId ?? toStr(r.identity));
//   const sid = String(r.startNodeElementId ?? r.startElementId ?? r.start?.elementId ?? toStr(r.start));
//   const tid = String(r.endNodeElementId   ?? r.endElementId   ?? r.end?.elementId   ?? toStr(r.end));
//   return [rid, sid, tid];
// };
// export const sanitizeKey = (k) => String(k).replace(/[^\w]/g, "_");
// export const nodePropKey = (k) => "p__" + sanitizeKey(k);
// export const relPropKey  = (k) => "r__" + sanitizeKey(k);
// export const labelFlagKey= (l) => "l__" + sanitizeKey(l);
// export const colorForIndex = (i, total) => {
//   const h = Math.round((360 * (i % Math.max(1,total))) / Math.max(1,total));
//   return `hsl(${h} 70% 55%)`;
// };

// /* ----- Types / APOC virtual relationship helpers ----- */
// export const isNeoNode = (x) => x && typeof x === "object" && "identity" in x && ("labels" in x || "elementId" in x);
// export const isNeoRel  = (x) => x && typeof x === "object" && "identity" in x && ("type" in x || "start" in x);
// export const isNeoPath = (x) => x && typeof x === "object" && Array.isArray(x.segments);

// export const isVirtualRel = (x) =>
//   x && typeof x === "object" &&
//   "type" in x &&
//   ( "start" in x || "end" in x ||
//     "startNode" in x || "endNode" in x ||
//     "startNodeId" in x || "endNodeId" in x ||
//     "from" in x || "to" in x );

// export const asEidFromAnyNodeRef = (ref, idMap) => {
//   if (isNeoNode(ref)) {
//     const eid = getNodeEid(ref);
//     const num = toStr(ref.identity);
//     if (num) idMap.set(num, eid);
//     return eid;
//   }
//   if (ref && typeof ref === "object") {
//     if ("elementId" in ref) return String(ref.elementId);
//     if ("id" in ref) return String(ref.id);
//   }
//   if (isInt(ref)) {
//     const num = toStr(ref);
//     return idMap.get(num) ?? num;
//   }
//   if (typeof ref === "number") {
//     const num = String(ref);
//     return idMap.get(num) ?? num;
//   }
//   if (ref == null) return null;
//   return String(ref);
// };

// export const synthRelId = (type, sid, tid, props) => {
//   const basis = `${type}|${sid}|${tid}|${JSON.stringify(props || {})}`;
//   let h = 0; for (let i = 0; i < basis.length; i++) h = (h*31 + basis.charCodeAt(i)) | 0;
//   return `vrel:${type}:${sid}:${tid}:${((h>>>0).toString(36))}`;
// };

// /* ----- clamp pan so the graph stays visible (rendered-space, robust) ----- */
// // helper.js
// // helper.js
// export function clampPanToKeepGraphOnScreen(cy, pad = 40) {
//   if (!cy || cy.destroyed() || cy.elements().length === 0) return;

//   const w = cy.width();
//   const h = cy.height();
//   if (!w || !h) return;

//   // Use labels in the bounds so long edge labels don’t get clipped
//   const bb = cy.elements().boundingBox({ includeLabels: true });

//   const z = cy.zoom();
//   const pan = cy.pan();

//   // Element bounds in *rendered* pixels
//   const x1 = bb.x1 * z + pan.x;
//   const x2 = bb.x2 * z + pan.x;
//   const y1 = bb.y1 * z + pan.y;
//   const y2 = bb.y2 * z + pan.y;

//   const overWide = (bb.w * z) > (w - 2 * pad);
//   const overTall = (bb.h * z) > (h - 2 * pad);

//   let dx = 0, dy = 0;

//   // When the graph is wider than the viewport, keep it between the pads
//   if (overWide) {
//     if (x1 > pad)        dx += pad - x1;            // too far right → nudge left
//     if (x2 < w - pad)    dx += (w - pad) - x2;      // too far left  → nudge right
//   } else {
//     if (x1 < pad)        dx += pad - x1;
//     if (x2 > w - pad)    dx += (w - pad) - x2;
//   }

//   // Same idea vertically
//   if (overTall) {
//     if (y1 > pad)        dy += pad - y1;
//     if (y2 < h - pad)    dy += (h - pad) - y2;
//   } else {
//     if (y1 < pad)        dy += pad - y1;
//     if (y2 > h - pad)    dy += (h - pad) - y2;
//   }

//   if (dx || dy) cy.panBy({ x: dx, y: dy });
// }
// /* ---------------- HUD constants (moved unchanged) ---------------- */
// export const HUD_SWATCHES = [
//   "#3b3b0b","#4b423a","#8b3a2f","#0a7b83","#2c5d8a","#7b3f7b",
//   "#3f6f54","#a16207","#ef4444","#4338ca","#22c55e","#10b981"
// ];
// export const HUD_SIZES = [56, 72, 92, 112];
// src/components/GraphBloomClone/helpers.js
import neo4j from "neo4j-driver";

/* ----------------------------- helpers ----------------------------- */
export const stripTicks = (s) => String(s || "").replace(/`/g, "").trim();
export const qIdent = (s) => "`" + stripTicks(s) + "`";
export const isInt = (v) =>
  neo4j.isInt?.(v) || (v && typeof v === "object" && "toNumber" in v);
export const toJSDeep = (v) =>
  isInt(v) ? v.toNumber()
  : Array.isArray(v) ? v.map(toJSDeep)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k, toJSDeep(x)]))
  : v;

export const TEXT_MAX_PX = 84, FONT_SIZE = 12, LINE_HEIGHT = 15, NODE_PAD = 14;
export const hardWrapWords = (t, n) => {
  const out=[]; for (const w of String(t??"").split(/\s+/)) {
    if (w.length<=n) out.push(w); else for (let i=0;i<w.length;i+=n) out.push(w.slice(i,i+n));
  } return out;
};
export const wrapLabel = (text, maxCharsPerLine=8, maxLines=3) => {
  const s = String(text ?? "").trim(); if (!s) return "(no value)";
  const words = hardWrapWords(s, maxCharsPerLine); const lines=[]; let cur="";
  for (const w of words){ const next=(cur?cur+" ":"")+w; if(next.length>maxCharsPerLine){ if(cur) lines.push(cur); cur=w; if(lines.length>=maxLines-1) break; } else cur=next; }
  if(lines.length<maxLines && cur) lines.push(cur);
  if(lines.join(" ").length < s.length){ const last=lines.pop()??""; lines.push(last.replace(/\.*$/,"")+"…"); }
  return lines.join("\n");
};
export const sizeForWrapped = (wrapped) => {
  const lines = String(wrapped).split("\n").length;
  const needH = lines*LINE_HEIGHT + NODE_PAD*2;
  const needW = TEXT_MAX_PX + NODE_PAD*2;
  return Math.round(Math.min(140, Math.max(54, Math.max(needW, needH))));
};
export const pickDisplay = (props={}, fb="") => { for (const k of Object.keys(props)){ const v=props[k]; if(v==null) continue; const s=String(v); if(s.trim()) return s; } return fb; };

/* CHANGE: return a plain Number for backend JSON compatibility */
export const intFromElementId = (eid) => {
  const tail = String(eid).split(":").pop();
  return /^\d+$/.test(tail) ? Number(tail) : null;
};

export const toStr = (v) => isInt(v) ? String(v.toNumber()) : String(v);
export const getNodeEid = (n) => String(n?.elementId ?? toStr(n?.identity ?? ""));
export const getRelIds = (r) => {
  if (!r) return ["","",""];
  const rid = String(r.elementId ?? toStr(r.identity));
  const sid = String(r.startNodeElementId ?? r.startElementId ?? r.start?.elementId ?? toStr(r.start));
  const tid = String(r.endNodeElementId   ?? r.endElementId   ?? r.end?.elementId   ?? toStr(r.end));
  return [rid, sid, tid];
};
export const sanitizeKey = (k) => String(k).replace(/[^\w]/g, "_");
export const nodePropKey = (k) => "p__" + sanitizeKey(k);
export const relPropKey  = (k) => "r__" + sanitizeKey(k);
export const labelFlagKey= (l) => "l__" + sanitizeKey(l);
export const colorForIndex = (i, total) => {
  const h = Math.round((360 * (i % Math.max(1,total))) / Math.max(1,total));
  return `hsl(${h} 70% 55%)`;
};

/* ----- Types / APOC virtual relationship helpers ----- */
export const isNeoNode = (x) => x && typeof x === "object" && "identity" in x && ("labels" in x || "elementId" in x);
export const isNeoRel  = (x) => x && typeof x === "object" && "identity" in x && ("type" in x || "start" in x);
export const isNeoPath = (x) => x && typeof x === "object" && Array.isArray(x.segments);

export const isVirtualRel = (x) =>
  x && typeof x === "object" &&
  "type" in x &&
  ( "start" in x || "end" in x ||
    "startNode" in x || "endNode" in x ||
    "startNodeId" in x || "endNodeId" in x ||
    "from" in x || "to" in x );

export const asEidFromAnyNodeRef = (ref, idMap) => {
  if (isNeoNode(ref)) {
    const eid = getNodeEid(ref);
    const num = toStr(ref.identity);
    if (num) idMap.set(num, eid);
    return eid;
  }
  if (ref && typeof ref === "object") {
    if ("elementId" in ref) return String(ref.elementId);
    if ("id" in ref) return String(ref.id);
  }
  if (isInt(ref)) {
    const num = toStr(ref);
    return idMap.get(num) ?? num;
  }
  if (typeof ref === "number") {
    const num = String(ref);
    return idMap.get(num) ?? num;
  }
  if (ref == null) return null;
  return String(ref);
};

export const synthRelId = (type, sid, tid, props) => {
  const basis = `${type}|${sid}|${tid}|${JSON.stringify(props || {})}`;
  let h = 0; for (let i = 0; i < basis.length; i++) h = (h*31 + basis.charCodeAt(i)) | 0;
  return `vrel:${type}:${sid}:${tid}:${((h>>>0).toString(36))}`;
};

/* ----- clamp pan so the graph stays visible (rendered-space, robust) ----- */
// helper.js
// helper.js
export function clampPanToKeepGraphOnScreen(cy, pad = 40) {
  if (!cy || cy.destroyed() || cy.elements().length === 0) return;

  const w = cy.width();
  const h = cy.height();
  if (!w || !h) return;

  // Use labels in the bounds so long edge labels don’t get clipped
  const bb = cy.elements().boundingBox({ includeLabels: true });

  const z = cy.zoom();
  const pan = cy.pan();

  // Element bounds in *rendered* pixels
  const x1 = bb.x1 * z + pan.x;
  const x2 = bb.x2 * z + pan.x;
  const y1 = bb.y1 * z + pan.y;
  const y2 = bb.y2 * z + pan.y;

  const overWide = (bb.w * z) > (w - 2 * pad);
  const overTall = (bb.h * z) > (h - 2 * pad);

  let dx = 0, dy = 0;

  // When the graph is wider than the viewport, keep it between the pads
  if (overWide) {
    if (x1 > pad)        dx += pad - x1;            // too far right → nudge left
    if (x2 < w - pad)    dx += (w - pad) - x2;      // too far left  → nudge right
  } else {
    if (x1 < pad)        dx += pad - x1;
    if (x2 > w - pad)    dx += (w - pad) - x2;
  }

  // Same idea vertically
  if (overTall) {
    if (y1 > pad)        dy += pad - y1;
    if (y2 < h - pad)    dy += (h - pad) - y2;
  } else {
    if (y1 < pad)        dy += pad - y1;
    if (y2 > h - pad)    dy += (h - pad) - y2;
  }

  if (dx || dy) cy.panBy({ x: dx, y: dy });
}
/* ---------------- HUD constants (moved unchanged) ---------------- */
export const HUD_SWATCHES = [
  "#3b3b0b","#4b423a","#8b3a2f","#0a7b83","#2c5d8a","#7b3f7b",
  "#3f6f54","#a16207","#ef4444","#4338ca","#22c55e","#10b981"
];
export const HUD_SIZES = [56, 72, 92, 112];
