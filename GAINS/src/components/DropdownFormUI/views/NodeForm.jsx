// src/components/DropdownFormUI/views/NodeForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Field from "../UI/Field";
import Notice from "../UI/Notice";
import Alert from "../UI/Alert";
import Button from "../UI/Button";
import Select from "../UI/Select";
import Modal from "../UI/Modal";

/**
 * NodeForm
 * Mirrors original node entry logic:
 * - All fields required
 * - Checkbox must be true to pass validation (same as original)
 * - Optional duplicate check based on selected key field
 * - If duplicate found, user can update existing local node
 *
 * Props:
 *  - node: { id, title, fields: [{name,label,type,required:true}] } | null
 *  - uniqueKeys: Set<string> (auto-suggested key field); may be empty
 *  - findDuplicateNode(label, keyField, keyValue) -> node | null
 *  - createLocalNode(label, propsObj) -> {id,...}
 *  - updateLocalNodeById(id, propsObj) -> void
 *  - onSaved?: (node) => void
 */
export default function NodeForm({
  node,
  uniqueKeys = new Set(),
  findDuplicateNode,
  createLocalNode,
  updateLocalNodeById,
  onSaved,
}) {
  const label = node?.id || "";
  const fields = node?.fields || [];

  // ----- form state -----
  const makeInitial = useCallback(() => {
    const init = {};
    for (const f of fields) init[f.name] = f.type === "checkbox" ? false : "";
    return init;
  }, [fields]);

  const [values, setValues] = useState(makeInitial);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");

  // chosen duplicate-check field (local-only)
  const [keyField, setKeyField] = useState("");

  useEffect(() => {
    setValues(makeInitial());
    setSubmitted(false);
    setSaveError("");
    setKeyField(""); // reset on node change
  }, [node, makeInitial]);

  // auto-pick first DB unique key if available
  useEffect(() => {
    if (!label || keyField) return;
    const first = uniqueKeys && uniqueKeys.size ? [...uniqueKeys][0] : "";
    if (first) setKeyField(first);
  }, [label, uniqueKeys, keyField]);

  // ----- validation (all fields required; checkbox must be true) -----
  const isValid = useMemo(() => {
    if (!node) return false;
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "checkbox") {
        if (!v) return false;
      } else {
        const str = String(v ?? "");
        if (str.trim() === "") return false;
        if (f.type === "number") {
          const n = Number(str);
          if (Number.isNaN(n)) return false;
        }
      }
    }
    return true;
  }, [node, fields, values]);

  // build props object with correct types
  const buildPropsObject = useCallback(() => {
    const props = {};
    for (const f of fields) {
      let v = values[f.name];
      if (f.type === "number") {
        const n = Number(String(v).trim());
        v = Number.isNaN(n) ? null : n;
      } else if (f.type === "checkbox") {
        v = !!v;
      } else if (f.type === "date") {
        v = String(v);
      } else {
        v = String(v);
      }
      props[f.name] = v;
    }
    return props;
  }, [fields, values]);

  const onFieldChange = useCallback((name, nextValue) => {
    setValues((prev) => ({ ...prev, [name]: nextValue }));
  }, []);

  const handleReset = () => {
    setValues(makeInitial());
    setSubmitted(false);
    setSaveError("");
  };

  // ----- duplicate modal -----
  const [dupOpen, setDupOpen] = useState(false);
  const [dupInfo, setDupInfo] = useState(null); // { localId, keyField, keyValue }

  const confirmUpdateExisting = async () => {
    if (!dupInfo || !label) return;
    try {
      setSaving(true);
      setSaveError("");
      const props = buildPropsObject();
      updateLocalNodeById(dupInfo.localId, props);
      setSubmitted(true);
      setDupOpen(false);
      setDupInfo(null);
      onSaved?.({ id: dupInfo.localId, label, props });
    } catch (e) {
      setSaveError(e?.message || String(e));
      setDupOpen(false);
      setDupInfo(null);
    } finally {
      setSaving(false);
    }
  };

  // ----- save -----
  const handleSave = async () => {
    if (!node || !isValid) return;

    setSaving(true);
    setSaveError("");
    setSubmitted(false);

    const props = buildPropsObject();

    try {
      // local duplicate check by chosen key
      if (keyField && props[keyField] !== undefined && String(props[keyField]).trim() !== "") {
        const existing = findDuplicateNode(label, keyField, props[keyField]);
        if (existing) {
          setDupInfo({ localId: existing.id, keyField, keyValue: props[keyField] });
          setDupOpen(true);
          setSaving(false);
          return;
        }
      }

      const newNode = createLocalNode(label, props);
      setSubmitted(true);
      onSaved?.(newNode);
    } catch (e) {
      setSaveError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!node) {
    return <div className="placeholder">Pick a node label from the left to start.</div>;
  }

  return (
    <>
      {/* Duplicate Check (local) */}
      <div className="context" style={{ marginBottom: 18 }}>
        <h4>Duplicate Check (Local)</h4>
        <Select
          label="Field to check existing node"
          value={keyField}
          onChange={(e) => setKeyField(e.target.value)}
          help="Checks duplicates only in your local nodes for this label."
        >
          <option value="">— None (always create new) —</option>
          {fields.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </Select>
      </div>

      {/* Form */}
      <div className="form-grid wide">
        <div>
          {fields.map((f) => (
            <Field
              key={f.name}
              nodeId={label}
              field={f}
              value={values[f.name]}
              onFieldChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      {saveError && <Alert>{saveError}</Alert>}
      {submitted && isValid && (
        <Notice style={{ marginTop: 12 }}>
          <strong>{node.title} saved locally!</strong>
        </Notice>
      )}

      {/* Actions */}
      <div className="actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={handleSave} disabled={!isValid} loading={saving}>
          Save Locally
        </Button>
        <Button variant="ghost" onClick={handleReset} disabled={saving}>
          Reset
        </Button>
      </div>

      {/* Duplicate decision modal */}
      <Modal
        open={dupOpen && !!dupInfo}
        title="Duplicate Found (Local)"
        onClose={() => { setDupOpen(false); setDupInfo(null); }}
        secondaryAction={{
          label: "Keep Same (Cancel)",
          onClick: () => { setDupOpen(false); setDupInfo(null); },
        }}
        primaryAction={{
          label: "Update Existing",
          onClick: confirmUpdateExisting,
          loading: saving,
        }}
      >
        {dupInfo ? (
          <>
            A <strong>{label}</strong> already exists locally with{" "}
            <code>{dupInfo.keyField}</code> = <code>{String(dupInfo.keyValue)}</code>.
            <br />
            Do you want to <strong>update</strong> that existing local node with your current form values,
            or <strong>keep the same</strong> (cancel, no changes)?
          </>
        ) : null}
      </Modal>
    </>
  );
}
