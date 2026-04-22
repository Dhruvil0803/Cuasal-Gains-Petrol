// src/components/DropdownFormUI/views/AddRelTypeForm.jsx
import React, { useMemo, useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import Notice from "../UI/Notice";
import Alert from "../UI/Alert";
import { safeIdent } from "../utils";

/**
 * AddRelTypeForm
 * Local-only relationship type editor (Type + Source label + Target label + optional props).
 *
 * Props:
 *  - labelOptions: string[]                // list of available node labels (merged effective schema)
 *  - onSave: (type, srcLabel, dstLabel, properties[]) => void
 *  - message: { kind: "ok" | "error" | "", text: string }
 *  - setMessage: fn
 */
export default function AddRelTypeForm({ labelOptions = [], onSave, message, setMessage }) {
  const [rtType, setRtType] = useState("");
  const [rtSrc, setRtSrc] = useState("");
  const [rtDst, setRtDst] = useState("");
  const [rows, setRows] = useState([{ name: "", type: "string" }]);

  const typeOptions = useMemo(() => ["string", "number", "boolean", "date"], []);

  const handleAddRow = () => setRows((a) => [...a, { name: "", type: "string" }]);
  const handleRemoveRow = (i) => setRows((a) => a.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const t = safeIdent(rtType);
    const src = safeIdent(rtSrc);
    const dst = safeIdent(rtDst);
    const properties = rows
      .map((r) => ({ name: safeIdent(r.name), type: r.type }))
      .filter((r) => r.name);

    if (!t || !src || !dst) {
      setMessage?.({ kind: "error", text: "Please provide Type, Source label, and Target label." });
      return;
    }

    try {
      onSave?.(t, src, dst, properties);
      setMessage?.({
        kind: "ok",
        text:
          `Saved relationship type “${t}” (${src} → ${dst}) locally` +
          (properties.length ? ` with ${properties.length} propert${properties.length > 1 ? "ies" : "y"}.` : "."),
      });
      setRtType("");
      setRtSrc("");
      setRtDst("");
      setRows([{ name: "", type: "string" }]);
    } catch (e) {
      setMessage?.({ kind: "error", text: e?.message || String(e) });
    }
  };

  return (
    <>
      <div className="context">
        <h4>Relationship</h4>
        <div className="selector-grid wide">
          <Input
            id="rtType"
            label="Type"
            placeholder="e.g. WORKS_AT"
            value={rtType}
            onChange={(e) => setRtType(e.target.value)}
            required
            help={<>Will be stored locally as <span className="pill">{safeIdent(rtType || "TYPE")}</span></>}
          />
          <Select
            id="rtSrc"
            label="Source label"
            value={rtSrc}
            onChange={(e) => setRtSrc(e.target.value)}
            required
          >
            <option value="">— Select —</option>
            {labelOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
          <Select
            id="rtDst"
            label="Target label"
            value={rtDst}
            onChange={(e) => setRtDst(e.target.value)}
            required
          >
            <option value="">— Select —</option>
            {labelOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="help">Records an allowed <strong>Label A → Label B</strong> pair for your local relationship type list. No DB writes.</div>
      </div>

      <div className="context">
        <h4>Relationship Properties (optional)</h4>
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
            <Button variant="ghost" onClick={() => handleRemoveRow(i)}>✕</Button>
          </div>
        ))}
        <Button variant="ghost" onClick={handleAddRow}>+ Add property</Button>
        <div className="help" style={{ marginTop: 8 }}>
          <code>createdAt</code> is always added automatically when you create a relationship instance.
        </div>
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
          Save Relationship Type
        </Button>
      </div>
    </>
  );
}
