// src/components/DropdownFormUI/UI/Textarea.jsx
import React from "react";

/**
 * Labeled textarea.
 * - Uses .field, .label, .textarea classes from ../ui.css
 */
export default function Textarea({
  id,
  label,
  value,
  onChange,
  help,
  required = false,
  disabled = false,
  className = "",
  name,
  rows = 6,
  ...rest
}) {
  const taId = id || `ta_${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label className="label" htmlFor={taId}>
          {label} {required ? "*" : null}
        </label>
      )}
      <textarea
        id={taId}
        name={name}
        className="textarea"
        value={value}
        onChange={(e) => onChange?.({ target: { name: name || taId, type: "textarea", value: e.target.value } })}
        disabled={disabled}
        aria-required={required}
        rows={rows}
        {...rest}
      />
      {help ? <div className="help">{help}</div> : null}
    </div>
  );
}
