// src/components/DropdownFormUI/views/RelationshipForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Select from "../UI/Select";
import Field from "../UI/Field";
import Notice from "../UI/Notice";
import Alert from "../UI/Alert";
import Button from "../UI/Button";

/**
 * RelationshipForm
 * Mirrors original relationship mode logic:
 * - Choose relationship type's (Source, Target) label pair
 * - Load instances for each label (DB read-only + local)
 * - Optional relationship properties (from local rel-type schema)
 * - Create relationship locally (no DB writes)
 *
 * Props:
 *  - relType: string (selected relationship type)
 *  - relPairs: Array<{src:string, dst:string}> (allowed label pairs for the type)
 *  - relTypePropsMap: Map<string, Record<propName, type>> (from useLocalGraph)
 *  - localNodes: Array<{id, label, props}>
 *  - fetchDbInstancesForLabel: async (label:string, limit?:number) => [{id, props}]
 *  - createLocalRelationship: ({ type, srcRef, dstRef, srcLabel, dstLabel, props }) => { created:boolean, rel?, reason? }
 *  - dataBump: number (changes whenever local data changes, forces refresh)
 *  - displayFromProps: (props, id) => string
 */
export default function RelationshipForm({
  relType,
  relPairs = [],
  relTypePropsMap,
  localNodes,
  fetchDbInstancesForLabel,
  createLocalRelationship,
  dataBump,
  displayFromProps,
}) {
  const [pairKey, setPairKey] = useState(""); // "src|dst"
  const selectedPair = useMemo(() => {
    if (!pairKey) return null;
    const [src, dst] = pairKey.split("|");
    return { src, dst };
  }, [pairKey]);

  // Auto-select when there is exactly one pair
  useEffect(() => {
    if (relPairs.length === 1) {
      const only = relPairs[0];
      setPairKey(`${only.src}|${only.dst}`);
    } else {
      setPairKey("");
    }
  }, [relPairs]);

  // Relationship property schema → Field defs
  const relPropDefs = useMemo(() => {
    const schema = relTypePropsMap.get?.(relType) || relTypePropsMap[relType] || {};
    return Object.entries(schema).map(([name, t]) => ({
      name,
      label: name,
      type: t === "number" ? "number" : t === "boolean" ? "checkbox" : t === "date" ? "date" : "text",
    }));
  }, [relType, relTypePropsMap]);

  const [relForm, setRelForm] = useState({});
  useEffect(() => {
    // initialize/reset rel form when type or schema changes
    const init = {};
    for (const f of relPropDefs) init[f.name] = f.type === "checkbox" ? false : "";
    setRelForm(init);
  }, [relPropDefs]);

  const onRelFieldChange = useCallback((name, nextValue) => {
    setRelForm((prev) => ({ ...prev, [name]: nextValue }));
  }, []);

  const buildRelProps = useCallback(() => {
    const schema = relTypePropsMap.get?.(relType) || relTypePropsMap[relType] || {};
    const out = {};
    for (const [name, t] of Object.entries(schema)) {
      const raw = relForm[name];
      if (t === "number") {
        const n = Number(String(raw).trim());
        if (!Number.isNaN(n)) out[name] = n;
      } else if (t === "boolean") {
        out[name] = !!raw;
      } else if (t === "date") {
        const s = String(raw || "").trim();
        if (s) out[name] = s;
      } else {
        const s = String(raw || "").trim();
        if (s) out[name] = s;
      }
    }
    return out;
  }, [relForm, relTypePropsMap, relType]);

  // Instance dropdowns
  const [srcOptions, setSrcOptions] = useState([]); // [{id,valueToken, display}]
  const [dstOptions, setDstOptions] = useState([]);
  const [srcToken, setSrcToken] = useState(""); // "db:123" or "local:node-..."
  const [dstToken, setDstToken] = useState("");
  const [instLoading, setInstLoading] = useState(false);

  // load options when pair changes or dataBump changes
  useEffect(() => {
    const load = async () => {
      if (!selectedPair) {
        setSrcOptions([]); setDstOptions([]); setSrcToken(""); setDstToken("");
        return;
      }
      setInstLoading(true);
      try {
        // Local options
        const srcLocal = localNodes
          .filter(n => n.label === selectedPair.src)
          .map(ln => ({
            id: ln.id,
            valueToken: `local:${ln.id}`,
            display: `[LOCAL] ${displayFromProps(ln.props, ln.id)}`
          }));

        const dstLocal = localNodes
          .filter(n => n.label === selectedPair.dst)
          .map(ln => ({
            id: ln.id,
            valueToken: `local:${ln.id}`,
            display: `[LOCAL] ${displayFromProps(ln.props, ln.id)}`
          }));

        // DB options (read-only)
        const [srcDb, dstDb] = await Promise.all([
          fetchDbInstancesForLabel?.(selectedPair.src, 500) || [],
          fetchDbInstancesForLabel?.(selectedPair.dst, 500) || [],
        ]);

        const srcDbOpts = srcDb.map(({ id, props }) => ({
          id,
          valueToken: `db:${id}`,
          display: displayFromProps(props, id),
        }));
        const dstDbOpts = dstDb.map(({ id, props }) => ({
          id,
          valueToken: `db:${id}`,
          display: displayFromProps(props, id),
        }));

        setSrcOptions([...srcLocal, ...srcDbOpts]);
        setDstOptions([...dstLocal, ...dstDbOpts]);
        setSrcToken(""); setDstToken("");
      } finally {
        setInstLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair, dataBump]);

  const canCreateRel = !!(relType && selectedPair && srcToken && dstToken);

  // save (local-only)
  const [relSaving, setRelSaving] = useState(false);
  const [relError, setRelError] = useState("");
  const [relOutcome, setRelOutcome] = useState(null); // { created: boolean }

  const createRelationship = async () => {
    if (!canCreateRel) return;
    setRelSaving(true);
    setRelError("");
    setRelOutcome(null);
    try {
      const props = buildRelProps();
      const outcome = createLocalRelationship({
        type: relType,
        srcRef: srcToken,
        dstRef: dstToken,
        srcLabel: selectedPair.src,
        dstLabel: selectedPair.dst,
        props,
      });
      setRelOutcome(outcome);
      if (!outcome.created && outcome.reason === "exists") {
        setRelError(""); // Show notice below instead of error
      }
    } catch (e) {
      setRelError(e?.message || String(e));
    } finally {
      setRelSaving(false);
    }
  };

  if (!relType) {
    return <div className="placeholder">Select a relationship type to begin.</div>;
  }

  return (
    <>
      {/* Pair picker */}
      <div className="context">
        <h4>(Source, Target) Label Pair</h4>
        {relPairs.length === 0 ? (
          <div className="placeholder">
            No (Source, Target) label pairs found for <strong>{relType}</strong>. Add one under “Add Relationship Type”.
          </div>
        ) : (
          <>
            {relPairs.length > 1 && (
              <Select
                label="Label Pair"
                value={pairKey}
                onChange={(e) => setPairKey(e.target.value)}
                required
                help="Pick which labels act as Source (A) and Target (B)."
              >
                <option value="">— Select label pair —</option>
                {relPairs.map((p) => {
                  const key = `${p.src}|${p.dst}`;
                  return (
                    <option key={key} value={key}>
                      {p.src} → {p.dst}
                    </option>
                  );
                })}
              </Select>
            )}

            {/* Instance selectors */}
            {selectedPair ? (
              <div className="selector-grid">
                <Select
                  label={`Node A (Source: ${selectedPair.src})`}
                  value={srcToken}
                  onChange={(e) => setSrcToken(e.target.value)}
                  disabled={instLoading}
                  required
                >
                  <option value="">— Select a {selectedPair.src} —</option>
                  {srcOptions.map((o) => (
                    <option key={o.valueToken} value={o.valueToken}>
                      {o.display}
                    </option>
                  ))}
                </Select>

                <Select
                  label={`Node B (Target: ${selectedPair.dst})`}
                  value={dstToken}
                  onChange={(e) => setDstToken(e.target.value)}
                  disabled={instLoading}
                  required
                >
                  <option value="">— Select a {selectedPair.dst} —</option>
                  {dstOptions.map((o) => (
                    <option key={o.valueToken} value={o.valueToken}>
                      {o.display}
                    </option>
                  ))}
                </Select>
              </div>
            ) : relPairs.length > 1 ? (
              <div className="placeholder">Select a label pair to continue.</div>
            ) : null}
          </>
        )}
      </div>

      {/* Relationship properties (optional) */}
      {relPropDefs.length > 0 && (
        <div className="context" style={{ marginTop: 16 }}>
          <h4>Relationship Properties (Optional)</h4>
          <div className="form-grid wide">
            <div>
              {relPropDefs.map((f) => (
                <Field
                  key={f.name}
                  nodeId={relType}
                  field={f}
                  value={relForm[f.name]}
                  onFieldChange={onRelFieldChange}
                />
              ))}
            </div>
          </div>
          <div className="help">These are saved locally on the relationship record; <code>createdAt</code> is added automatically.</div>
        </div>
      )}

      {relError && <Alert style={{ marginTop: 12 }}>{relError}</Alert>}
      {relOutcome && (
        <Notice style={{ marginTop: 12 }}>
          {relOutcome.created
            ? <>New <strong>{relType}</strong> relationship recorded locally (with <code>createdAt</code> and any provided properties).</>
            : <>Relationship <strong>{relType}</strong> already exists locally — nothing new created.</>}
        </Notice>
      )}

      {/* Actions */}
      <div className="actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Button
          variant="primary"
          onClick={createRelationship}
          disabled={!canCreateRel || instLoading}
          loading={relSaving}
        >
          Connect Nodes (Local)
        </Button>
      </div>
    </>
  );
}
