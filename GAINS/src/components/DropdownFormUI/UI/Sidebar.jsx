// src/components/DropdownFormUI/UI/Sidebar.jsx
import React from "react";

/**
 * Vertical sidebar with titled blocks.
 * Uses classes from ../ui.css: .sidebar, .side-block, .side-title
 */
export default function Sidebar({ children, className = "" }) {
  return <aside className={`sidebar ${className}`.trim()}>{children}</aside>;
}

// Helper subcomponents for consistency
export function SideBlock({ title, children }) {
  return (
    <div className="side-block">
      {title ? <div className="side-title">{title}</div> : null}
      {children}
    </div>
  );
}
