// src/components/GraphBloomClone/HudPanel.jsx
import React from "react";
import { HUD_SWATCHES, HUD_SIZES } from "./helper.js";

export default function HudPanel({
  hudCat,
  hudProps,
  hudCaption,
  setHudCat,
  setHudCaption,
  setQuickStyleForCategory,
  setCaptionForCategorySingle,
}) {
  return (
    <div style={{ padding: "10px 12px", borderBottom: "1px solid #2c313c" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#cbd5e1" }}>
          Style “{hudCat}”
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setHudCat(null)}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #2c313c",
            background: "#0f1116",
            color: "#e5e7eb",
          }}
        >
          Hide
        </button>
      </div>

      {/* Colors */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: "#9aa3b2", marginBottom: 6 }}>Color</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {HUD_SWATCHES.map((c, i) => (
            <button
              key={i}
              onClick={() => setQuickStyleForCategory(hudCat, { "background-color": c })}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "2px solid #2c313c",
                background: c,
                cursor: "pointer",
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#9aa3b2", marginBottom: 6 }}>Size</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {HUD_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setQuickStyleForCategory(hudCat, { width: s, height: s })}
              style={{
                width: s / 3.2,
                height: s / 3.2,
                borderRadius: "50%",
                border: "2px solid #2c313c",
                background: "#15171d",
                cursor: "pointer",
              }}
              title={`${s}px`}
            />
          ))}
        </div>
      </div>

      {/* Caption (SINGLE SELECT) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#9aa3b2", marginBottom: 6 }}>Caption</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const next = hudCaption === "<id>" ? null : "<id>";
              setHudCaption(next);
              setCaptionForCategorySingle(hudCat, next);
            }}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #2c313c",
              background: hudCaption === "<id>" ? "#1e293b" : "#0f1116",
              color: hudCaption === "<id>" ? "#FBCFA4" : "#e5e7eb",
            }}
          >
            &lt;id&gt;
          </button>

          {hudProps.slice(0, 40).map((p) => {
            const on = hudCaption === p;
            return (
              <button
                key={p}
                onClick={() => {
                  const next = on ? null : p;
                  setHudCaption(next);
                  setCaptionForCategorySingle(hudCat, next);
                }}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #2c313c",
                  background: on ? "#1e293b" : "#0f1116",
                  color: on ? "#FBCFA4" : "#e5e7eb",
                }}
                title={p}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
