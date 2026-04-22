import React from "react";
import { createRoot } from "react-dom/client";
import GraphBloomClone from "./GraphBloomClone";

/** Open a popup and mount GraphBloomClone with an optional snapshot */
export function openBloomWindow({
  snapshot = null,
  width = 1500,
  height = 950,
  name = "GraphBloomCloneWindow",
  title = "Bloom Explorer"
} = {}) {
  const sx = window.screenLeft ?? window.screenX ?? 0;
  const sy = window.screenTop ?? window.screenY ?? 0;
  const left = sx + Math.max(0, (window.outerWidth  - width)  / 2);
  const top  = sy + Math.max(0, (window.outerHeight - height) / 2);

  const features = [
    "popup=yes","resizable=yes","scrollbars=yes",
    `width=${width}`, `height=${height}`,
    `left=${Math.floor(left)}`, `top=${Math.floor(top)}`
  ].join(",");

  const win = window.open("", name, features);
  if (!win) { alert("Popup blocked. Please allow popups for this site."); return null; }

  // Write a full page so layout sizing is correct
  win.document.open();
  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, #__popup_root { height: 100%; }
      html, body { margin:0; background:#0b0e14; color:#e5e7eb; }
      * { box-sizing: border-box; }
      #__popup_root { display:flex; min-height:0; }
      #__popup_root > * { flex:1; min-height:0; min-width:0; }
      #__popup_root .boot { font:14px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; padding:12px; }
    </style>
  </head>
  <body>
    <div id="__popup_root"><div class="boot">Loading graph…</div></div>
  </body>
</html>`);
  win.document.close();

  // Stash the snapshot on the popup (same-origin) so we can read it
  win.__GRAPH_SNAPSHOT__ = snapshot || null;

  const mount = () => {
    const container = win.document.getElementById("__popup_root");
    const root = createRoot(container);
    root.render(<GraphBloomClone initialSnapshot={win.__GRAPH_SNAPSHOT__} />);

    // Kick a few resizes so Cytoscape measures correctly
    const pump = () => win.dispatchEvent(new Event("resize"));
    setTimeout(pump, 0);
    setTimeout(pump, 60);
    setTimeout(pump, 150);
    setTimeout(pump, 300);

    win.addEventListener("focus", pump);
    win.focus();
  };

  if (win.document.readyState === "complete" || win.document.readyState === "interactive") {
    mount();
  } else {
    win.addEventListener("load", mount, { once: true });
  }
  return win;
}

/** Small button that grabs a live snapshot and opens the popup */
export function GraphBloomOpenButton({ label = "Open Graph in New Window", width, height, windowName }) {
  const onClick = () => {
    const snap = window.__GB_API?.exportSnapshot?.() || null;   // <-- from GraphBloomClone
    openBloomWindow({ snapshot: snap, width, height, name: windowName, title: "Bloom Explorer" });
  };
  return (
    <button
      onClick={onClick}
      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #1f2937",
               background:"#111827", color:"#e5e7eb", fontWeight:800, cursor:"pointer" }}
      title="Open the same graph in a separate window"
    >
      {label}
    </button>
  );
}
