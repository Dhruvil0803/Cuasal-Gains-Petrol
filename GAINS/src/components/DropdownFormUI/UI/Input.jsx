// src/components/DropdownFormUI/UI/Input.jsx
import React from "react";

/**
 * Labeled input supporting text/number/date/checkbox.
 * - Uses .field, .label, .input classes from ../ui.css
 */
export default function Input({
  id,
  label,
  type = "text",         // "text" | "number" | "date" | "checkbox"
  value,
  onChange,
  help,
  required = false,
  disabled = false,
  className = "",
  name,
  ...rest
}) {
  const inputId = id || `in_${Math.random().toString(36).slice(2, 8)}`;

  if (type === "checkbox") {
    return (
      <div className={`field ${className}`.trim()}>
        <label className="label" htmlFor={inputId}>
          {label} {required ? "*" : null}
        </label>
        <input
          id={inputId}
          name={name}
          className="input input--checkbox"
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange?.({ target: { name: name || inputId, type, checked: e.target.checked, value: e.target.checked } })}
          disabled={disabled}
          aria-required={required}
          {...rest}
        />
        {help ? <div className="help">{help}</div> : null}
      </div>
    );
  }

  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label className="label" htmlFor={inputId}>
          {label} {required ? "*" : null}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange?.({ target: { name: name || inputId, type, value: e.target.value } })}
        disabled={disabled}
        aria-required={required}
        {...rest}
      />
      {help ? <div className="help">{help}</div> : null}
    </div>
  );
}
