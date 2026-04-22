// import React, { useState } from "react";

// // ⚠️ Hardcoding a key in the browser exposes it to anyone using the app.
// // OK for local/internal dev; not for public prod.
// const API_KEY = "AIzaSyBvvteyR4S0OP4TNtAA_KzhO0BOsNNC-DM"; // <-- your Google API key
// const GEMINI_MODEL = "gemini-1.5-flash"; // fast & good enough; change if you prefer

// export default function SmartSearch({ limit = 100, runUserQuery, t }) {
//   const [text, setText] = useState("");
//   const [busy, setBusy] = useState(false);
//   const [err, setErr] = useState("");
//   const [lastQuery, setLastQuery] = useState("");

//   const isLight =
//     (t?.appBg || "").toLowerCase() === "#ffffff" ||
//     (t?.panelBg || "").toLowerCase() === "#f8fafc";

//   const stripCodeFences = (s) => {
//     if (!s) return "";
//     // Remove ```cypher ... ``` or ``` ... ```
//     return s.replace(/^```[\s\S]*?\n/, "").replace(/```$/m, "").trim();
//   };

//   const run = async () => {
//     setErr("");
//     const ux = String(text || "").trim();
//     if (!ux) return;

//     setBusy(true);
//     try {
//       const UPPER_LIMIT = Math.max(1, Math.min(Number(limit) || 100, 500));
//       const HOPS = 1; // default neighbor expansion depth

//       // One prompt that includes our rules + the user's text (uppercased)
// const prompt = [
//   "You are a Cypher generator for Neo4j 5.",
//   "Convert the user's natural language into ONE read-only Cypher query.",
//   "",
//   "HARD RULES:",
//   "- NEVER use write ops: CREATE, MERGE, SET, DELETE, REMOVE, DROP, LOAD CSV, IMPORT, INDEX, CONSTRAINT.",
//   "- If you need illustrative links, ONLY use APOC VIRTUAL helpers:",
//   "  apoc.create.vRelationship / apoc.create.vNode / apoc.create.vNodes / apoc.create.vPath",
//   "- Prefer returning graph elements (nodes/relationships/paths) so a visualization can render.",
//   `- Use LIMIT ${UPPER_LIMIT}.`,
//   `- If expanding neighbors, limit relationships to 1..${HOPS} hops.`,
//   "- Use UPPERCASE labels and relationship types.",
//   "- Use case-insensitive property filters where appropriate, e.g., toUpper(n.name) = \"FOO\" or CONTAINS.",
//   // === NEW: label matching rules ===
//   "- When matching node labels derived from user text, be robust to singular/plural and case differences: build both the singular and plural UPPERCASE variants and match via labels(n), e.g., MATCH (n) WHERE any(l IN labels(n) WHERE toUpper(l) IN [\"DEALER\",\"DEALERS\"]). Prefer this pattern instead of :LABEL when the label comes from user text.",
//   "- Output ONLY the Cypher (no commentary).",
//   "",
//   `TEXT (UPPERCASED): ${ux.toUpperCase()}`
// ].join("\n");

//       const resp = await fetch(
//         `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             contents: [{ role: "user", parts: [{ text: prompt }] }],
//             generationConfig: { temperature: 0.1 },
//           }),
//         }
//       );

//       const data = await resp.json();
//       if (!resp.ok) {
//         throw new Error(data?.error?.message || JSON.stringify(data));
//       }

//       const parts = data?.candidates?.[0]?.content?.parts || [];
//       let q = parts.map((p) => p?.text || "").join("").trim();
//       q = stripCodeFences(q);
//       if (!q) throw new Error("Empty Cypher returned by the model.");

//       // Client-side guardrails (defense-in-depth)
//       const writeOps = /\b(merge|delete|detach|set\s+\w|remove\s+\w|drop|index|constraint|load\s+csv|import)\b/i;
//       const hasCreate = /\bcreate\b/i.test(q);
//       const apocVirtualOK = /\bapoc\.create\.(vRelationship|vNode|vNodes|vPath)\b/i.test(q);
//       if (writeOps.test(q) || (hasCreate && !apocVirtualOK)) {
//         throw new Error("Generated query contained disallowed write operations.");
//       }
//       if (!/\blimit\s+\d+\b/i.test(q)) {
//         q += `\nLIMIT ${Math.max(1, Math.min(Number(limit) || 100, 500))}`;
//       }

//       setLastQuery(q);
//       runUserQuery(q); // Execute only THIS query. The Cypher textarea stays independent.
//     } catch (e) {
//       setErr(e.message || String(e));
//     } finally {
//       setBusy(false);
//     }
//   };

//   const containerStyle = {
//     marginBottom: 16,
//     paddingBottom: 12,
//     borderBottom: `1px solid ${t?.border || "#e5e7eb"}`,
//   };

//   const headingStyle = {
//     fontWeight: 700,
//     fontSize: 16,
//     marginBottom: 8,
//     color: t?.text || "#0b1219",
//   };

//   const inputStyle = {
//     width: "100%",
//     padding: "8px 10px",
//     border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
//     borderRadius: 8,
//     background: t?.ctrlBg || "#ffffff",
//     color: t?.text || "#0b1219",
//     outline: "none",
//   };

//   const hintStyle = { fontSize: 11, color: t?.subtext || "#334155" };

//   const buttonStyle = (active = true) => ({
//     padding: "8px 12px",
//     borderRadius: 8,
//     background: active ? "#22c55e" : "#6b7280",
//     color: "#0b1219",
//     border: "1px solid #16a34a",
//     fontWeight: 800,
//     cursor: active ? "pointer" : "default",
//     opacity: active ? 1 : 0.7,
//   });

//   const errorStyle = {
//     marginTop: 8,
//     fontSize: 12,
//     color: isLight ? "#b91c1c" : "#fecaca",
//   };

//   const preStyle = {
//     marginTop: 8,
//     whiteSpace: "pre-wrap",
//     background: t?.panelBg || (isLight ? "#f8fafc" : "#0f1116"),
//     border: `1px solid ${t?.border || (isLight ? "#e5e7eb" : "#2c313c")}`,
//     borderRadius: 8,
//     color: t?.text || (isLight ? "#0b1219" : "#e5e7eb"),
//     padding: 8,
//     fontSize: 12,
//   };

//   return (
//     <div style={containerStyle}>
//       <div style={headingStyle}>Smart Search (LLM via Gemini)</div>

//       <input
//         value={text}
//         onChange={(e) => setText(e.target.value)}
//         placeholder='Type e.g. "guides in same series as SG_0524_6.1"'
//         spellCheck={false}
//         style={inputStyle}
//       />

//       <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
//         <button
//           onClick={run}
//           disabled={busy || !text.trim()}
//           style={buttonStyle(!(busy || !text.trim()))}
//         >
//           {busy ? "Converting…" : "Convert & Run"}
//         </button>
//         {!!lastQuery && (
//           <span style={hintStyle}>Generated Cypher (read-only, APOC-safe) below.</span>
//         )}
//       </div>

//       {err && <div style={errorStyle}>{err}</div>}

//       {!!lastQuery && <pre style={preStyle}>{lastQuery}</pre>}
//     </div>
//   );
// }
// src/components/GraphBloomClone/SmartSearch.jsx
// src/components/GraphBloomClone/SmartSearch.jsx
import React, { useState } from "react";

// Set VITE_OPENAI_API_KEY in your .env.local file
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const OPENAI_MODEL = "gpt-4.1-mini"; // fast & capable; change if you prefer

export default function SmartSearch({ limit = 100, runUserQuery, t }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const isLight =
    (t?.appBg || "").toLowerCase() === "#ffffff" ||
    (t?.panelBg || "").toLowerCase() === "#f8fafc";

  const stripCodeFences = (s) => {
    if (!s) return "";
    // Remove ```cypher ... ``` or ``` ... ```
    return s.replace(/^```[\s\S]*?\n/, "").replace(/```$/m, "").trim();
  };

  // Fallback extractor for OpenAI Responses API payloads
  const extractOpenAIText = (data) => {
    if (!data) return "";
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      return data.output_text;
    }
    // Walk data.output[].content[] and join any `.text`
    const pieces =
      (Array.isArray(data.output)
        ? data.output.flatMap((msg) =>
            Array.isArray(msg?.content)
              ? msg.content
                  .map((c) => (typeof c?.text === "string" ? c.text : ""))
                  .filter(Boolean)
              : []
          )
        : []) || [];
    return pieces.join("\n");
  };

  const run = async () => {
    setErr("");
    const ux = String(text || "").trim();
    if (!ux) return;

    setBusy(true);
    try {
      const UPPER_LIMIT = Math.max(1, Math.min(Number(limit) || 100, 500));
      const HOPS = 1; // default neighbor expansion depth

      // One prompt that includes our rules + the user's text (uppercased)
      const prompt = [
        "You are a Cypher generator for Neo4j 5.",
        "Convert the user's natural language into ONE read-only Cypher query.",
        "",
        "HARD RULES:",
        "- NEVER use write ops: CREATE, MERGE, SET, DELETE, REMOVE, DROP, LOAD CSV, IMPORT, INDEX, CONSTRAINT.",
        "- If you need illustrative links, ONLY use APOC VIRTUAL helpers:",
        "  apoc.create.vRelationship / apoc.create.vNode / apoc.create.vNodes / apoc.create.vPath",
        "- Prefer returning graph elements (nodes/relationships/paths) so a visualization can render.",
        `- Use LIMIT ${UPPER_LIMIT}.`,
        `- If expanding neighbors, limit relationships to 1..${HOPS} hops.`,
        "- Use UPPERCASE labels and relationship types.",
        "- Use case-insensitive property filters where appropriate, e.g., toUpper(n.name) = \"FOO\" or CONTAINS.",
        // === label matching rules ===
        "- When matching node labels derived from user text, be robust to singular/plural and case differences: build both the singular and plural UPPERCASE variants and match via labels(n), e.g., MATCH (n) WHERE any(l IN labels(n) WHERE toUpper(l) IN [\"DEALER\",\"DEALERS\"]). Prefer this pattern instead of :LABEL when the label comes from user text.",
        "- Output ONLY the Cypher (no commentary).",
        "",
        `TEXT (UPPERCASED): ${ux.toUpperCase()}`,
      ].join("\n");

      // === OpenAI Responses API ===
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: prompt,
          temperature: 0.1,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || JSON.stringify(data));
      }

      // Try output_text first, then fall back to raw content array
      let q = String(extractOpenAIText(data) || "").trim();
      q = stripCodeFences(q);
      if (!q) throw new Error("Empty Cypher returned by the model.");

      // Client-side guardrails (defense-in-depth)
      const writeOps = /\b(merge|delete|detach|set\s+\w|remove\s+\w|drop|index|constraint|load\s+csv|import)\b/i;
      const hasCreate = /\bcreate\b/i.test(q);
      const apocVirtualOK = /\bapoc\.create\.(vRelationship|vNode|vNodes|vPath)\b/i.test(q);
      if (writeOps.test(q) || (hasCreate && !apocVirtualOK)) {
        throw new Error("Generated query contained disallowed write operations.");
      }
      if (!/\blimit\s+\d+\b/i.test(q)) {
        q += `\nLIMIT ${Math.max(1, Math.min(Number(limit) || 100, 500))}`;
      }

      setLastQuery(q);
      runUserQuery(q); // Execute only THIS query. The Cypher textarea stays independent.
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const containerStyle = {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1px solid ${t?.border || "#e5e7eb"}`,
  };

  const headingStyle = {
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 8,
    color: t?.text || "#0b1219",
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid ${t?.ctrlBr || "#e2e8f0"}`,
    borderRadius: 8,
    background: t?.ctrlBg || "#ffffff",
    color: t?.text || "#0b1219",
    outline: "none",
  };

  const hintStyle = { fontSize: 11, color: t?.subtext || "#334155" };

  const buttonStyle = (active = true) => ({
    padding: "8px 12px",
    borderRadius: 8,
    background: active ? "#22c55e" : "#6b7280",
    color: "#0b1219",
    border: "1px solid #16a34a",
    fontWeight: 800,
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0.7,
  });

  const errorStyle = {
    marginTop: 8,
    fontSize: 12,
    color: isLight ? "#b91c1c" : "#fecaca",
  };

  const preStyle = {
    marginTop: 8,
    whiteSpace: "pre-wrap",
    background: t?.panelBg || (isLight ? "#f8fafc" : "#0f1116"),
    border: `1px solid ${t?.border || (isLight ? "#e5e7eb" : "#2c313c")}`,
    borderRadius: 8,
    color: t?.text || (isLight ? "#0b1219" : "#e5e7eb"),
    padding: 8,
    fontSize: 12,
  };

  return (
    <div style={containerStyle}>
      <div style={headingStyle}>Smart Search (LLM via OpenAI)</div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Type e.g. "guides in same series as SG_0524_6.1"'
        spellCheck={false}
        style={inputStyle}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button
          onClick={run}
          disabled={busy || !text.trim()}
          style={buttonStyle(!(busy || !text.trim()))}
        >
          {busy ? "Converting…" : "Convert & Run"}
        </button>
        {!!lastQuery && (
          <span style={hintStyle}>Generated Cypher (read-only, APOC-safe) below.</span>
        )}
      </div>

      {err && <div style={errorStyle}>{err}</div>}

      {!!lastQuery && <pre style={preStyle}>{lastQuery}</pre>}
    </div>
  );
}
