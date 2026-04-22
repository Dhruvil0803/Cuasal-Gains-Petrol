// src/components/DropdownFormUI/UI/Button.jsx
import React from "react";

/**
 * Small, reusable button with variants and loading state.
 * Styling comes from `../ui.css` via the classes below.
 */
export default function Button({
  children,
  variant = "primary", // "primary" | "ghost"
  size = "md",          // "sm" | "md"
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  ...rest
}) {
  const classes = [
    "btn",
    variant === "primary" ? "btn--primary" : "btn--ghost",
    size === "sm" ? "btn--sm" : "btn--md",
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : "false"}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span className="btn__label">{children}</span>
    </button>
  );
}
