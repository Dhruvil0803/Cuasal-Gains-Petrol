import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

export default function GraphView({ graph }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements = [
      ...((graph?.nodes || []).map((n) => ({ data: { id: n.id, label: n.label } }))),
      ...((graph?.edges || []).map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.method ? `${e.method}${e.lag ? ` (lag ${e.lag})` : ""}` : "",
          weight: e.weight,
          p_value: e.p_value,
        },
      }))),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#2563eb",
            "border-color": "#1e40af",
            "border-width": 2,
            color: "#ffffff",
            "font-size": 13,
            "font-weight": "bold",
            width: 45,
            height: 45,
            "text-halign": "center",
            "text-valign": "center",
            padding: 10,
          },
        },
        {
          selector: "node.hover",
          style: {
            "background-color": "#1e40af",
            "border-width": 3,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "#cbd5e1",
            "target-arrow-color": "#cbd5e1",
            "target-arrow-fill": "filled",
            label: "data(label)",
            "font-size": 11,
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
            width: 2,
          },
        },
        {
          selector: "edge.hover",
          style: {
            "line-color": "#2563eb",
            "target-arrow-color": "#2563eb",
            width: 3,
          },
        },
      ],
      layout: { name: "cose", animate: true, animationDuration: 500 },
    });

    cyRef.current.on("mouseover", "node", (evt) => { evt.target.addClass("hover"); });
    cyRef.current.on("mouseout", "node", (evt) => { evt.target.removeClass("hover"); });
    cyRef.current.on("mouseover", "edge", (evt) => { evt.target.addClass("hover"); });
    cyRef.current.on("mouseout", "edge", (evt) => { evt.target.removeClass("hover"); });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(graph)]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 600, borderRadius: 12, backgroundColor: "#f8fafc" }}
      className="border border-gray-200"
    />
  );
}
