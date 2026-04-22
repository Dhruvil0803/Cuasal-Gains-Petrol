// src/components/DropdownFormUI/UI/Field.jsx
import React, { useCallback } from "react";
import Input from "./Input";
import Textarea from "./Textarea";

/**
 * Memoized field renderer that mirrors the original Field logic:
 * - Supports text/number/date/checkbox/textarea
 * - Emits onFieldChange(name, value)
 */
function FieldImpl({ nodeId, field, value, onFieldChange }) {
  const id = `${nodeId || "f"}_${field.name}`;

  const handleChange = useCallback(
    (e) => {
      const { type, value: raw, checked, name } = e.target;
      const next = type === "checkbox" ? checked : raw;
      onFieldChange?.(name, next);
    },
    [onFieldChange]
  );

  if (field.type === "textarea") {
    return (
      <Textarea
        id={id}
        name={field.name}
        label={`${field.label} *`}
        value={value}
        onChange={handleChange}
        required
      />
    );
  }

  const inputType =
    field.type === "number" ? "number" :
    field.type === "date"   ? "date"   :
    field.type === "checkbox" ? "checkbox" : "text";

  return (
    <Input
      id={id}
      name={field.name}
      label={`${field.label} *`}
      type={inputType}
      value={inputType === "checkbox" ? !!value : value}
      onChange={handleChange}
      required
    />
  );
}

const Field = React.memo(
  FieldImpl,
  (p, n) =>
    p.nodeId === n.nodeId &&
    p.field.name === n.field.name &&
    p.field.type === n.field.type &&
    p.value === n.value &&
    p.onFieldChange === n.onFieldChange
);

export default Field;
