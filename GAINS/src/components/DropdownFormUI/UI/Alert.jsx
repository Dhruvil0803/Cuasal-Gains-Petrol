// src/components/DropdownFormUI/UI/Alert.jsx
import React from "react";

/**
 * Error/danger callout.
 * Classes: .alert
 */
export default function Alert({ children, className = "", role = "alert", ...rest }) {
  return (
    <div
      className={`alert ${className}`.trim()}
      role={role}
      aria-live="assertive"
      {...rest}
    >
      {children}
    </div>
  );
}
