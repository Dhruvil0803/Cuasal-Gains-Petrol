// src/components/DropdownFormUI/UI/Select.jsx
import React from "react";

/**
 * Labeled select input.
 * - Uses .field, .label, .select classes from ../ui.css
 */
export default function Select({
  id,
  label,
  help,
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  className = "",
  ...rest
}) {
  const selectId = id || `sel_${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label className="label" htmlFor={selectId}>
          {label} {required ? "*" : null}
        </label>
      )}
      <select
        id={selectId}
        className="select"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-required={required}
        {...rest}
      >
        {children}
      </select>
      {help ? <div className="help">{help}</div> : null}
    </div>
  );
}
