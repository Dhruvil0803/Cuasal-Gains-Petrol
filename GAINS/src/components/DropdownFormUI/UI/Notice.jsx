// src/components/DropdownFormUI/UI/Notice.jsx
import React from "react";

/**
 * Positive/informational callout.
 * Classes: .notice
 */
export default function Notice({ children, className = "", role = "status", ...rest }) {
  return (
    <div
      className={`notice ${className}`.trim()}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      {...rest}
    >
      {children}
    </div>
  );
}
