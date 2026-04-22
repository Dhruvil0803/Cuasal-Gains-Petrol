// src/components/DropdownFormUI/views/AddLabelForm.jsx
import React, { useMemo, useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import Notice from "../UI/Notice";
import Alert from "../UI/Alert";
import { safeIdent } from "../utils";

/**
 * AddLabelForm
 * Local-only node label schema editor.
 *
 * Props:
 *  - onSave: (label: string, properties: Array<{name,type}>) => void
 *  - message: { kind: "ok" | "error" | "", text: string }
 *  - setMessage: fn
 */
export default function AddLabelForm({ onSave, message, setMessage }) {
  const [newLabel, setNewLabel] = useState("");
  const [rows, setRows] = useState([{ name: "", type: "string" }]);

  const typeOptions = useMemo(() => ["string", "number", "boolean", "date"], []);

  const handleAddRow = () => setRows((a) => [...a, { name: "", type: "string" }]);
  const handleRemoveRow = (i) => setRows((a) => a.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const label = safeIdent(newLabel);
    const properties = rows
      .map((r) => ({ name: safeIdent(r.name), type: r.type }))
      .filter((r) => r.name);

    if (!label || properties.length === 0) {
      setMessage?.({ kind: "error", text: "Please provide a label and at least one property." });
      return;
    }

    try {
      onSave?.(label, properties);
      setMessage?.({
        kind: "ok",
        text: `Saved label “${label}” with ${properties.length} propert${properties.length > 1 ? "ies" : "y"} (local only).`,
      });
      setNewLabel("");
      setRows([{ name: "", type: "string" }]);
    } catch (e) {
      setMessage?.({ kind: "error", text: e?.message || String(e) });
    }
  };

  return (
    <>
      <div className="context">
        <h4>Label</h4>
        <Input
          id="newLabel"
          label="Node label"
          placeholder="e.g. DEMO_LABEL"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          required
          help={
            <>
              Will be kept locally as{" "}
              <span className="pill">{safeIdent(newLabel || "Label")}</span>. No database writes.
            </>
          }
        />
      </div>

      <div className="context">
        <h4>Properties</h4>
        <div className="prop-grid" style={{ marginBottom: 8 }}>
          <div className="label">Name</div>
          <div className="label">Type</div>
          <div />
        </div>

        {rows.map((row, i) => (
          <div className="prop-grid" key={i}>
            <Input
              placeholder="propertyName"
              value={row.name}
              onChange={(e) =>
                setRows((arr) =>
                  arr.map((r, idx) => (idx === i ? { ...r, name: safeIdent(e.target.value) } : r))
                )
              }
            />
            <Select
              value={row.type}
              onChange={(e) =>
                setRows((arr) =>
                  arr.map((r, idx) => (idx === i ? { ...r, type: e.target.value } : r))
                )
              }
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Button variant="ghost" onClick={() => handleRemoveRow(i)}>
              ✕
            </Button>
          </div>
        ))}
        <Button variant="ghost" onClick={handleAddRow}>
          + Add property
        </Button>
      </div>

      {message?.text ? (
        message.kind === "error" ? (
          <Alert style={{ marginTop: 8 }}>{message.text}</Alert>
        ) : (
          <Notice style={{ marginTop: 8 }}>{message.text}</Notice>
        )
      ) : null}

      <div className="actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={handleSave}>
          Save Node Label
        </Button>
      </div>
    </>
  );
}
