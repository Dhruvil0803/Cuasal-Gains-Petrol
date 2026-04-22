// src/components/DropdownFormUI/UI/Tabs.jsx
import React from "react";

/**
 * Simple tab buttons used in the card header.
 * Uses .tabs-inline styles from ../ui.css
 */
export default function Tabs({ items = [], active, onChange, className = "" }) {
  return (
    <div className={`tabs-inline ${className}`.trim()}>
      {items.map((it) => (
        <button
          key={it.key}
          className={active === it.key ? "active" : ""}
          onClick={() => onChange?.(it.key)}
          type="button"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
