// src/components/GraphBloomClone/RuleStyler.jsx
import React from "react";
import { nodePropKey } from "./helper.js";
import { setActiveRule, applyActiveRule, clearActiveRule } from "./ruleStylingRuntime";
import { writeActiveStyleRule } from "./styleRuleStore";

// Primary label from node data (your addNode stores _labels on data)
function getPrimaryLabelFromNode(n) {
 if (!n) return null;
 const d = n.data() || {};
// Prefer array labels: _labels or labels
const arr = Array.isArray(d._labels) ? d._labels
           : Array.isArray(d.labels)  ? d.labels
           : null;
  if (arr && arr.length) return arr[0];
   // Fallback to single 'label' string if present
  if (typeof d.label === "string" && d.label.trim()) return d.label.trim();
  return null;
 }

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* ----------------------- Color helpers (hex <-> hsl) ----------------------- */
function hexToRgb(hex) {
  const s = String(hex || "").replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map(c=>c+c).join("") : s, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > .5 ? d/(2 - max - min) : d/(max + min);
    switch(max){
      case r: h = (g-b)/d + (g < b ? 6 : 1); break;
      case g: h = (b-r)/d + 3; break;
      case b: h = (r-g)/d + 5; break;
      default: h = 0;
    }
    h *= 60;
  }
  return { h, s, l };
}
function hslToHex(h,s,l) {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2*l - 1)) * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs(hh % 2 - 1));
  let r=0, g=0, b=0;
  if (0 <= hh && hh < 1) { r=c; g=x; }
  else if (1 <= hh && hh < 2) { r=x; g=c; }
  else if (2 <= hh && hh < 3) { g=c; b=x; }
  else if (3 <= hh && hh < 4) { g=x; b=c; }
  else if (4 <= hh && hh < 5) { r=x; b=c; }
  else if (5 <= hh && hh < 6) { r=c; b=x; }
  const m = l - c/2; r+=m; g+=m; b+=m;
  const to255 = (v) => Math.round(v*255);
  const hex = (n) => n.toString(16).padStart(2,"0");
  return "#" + hex(to255(r)) + hex(to255(g)) + hex(to255(b));
}
function hexToHsl(hex) { const { r,g,b } = hexToRgb(hex); return rgbToHsl(r,g,b); }
function lerp(a,b,t){ return a + (b-a) * clamp01(t); }
function lerpHsl(aHex, bHex, t){
  const a = hexToHsl(aHex), b = hexToHsl(bHex);
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = a.h + dh * clamp01(t);
  const s = lerp(a.s, b.s, t);
  const l = lerp(a.l, b.l, t);
  return hslToHex((h+360)%360, s, l);
}

function toNumericOrNull(x) {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const s = x.trim();
    if (!s) return null;
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/* -------------------------------------------------------------------------- */

export default function RuleStyler({ cy, anchorNode, nodeDetails, fetchMinMax }) {
  const [prop, setProp] = React.useState("");
  // Value range (defaults from DB; user-editable)
  const [vMin, setVMin] = React.useState("");
  const [vMax, setVMax] = React.useState("");
  // Colors for endpoints (user can change)
  const [cMin, setCMin] = React.useState("#fde68a"); // light (amber-200)
  const [cMax, setCMax] = React.useState("#ef4444"); // red-500

  // Size px for endpoints
  const [minPx, setMinPx] = React.useState(20);
  const [maxPx, setMaxPx] = React.useState(64);

  // Legend bucket count
  const [bucketCount, setBucketCount] = React.useState(5);

  const [status, setStatus] = React.useState("idle");
  const label = React.useMemo(() => (anchorNode ? getPrimaryLabelFromNode(anchorNode) : null), [anchorNode]);

  // All properties from details panel
  const allProps = React.useMemo(() => Object.keys(nodeDetails?.props || {}).sort(), [nodeDetails]);

  // Fetch DB min/max whenever label+property changes (read-only)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cy || !anchorNode || !label || !prop) { setStatus("idle"); return; }
      setStatus("loading");
      try {
        const { min, max } = await fetchMinMax(label, prop);
        if (cancelled) return;
        if (isNum(min) && isNum(max)) {
          setVMin(String(min));
          setVMax(String(max));
          setStatus("ready");
        } else {
          setVMin("");
          setVMax("");
          setStatus("non-numeric");
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [cy, anchorNode, label, prop, fetchMinMax]);

  const sameLabelNodes = React.useMemo(() => {
    if (!cy || !label) return [];
    return cy.nodes().filter(n => getPrimaryLabelFromNode(n) === label);
  }, [cy, label]);

  function valueFor(n) {
  const raw = n.data(nodePropKey(prop));
  const num = toNumericOrNull(raw);
  return num != null ? num : raw;
}


  function validRange() {
    const lo = Number(vMin), hi = Number(vMax);
    return isNum(lo) && isNum(hi) && hi >= lo;
  }

  /* --------------------------- Apply visual styles -------------------------- */
  function applyColorGradient() {
    if (!cy || !prop || !validRange()) return;

    // Save rule to cy.scratch and persist to localStorage
    const next = setActiveRule(cy, {
      label,
      prop,
      vMin,
      vMax,
      cMin,
      cMax,
      colorApplied: true, // don't change sizeApplied
    });
    applyActiveRule(cy);
    writeActiveStyleRule(next);
  }

  function applySizeScale() {
    if (!cy || !prop || !validRange()) return;

    const next = setActiveRule(cy, {
      label,
      prop,
      vMin,
      vMax,
      minPx,
      maxPx,
      sizeApplied: true, // don't change colorApplied
    });
    applyActiveRule(cy);
    writeActiveStyleRule(next);
  }

  function clearOverrides() {
    if (!cy) return;
    cy.batch(() => {
      sameLabelNodes.forEach(n => {
        n.removeStyle("background-color");
        n.removeStyle("width");
        n.removeStyle("height");
      });
    });
    // also forget saved rule so deletes don’t try to re-apply
    clearActiveRule(cy);
    writeActiveStyleRule(null);
  }
  /* ------------------------------------------------------------------------- */

  /* ---------------------------- Legend (buckets) ---------------------------- */
  const legend = React.useMemo(() => {
    if (!prop || status !== "ready" || !validRange() || !sameLabelNodes.length) return null;
    const lo = Number(vMin), hi = Number(vMax);
    const range = (hi - lo) || 1;
    const buckets = [];
    const counts = new Array(bucketCount).fill(0);
    const idBuckets = Array.from({ length: bucketCount }, () => []);

    for (let i = 0; i < bucketCount; i++) {
      const from = lo + (range / bucketCount) * i;
      const to   = i === bucketCount - 1 ? hi : lo + (range / bucketCount) * (i + 1);
      const tMid = ( (from + to) / 2 - lo ) / range;
      const color = lerpHsl(cMin, cMax, clamp01(tMid));
      buckets.push({ idx: i, from, to, color, count: 0, ids: [] });
    }

    let below = 0, above = 0, missing = 0;
    sameLabelNodes.forEach(n => {
      const f = toNumericOrNull(n.data(nodePropKey(prop)));
      if (!isNum(f)) { missing++; return; }
      if (f < lo) { below++; return; }
      if (f > hi) { above++; return; }
      let t = (f - lo) / range;
      let idx = Math.floor(t * bucketCount);
      if (idx >= bucketCount) idx = bucketCount - 1; // hi should land in last bucket
      counts[idx]++; idBuckets[idx].push(n.id());
    });

    for (let i = 0; i < bucketCount; i++) {
      buckets[i].count = counts[i];
      buckets[i].ids = idBuckets[i];
    }
    return { buckets, below, above, missing };
  }, [prop, status, vMin, vMax, cMin, cMax, bucketCount, sameLabelNodes]);

  /* ------------------------------------------------------------------------- */

  const numericReady = status === "ready" && validRange();

  return (
    <div style={{ borderTop: "1px solid #2c313c", paddingTop: 12, marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Rule-based styling</div>

      {/* 1) Property picker */}
      <label style={{ display: "block" }}>
        <div style={{ fontSize: 12, color: "#9aa3b2" }}>Property (from clicked node)</div>
        <select value={prop} onChange={(e)=>setProp(e.target.value)} style={{ width: "100%" }}>
          <option value="" disabled>Select a property…</option>
          {allProps.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>

      {/* 2) Range from DB (editable) */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#9aa3b2" }}>
        Label: <b>{label ?? "-"}</b> &nbsp; | &nbsp; Nodes in canvas: <b>{sameLabelNodes.length}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
        <label>Value min
          <input type="number" value={vMin} onChange={e=>setVMin(e.target.value)} placeholder={status==="ready" ? "" : "—"} />
        </label>
        <label>Value max
          <input type="number" value={vMax} onChange={e=>setVMax(e.target.value)} placeholder={status==="ready" ? "" : "—"} />
        </label>
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: "#9aa3b2" }}>
        {status==="loading" && "Fetching DB min/max…"}
        {status==="non-numeric" && "Selected property is not numeric in DB."}
        {status==="error" && "Failed to fetch min/max."}
      </div>

      {/* 3) Color gradient */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Color by value (within range)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>Min color <input type="color" value={cMin} onChange={e=>setCMin(e.target.value)} /></label>
          <label>Max color <input type="color" value={cMax} onChange={e=>setCMax(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={applyColorGradient} disabled={!numericReady}>Apply color gradient</button>
          <button onClick={clearOverrides}>Clear</button>
        </div>
      </div>

      {/* 4) Size scaling */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Size by value (within range)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>Min size (px) <input type="number" value={minPx} onChange={e=>setMinPx(Number(e.target.value) || 0)} /></label>
          <label>Max size (px) <input type="number" value={maxPx} onChange={e=>setMaxPx(Number(e.target.value) || 0)} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={applySizeScale} disabled={!numericReady}>Apply size scale</button>
          <button onClick={clearOverrides}>Clear</button>
        </div>
      </div>

      {/* 5) Legend */}
      {numericReady && legend && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>Legend</div>
            <label style={{ fontSize: 12, color: "#9aa3b2" }}>
              Buckets:&nbsp;
              <input
                type="number"
                min={2}
                max={12}
                value={bucketCount}
                onChange={(e)=>setBucketCount(Math.max(2, Math.min(12, Number(e.target.value)||5)))}
                style={{ width: 60 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 8, border: "1px solid #2c313c", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 64px", fontSize: 12, background: "#0b0f15" }}>
              <div style={{ padding: 8, borderRight: "1px solid #2c313c" }}>Color</div>
              <div style={{ padding: 8, borderRight: "1px solid #2c313c" }}>Value range</div>
              <div style={{ padding: 8, textAlign: "right" }}>Count</div>
            </div>
            {legend.buckets.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "48px 1fr 64px", borderTop: "1px solid #2c313c", fontSize: 12 }}>
                <div style={{ padding: 6, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, background: b.color, borderRadius: 6, border: "1px solid #2c313c" }} />
                </div>
                <div style={{ padding: "8px 8px" }}>
                  {b.from.toFixed(2)} – {b.to.toFixed(2)}
                </div>
                <div style={{ padding: "8px 8px", textAlign: "right" }}>
                  {b.count}
                </div>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 64px", borderTop: "1px solid #2c313c", fontSize: 12 }}>
              <div style={{ padding: 6, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ width: 22, height: 22, background: "#374151", borderRadius: 6, border: "1px solid #2c313c" }} />
              </div>
              <div style={{ padding: "8px 8px" }}>
                Below min / Above max / Missing
              </div>
              <div style={{ padding: "8px 8px", textAlign: "right" }}>
                {legend.below + legend.above + legend.missing}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
