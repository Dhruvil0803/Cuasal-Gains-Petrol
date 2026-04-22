// // src/components/GraphBloomClone/ruleStylingRuntime.js
// // Stores & re-applies the last rule-based styling (color/size) on cy.scratch().
// // Purely visual; never touches DB.

// import { nodePropKey } from "./helper.js";

// function getPrimaryLabelFromNode(n) {
//   const labels = n?.data("_labels");
//   return Array.isArray(labels) && labels.length ? labels[0] : null;
// }
// const isNum = (x) => typeof x === "number" && Number.isFinite(x);
// const clamp01 = (x) => Math.max(0, Math.min(1, x));

// function hexToRgb(hex) {
//   const s = String(hex || "").replace("#", "");
//   const n = parseInt(s.length === 3 ? s.split("").map(c=>c+c).join("") : s, 16);
//   if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
//   return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
// }
// function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const m=Math.max(r,g,b),n=Math.min(r,g,b);let h,s,l=(m+n)/2;if(m===n){h=s=0}else{const d=m-n;s=l>.5?d/(2-m-n):d/(m+n);switch(m){case r:h=(g-b)/d+(g<b?6:1);break;case g:h=(b-r)/d+3;break;case b:h=(r-g)/d+5;break;default:h=0}h*=60}return{h,s,l}}
// function hslToHex(h,s,l){s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));const c=(1-Math.abs(2*l-1))*s,hh=(h%360)/60,x=c*(1-Math.abs(hh%2-1));let r=0,g=0,b=0;if(0<=hh&&hh<1){r=c;g=x}else if(1<=hh&&hh<2){r=x;g=c}else if(2<=hh&&hh<3){g=c;b=x}else if(3<=hh&&hh<4){g=x;b=c}else if(4<=hh&&hh<5){r=x;b=c}else if(5<=hh&&hh<6){r=c;b=x}const m=l-c/2;r+=m;g+=m;b+=m;const p=v=>Math.round(v*255),hx=n=>n.toString(16).padStart(2,"0");return"#"+hx(p(r))+hx(p(g))+hx(p(b))}
// function hexToHsl(hex){const {r,g,b}=hexToRgb(hex);return rgbToHsl(r,g,b)}
// function lerp(a,b,t){return a+(b-a)*clamp01(t)}
// function lerpHsl(aHex,bHex,t){const a=hexToHsl(aHex),b=hexToHsl(bHex);let dh=b.h-a.h;if(dh>180)dh-=360;if(dh<-180)dh+=360;const h=a.h+dh*clamp01(t),s=lerp(a.s,b.s,t),l=lerp(a.l,b.l,t);return hslToHex((h+360)%360,s,l)}

// const SCRATCH_KEY = "_ruleStyling";

// export function getActiveRule(cy) {
//   if (!cy) return null;
//   return cy.scratch(SCRATCH_KEY) || null;
// }

// export function setActiveRule(cy, patch) {
//   if (!cy) return;
//   const prev = getActiveRule(cy) || {};
//   const next = { ...prev, ...patch };
//   cy.scratch(SCRATCH_KEY, next);
//   return next;
// }

// export function clearActiveRule(cy) {
//   if (!cy) return;
//   cy.scratch(SCRATCH_KEY, null);
// }

// // Re-apply the saved rule to current canvas (uses same fixed min/max).
// export function applyActiveRule(cy) {
//   if (!cy) return;
//   const rule = getActiveRule(cy);
//   if (!rule) return;

//   const {
//     label, prop,
//     vMin, vMax,
//     cMin = "#fde68a", cMax = "#ef4444",
//     minPx = 20, maxPx = 64,
//     colorApplied = false,
//     sizeApplied = false
//   } = rule;

//   if (!label || !prop) return;

//   const nodes = cy.nodes().filter(n => getPrimaryLabelFromNode(n) === label);
//   if (!nodes.length) return;

//   const lo = Number(vMin), hi = Number(vMax);
//   const hasRange = isNum(lo) && isNum(hi) && hi >= lo;
//   const fallbackColor = "#374151";
//   const fallbackPx = 18;

//   cy.batch(() => {
//     nodes.forEach(n => {
//       const f = Number(n.data(nodePropKey(prop)));

//       if (colorApplied && hasRange) {
//         if (!isNum(f) || f < lo || f > hi) {
//           n.style("background-color", fallbackColor);
//         } else {
//           const t = Math.max(0, Math.min(1, (f - lo) / (hi - lo || 1)));
//           n.style("background-color", lerpHsl(cMin, cMax, t));
//         }
//       }

//       if (sizeApplied && hasRange) {
//         if (!isNum(f) || f < lo || f > hi) {
//           n.style("width", fallbackPx); n.style("height", fallbackPx);
//         } else {
//           const t = Math.max(0, Math.min(1, (f - lo) / (hi - lo || 1)));
//           const px = Number(minPx) + t * (Number(maxPx) - Number(minPx));
//           n.style("width", px); n.style("height", px);
//         }
//       }
//     });
//   });
// }

// // Re-run current layout and fit. If you track a layoutName, pass it; else 'cose'.
// export function rerunLayoutAndFit(cy, layoutName = "cose") {
//   if (!cy) return;
//   const presets = {
//     cose: { name: "cose", animate: "end", fit: false },
//     breadthfirst: { name: "breadthfirst", fit: false, spacingFactor: 1.2 },
//     concentric: { name: "concentric", fit: false },
//     circle: { name: "circle", fit: false },
//     grid: { name: "grid", fit: false },
//   };
//   const options = presets[layoutName] || presets.cose;
//   cy.layout(options).run();
//   cy.fit(undefined, 50);
// }
// src/components/GraphBloomClone/ruleStylingRuntime.js

// /src/components/GraphBloomClone/ruleStylingRuntime.js
import { nodePropKey } from "./helper.js";

// Internal scratch key for persisting current styling rule
const SCRATCH_KEY = "_ruleStyling";

// Color helpers used when applying gradient coloring
function hexToRgb(hex) {
  const s = String(hex || "").replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}
function hslToHex(h, s, l) {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (0 <= hh && hh < 1) { r = c; g = x; }
  else if (1 <= hh && hh < 2) { r = x; g = c; }
  else if (2 <= hh && hh < 3) { g = c; b = x; }
  else if (3 <= hh && hh < 4) { g = x; b = c; }
  else if (4 <= hh && hh < 5) { r = x; b = c; }
  else if (5 <= hh && hh < 6) { r = c; b = x; }
  const m = l - c / 2; r += m; g += m; b += m;
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function lerpHsl(aHex, bHex, t) {
  const a = rgbToHsl(...Object.values(hexToRgb(aHex)));
  const b = rgbToHsl(...Object.values(hexToRgb(bHex)));
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const h = (a.h + dh * Math.max(0, Math.min(1, t)) + 360) % 360;
  const s = lerp(a.s, b.s, t);
  const l = lerp(a.l, b.l, t);
  return hslToHex(h, s, l);
}

// Public getters/setters for the active rule
export function getActiveRule(cy) {
  if (!cy) return null;
  return cy.scratch(SCRATCH_KEY) || null;
}
export function setActiveRule(cy, patch) {
  if (!cy) return undefined;
  const prev = getActiveRule(cy) || {};
  const next = { ...prev, ...patch };
  cy.scratch(SCRATCH_KEY, next);
  return next;
}
export function clearActiveRule(cy) {
  if (!cy) return;
  cy.scratch(SCRATCH_KEY, null);
}

/* Keep the active rule in cy.scratch so we can re-apply after layout/theme */
export function applyActiveRule(cy) {
  if (!cy) return;
  const rule = getActiveRule(cy);
  if (!rule || !rule.label || !rule.prop) return;

  const lo = Number(rule.vMin), hi = Number(rule.vMax);
  const hasRange = Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo;

  // build collection for the chosen label
  const sameLabel = rule.label
    ? cy.nodes().filter((n) => {
        const d = n.data() || {};
        const arr = Array.isArray(d._labels)
          ? d._labels
          : Array.isArray(d.labels)
          ? d.labels
          : null;
        const primary =
          arr && arr.length ? arr[0] : typeof d.label === "string" ? d.label : null;
        return primary === rule.label;
      })
    : cy.nodes();

  const k = nodePropKey(rule.prop); // ✅ use the rule's prop key

  cy.batch(() => {
    sameLabel.forEach((n) => {
      const raw = n.data(k);

      // robust numeric coercion (handles "100,000")
      let f = null;
      if (raw == null) {
        f = null;
      } else if (typeof raw === "number") {
        f = Number.isFinite(raw) ? raw : null;
      } else if (typeof raw === "string") {
        const s = raw.trim();
        f = s ? parseFloat(s.replace(/,/g, "")) : null;
        if (Number.isNaN(f)) f = null;
      } else {
        f = null;
      }

      // reset parts we manage unless explicitly applied
      if (!rule.colorApplied) {
        n.removeStyle("background-color");
        n.removeStyle("border-color");
      }
      if (!rule.sizeApplied) {
        n.removeStyle("width");
        n.removeStyle("height");
      }

      if (!hasRange || !Number.isFinite(f)) return; // ✅ use f
      const t = Math.max(0, Math.min(1, (f - lo) / (hi - lo))); // ✅ use f

      if (rule.colorApplied && rule.cMin && rule.cMax) {
        const color = lerpHsl(rule.cMin, rule.cMax, t);
        n.style("background-color", color);
        n.style("border-color", color);
      }
      if (rule.sizeApplied && Number.isFinite(rule.minPx) && Number.isFinite(rule.maxPx)) {
        const px = rule.minPx + (rule.maxPx - rule.minPx) * t;
        n.style("width", px);
        n.style("height", px);
      }
    });
  });

  // let the browser paint
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {});
}

// Layout helper used by the canvas to re-run layout and refit view
export function rerunLayoutAndFit(cy, layoutName = "cose") {
  if (!cy) return;
  const presets = {
    cose: { name: "cose", animate: "end", fit: false },
    breadthfirst: { name: "breadthfirst", fit: false, spacingFactor: 1.2 },
    concentric: { name: "concentric", fit: false },
    circle: { name: "circle", fit: false },
    grid: { name: "grid", fit: false },
  };
  const options = presets[layoutName] || presets.cose;
  cy.layout(options).run();
  cy.fit(undefined, 50);
}
