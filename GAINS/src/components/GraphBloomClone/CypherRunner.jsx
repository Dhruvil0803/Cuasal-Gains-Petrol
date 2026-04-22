// // src/components/GraphBloomClone/CypherRunner.jsx
// import React, { useEffect, useMemo, useState, useCallback } from "react";

// /* -------- Local saved queries (persisted in localStorage) -------- */
// const LS_KEY = "gbc_saved_queries_v1";

// function readSavedQueries() {
//   try {
//     const raw = localStorage.getItem(LS_KEY);
//     const arr = raw ? JSON.parse(raw) : [];
//     if (Array.isArray(arr)) return arr;
//   } catch {}
//   return [];
// }

// function writeSavedQueries(arr) {
//   try {
//     localStorage.setItem(LS_KEY, JSON.stringify(arr));
//   } catch {}
// }

// function genId() {
//   return Math.random().toString(36).slice(2);
// }

// export default function CypherRunner({
//   userQuery,
//   setUserQuery,
//   clearBeforeQuery,
//   setClearBeforeQuery,
//   runUserQuery,
// }) {
//   const [saved, setSaved] = useState([]);
//   const [selectedId, setSelectedId] = useState("");
//   const [saveName, setSaveName] = useState("");

//   useEffect(() => {
//     setSaved(readSavedQueries());
//   }, []);

//   const selectedItem = useMemo(
//     () => saved.find((s) => s.id === selectedId) || null,
//     [saved, selectedId]
//   );

//   const autoName = (text) =>
//     (text || "").trim().replace(/\s+/g, " ").slice(0, 60) ||
//     `Query ${new Date().toLocaleTimeString()}`;

//   const saveCurrent = useCallback(() => {
//     const text = String(userQuery || "").trim();
//     if (!text) return;

//     const name = String(saveName || "").trim();
//     const idx = saved.findIndex((s) => s.text === text);
//     let next;

//     if (idx >= 0) {
//       const existing = saved[idx];
//       const updated = {
//         ...existing,
//         name: name || existing.name,
//         ts: Date.now(),
//       };
//       next = [updated, ...saved.filter((_, i) => i !== idx)];
//     } else {
//       const item = {
//         id: genId(),
//         name: name || autoName(text),
//         text,
//         ts: Date.now(),
//       };
//       next = [item, ...saved];
//     }

//     setSaved(next);
//     writeSavedQueries(next);
//     setSelectedId(next[0].id);
//     setSaveName(""); // clear input after saving
//   }, [userQuery, saveName, saved]);

//   const onSelectChange = (e) => {
//     const id = e.target.value;
//     setSelectedId(id);
//     const item = saved.find((s) => s.id === id);
//     if (item) setUserQuery(item.text);
//   };

//   return (
//     <div>
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
//         Cypher Query
//       </div>

//       {/* Saved queries row (wraps; no horizontal scroll) */}
//       <div
//         style={{
//           display: "flex",
//           flexWrap: "wrap",
//           gap: 8,
//           alignItems: "center",
//           marginBottom: 8,
//           width: "100%",
//         }}
//       >
//         <select
//           value={selectedId}
//           onChange={onSelectChange}
//           style={{
//             flex: "1 1 240px",
//             minWidth: 180,
//             background: "#0f1116",
//             color: "#e5e7eb",
//             border: "1px solid #2c313c",
//             borderRadius: 8,
//             padding: "8px 10px",
//             outline: "none",
//           }}
//         >
//           <option value="">— pick a saved query —</option>
//           {saved.map((s) => (
//             <option key={s.id} value={s.id}>
//               {s.name}
//             </option>
//           ))}
//         </select>

//         <input
//           value={saveName}
//           onChange={(e) => setSaveName(e.target.value)}
//           placeholder="Name to save as…"
//           spellCheck={false}
//           style={{
//             flex: "1 1 220px",
//             minWidth: 160,
//             background: "#0f1116",
//             color: "#e5e7eb",
//             border: "1px solid #2c313c",
//             borderRadius: 8,
//             padding: "8px 10px",
//             outline: "none",
//           }}
//         />

//         <button
//           onClick={saveCurrent}
//           title="Save current query"
//           style={{
//             flex: "0 0 auto",
//             padding: "8px 10px",
//             borderRadius: 8,
//             background: "#1f2937",
//             color: "#e5e7eb",
//             border: "1px solid #374151",
//             fontWeight: 700,
//             whiteSpace: "nowrap",
//           }}
//         >
//           Save
//         </button>
//       </div>

//       <textarea
//         value={userQuery}
//         onChange={(e) => setUserQuery(e.target.value)}
//         placeholder="MATCH p=(n)-[r]-(m) RETURN p LIMIT 50"
//         spellCheck={false}
//         rows={6}
//         style={{
//           width: "100%",
//           background: "#0f1116",
//           border: "1px solid #2c313c",
//           color: "#e5e7eb",
//           padding: 10,
//           borderRadius: 10,
//           outline: "none",
//           fontFamily:
//             "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
//           fontSize: 13,
//           lineHeight: 1.4,
//         }}
//       />

//       <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
//         <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
//           <input
//             type="checkbox"
//             checked={clearBeforeQuery}
//             onChange={(e) => setClearBeforeQuery(!!e.target.checked)}
//           />
//           <span>Clear before draw</span>
//         </label>

//         <div style={{ flex: 1 }} />

//        <button
//   onClick={() => runUserQuery()}  // run the textarea query (no event argument)
//   style={{
//     padding: "10px 14px",
//     borderRadius: 10,
//     background: "#16a34a",
//     color: "#0b1219",
//     border: "1px solid #16a34a",
//     fontWeight: 800,
//   }}
// >
//   Run
// </button>

//       </div>

//       <p style={{ fontSize: 12, color: "#9aa3b2", marginTop: 8 }}>
//         Returns of nodes, relationships, or paths are drawn. Virtual relationships (APOC) are supported.
//       </p>
//     </div>
//   );
// }
// src/components/GraphBloomClone/CypherRunner.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";

/* -------- Local saved queries (persisted in localStorage) -------- */
const LS_KEY = "gbc_saved_queries_v1";

function readSavedQueries() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

function writeSavedQueries(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

function genId() {
  return Math.random().toString(36).slice(2);
}

export default function CypherRunner({
  userQuery,
  setUserQuery,
  clearBeforeQuery,
  setClearBeforeQuery,
  runUserQuery,
  t, // ← THEME TOKENS (appBg, panelBg, cardBg, border, text, subtext, ctrlBg, ctrlBr)
}) {
  const [saved, setSaved] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setSaved(readSavedQueries());
  }, []);

  const selectedItem = useMemo(
    () => saved.find((s) => s.id === selectedId) || null,
    [saved, selectedId]
  );

  const autoName = (text) =>
    (text || "").trim().replace(/\s+/g, " ").slice(0, 60) ||
    `Query ${new Date().toLocaleTimeString()}`;

  const saveCurrent = useCallback(() => {
    const text = String(userQuery || "").trim();
    if (!text) return;

    const name = String(saveName || "").trim();
    const idx = saved.findIndex((s) => s.text === text);
    let next;

    if (idx >= 0) {
      const existing = saved[idx];
      const updated = {
        ...existing,
        name: name || existing.name,
        ts: Date.now(),
      };
      next = [updated, ...saved.filter((_, i) => i !== idx)];
    } else {
      const item = {
        id: genId(),
        name: name || autoName(text),
        text,
        ts: Date.now(),
      };
      next = [item, ...saved];
    }

    setSaved(next);
    writeSavedQueries(next);
    setSelectedId(next[0].id);
    setSaveName(""); // clear input after saving
  }, [userQuery, saveName, saved]);

  const onSelectChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const item = saved.find((s) => s.id === id);
    if (item) setUserQuery(item.text);
  };

  // ---------- shared inline styles using theme tokens ----------
  const heading = { fontWeight: 700, fontSize: 16, marginBottom: 8, color: t?.text };
  const row = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8, width: "100%" };
  const select = {
    flex: "1 1 240px",
    minWidth: 180,
    background: t?.ctrlBg,
    color: t?.text,
    border: `1px solid ${t?.ctrlBr}`,
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
  };
  const input = {
    flex: "1 1 220px",
    minWidth: 160,
    background: t?.ctrlBg,
    color: t?.text,
    border: `1px solid ${t?.ctrlBr}`,
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
  };
  const btn = {
    flex: "0 0 auto",
    padding: "8px 10px",
    borderRadius: 8,
    background: t?.ctrlBg,
    color: t?.text,
    border: `1px solid ${t?.ctrlBr}`,
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
  const textarea = {
    width: "100%",
    background: t?.ctrlBg,
    border: `1px solid ${t?.border}`,
    color: t?.text,
    padding: 10,
    borderRadius: 10,
    outline: "none",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: 13,
    lineHeight: 1.4,
  };
  const chip = { fontSize: 12, color: t?.text };
  const subtext = { fontSize: 12, color: t?.subtext, marginTop: 8 };

  return (
    <div>
      <div style={heading}>Cypher Query</div>

      {/* Saved queries row (wraps; no horizontal scroll) */}
      <div style={row}>
        <select value={selectedId} onChange={onSelectChange} style={select}>
          <option value="">— pick a saved query —</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Name to save as…"
          spellCheck={false}
          style={input}
        />

        <button onClick={saveCurrent} title="Save current query" style={btn}>
          Save
        </button>
      </div>

      <textarea
        value={userQuery}
        onChange={(e) => setUserQuery(e.target.value)}
        placeholder="MATCH p=(n)-[r]-(m) RETURN p LIMIT 50"
        spellCheck={false}
        rows={6}
        style={textarea}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", ...chip }}>
          <input
            type="checkbox"
            checked={clearBeforeQuery}
            onChange={(e) => setClearBeforeQuery(!!e.target.checked)}
          />
          <span>Clear before draw</span>
        </label>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => runUserQuery()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#16a34a",
            color: "#0b1219",
            border: "1px solid #16a34a",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Run
        </button>
      </div>

      <p style={subtext}>
        Returns of nodes, relationships, or paths are drawn. Virtual relationships (APOC) are supported.
      </p>
    </div>
  );
}
