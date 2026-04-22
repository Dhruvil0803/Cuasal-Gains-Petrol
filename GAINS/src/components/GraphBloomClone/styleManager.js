// src/components/GraphBloomClone/styleManager.js
import { FONT_SIZE, TEXT_MAX_PX } from "./helper.js";

/**
 * Base Cytoscape stylesheet (parent passes to GraphCanvas & CompareCanvas).
 * Order matters: base node -> data-driven override -> selected -> edges.
 */
export const baseStylesheet = [
  {
    selector: "node",
    style: {
      width: "data(size)",
      height: "data(size)",
      "background-color": "#f0a3db",
"border-width": 4,
"border-color": "#2c313c",
      label: "data(label)",
      color: "#ffffff",
      "font-size": FONT_SIZE,
      "font-weight": 700,
      "text-wrap": "wrap",
      "text-max-width": TEXT_MAX_PX,
      "text-halign": "center",
      "text-valign": "center",
      "text-outline-color": "#2a2d35",
      "text-outline-width": 3,
      "min-zoomed-font-size": 6,
      "z-index-compare": "manual",
      "z-index": 10,
    },
  },

  // Use per-node color if present (bgColor is a string, so use [bgColor], not [?bgColor])
{
  selector: "node[bgColor]",
  style: {
    "background-color": "data(bgColor)"
  },
},

  {
    selector: "node:selected",
    style: { "border-color": "#F47920", "border-width": 7, "z-index": 12 },
  },

  {
    selector: "edge",
    style: {
      width: 2,
      "curve-style": "bezier",
      "line-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#94a3b8",
      label: "data(type)",
      color: "#9aa3b2",
      "font-size": 9,
      "text-rotation": "autorotate",
      "text-background-color": "#2a2d35",
      "text-background-opacity": 0.9,
      "text-background-shape": "round-rectangle",
      "text-background-padding": 2,
      "z-index-compare": "manual",
      "z-index": 9,
    },
  },

  {
    selector: "edge:selected",
    style: { "line-color": "#ffd166", "target-arrow-color": "#ffd166", width: 2.8 },
  },
];
