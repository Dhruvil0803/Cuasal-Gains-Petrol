// // server/routes-llm.js
// import express from "express";
// import {
//   SYSTEM_ANALYZE,
//   USER_ANALYZE_INSTRUCTIONS,
//   SYSTEM_CHAT,
//   USER_CHAT_INSTRUCTIONS,
// } from "./prompt-templates.js";

// const router = express.Router();

// function validateSnapshot(snap, { maxNodes, maxEdges }) {
//   if (!snap || typeof snap !== "object") throw new Error("snapshot is required");
//   const n = Array.isArray(snap.nodes) ? snap.nodes.length : 0;
//   const e = Array.isArray(snap.edges) ? snap.edges.length : 0;
//   if (n > maxNodes) throw new Error(`Too many nodes (${n} > ${maxNodes})`);
//   if (e > maxEdges) throw new Error(`Too many edges (${e} > ${maxEdges})`);
// }

// async function callOpenAI({ apiKey, model, system, user, timeoutMs }) {
//   const controller = new AbortController();
//   const timeout = setTimeout(() => controller.abort(), timeoutMs);

//   try {
//     const res = await fetch("https://api.openai.com/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${apiKey}`,
//       },
//       body: JSON.stringify({
//         model,
//         response_format: { type: "json_object" },
//         temperature: 0.1,
//         messages: [
//           { role: "system", content: system },
//           { role: "user", content: user },
//         ],
//       }),
//       signal: controller.signal,
//     });
//     if (!res.ok) {
//       const text = await res.text().catch(() => "");
//       throw new Error(`LLM error ${res.status}: ${text || "request failed"}`);
//     }
//     const data = await res.json();
//     const content = data?.choices?.[0]?.message?.content;
//     if (!content) throw new Error("Empty LLM response");
//     return JSON.parse(content);
//   } finally {
//     clearTimeout(timeout);
//   }
// }

// router.post("/analyze-neighborhood", async (req, res) => {
//   try {
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
//     const model = process.env.MODEL || "gpt-4o-mini";
//     const timeoutMs = Number(process.env.TIMEOUT_MS || 12000);
//     const maxNodes = Number(process.env.MAX_NODES || 1500);
//     const maxEdges = Number(process.env.MAX_EDGES || 3000);

//     const { snapshot } = req.body || {};
//     validateSnapshot(snapshot, { maxNodes, maxEdges });

//     const user = [
//       USER_ANALYZE_INSTRUCTIONS.trim(),
//       "\n---\nSNAPSHOT:\n",
//       JSON.stringify(snapshot, null, 2),
//     ].join("");

//     const json = await callOpenAI({
//       apiKey,
//       model,
//       system: SYSTEM_ANALYZE,
//       user,
//       timeoutMs,
//     });

//     res.json(json);
//   } catch (err) {
//     res.status(400).json({ error: err?.message || "Analyze failed" });
//   }
// });

// router.post("/chat", async (req, res) => {
//   try {
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
//     const model = process.env.MODEL || "gpt-4o-mini";
//     const timeoutMs = Number(process.env.TIMEOUT_MS || 12000);
//     const maxNodes = Number(process.env.MAX_NODES || 1500);
//     const maxEdges = Number(process.env.MAX_EDGES || 3000);

//     const { message, snapshot } = req.body || {};
//     if (!message || typeof message !== "string") throw new Error("message is required");
//     validateSnapshot(snapshot, { maxNodes, maxEdges });

//     const user = [
//       USER_CHAT_INSTRUCTIONS.trim(),
//       "\n---\nQUESTION:\n",
//       message,
//       "\n---\nSNAPSHOT:\n",
//       JSON.stringify(snapshot, null, 2),
//     ].join("");

//     const json = await callOpenAI({
//       apiKey,
//       model,
//       system: SYSTEM_CHAT,
//       user,
//       timeoutMs,
//     });

//     const out = {
//       text: typeof json?.text === "string" ? json.text : "(no answer)",
//       provenance: {
//         nodes: Array.isArray(json?.provenance?.nodes) ? json.provenance.nodes : [],
//         edges: Array.isArray(json?.provenance?.edges) ? json.provenance.edges : [],
//       },
//     };
//     res.json(out);
//   } catch (err) {
//     res.status(400).json({ error: err?.message || "Chat failed" });
//   }
// });

// export default router;
// server/routes-llm.js
import express from "express";
import {
  SYSTEM_ANALYZE,
  USER_ANALYZE_INSTRUCTIONS,
  SYSTEM_CHAT,
  USER_CHAT_INSTRUCTIONS,
} from "./prompt-templates.js";

const router = express.Router();

function validateSnapshot(snap, { maxNodes, maxEdges }) {
  if (!snap || typeof snap !== "object") throw new Error("snapshot is required");
  const n = Array.isArray(snap.nodes) ? snap.nodes.length : 0;
  const e = Array.isArray(snap.edges) ? snap.edges.length : 0;
  if (n > maxNodes) throw new Error(`Too many nodes (${n} > ${maxNodes})`);
  if (e > maxEdges) throw new Error(`Too many edges (${e} > ${maxEdges})`);
}

async function callOpenAI({ apiKey, model, system, user, timeoutMs }) {
  apiKey = String(apiKey || "").trim();
  model = String(model || "gpt-4o-mini").trim();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (empty after trim)");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM error ${res.status}: ${text || "request failed"}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("LLM returned non-JSON content");
    }
  } finally {
    clearTimeout(timeout);
  }
}

router.post("/analyze-neighborhood", async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    const model = (process.env.MODEL || "gpt-4o-mini").trim();
    const timeoutMs = Number(process.env.TIMEOUT_MS || 12000);
    const maxNodes = Number(process.env.MAX_NODES || 1500);
    const maxEdges = Number(process.env.MAX_EDGES || 3000);

    const { snapshot } = req.body || {};
    validateSnapshot(snapshot, { maxNodes, maxEdges });

    const user = [
      USER_ANALYZE_INSTRUCTIONS.trim(),
      "\n---\nSNAPSHOT:\n",
      JSON.stringify(snapshot, null, 2),
    ].join("");

    const json = await callOpenAI({
      apiKey,
      model,
      system: SYSTEM_ANALYZE,
      user,
      timeoutMs,
    });

    res.json(json);
  } catch (err) {
    res.status(400).json({ error: err?.message || "Analyze failed" });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    const model = (process.env.MODEL || "gpt-4o-mini").trim();
    const timeoutMs = Number(process.env.TIMEOUT_MS || 12000);
    const maxNodes = Number(process.env.MAX_NODES || 1500);
    const maxEdges = Number(process.env.MAX_EDGES || 3000);

    const { message, snapshot } = req.body || {};
    if (!message || typeof message !== "string") throw new Error("message is required");
    validateSnapshot(snapshot, { maxNodes, maxEdges });

    const user = [
      USER_CHAT_INSTRUCTIONS.trim(),
      "\n---\nQUESTION:\n",
      message,
      "\n---\nSNAPSHOT:\n",
      JSON.stringify(snapshot, null, 2),
    ].join("");

    const json = await callOpenAI({
      apiKey,
      model,
      system: SYSTEM_CHAT,
      user,
      timeoutMs,
    });

    const out = {
      text: typeof json?.text === "string" ? json.text : "(no answer)",
      provenance: {
        nodes: Array.isArray(json?.provenance?.nodes) ? json.provenance.nodes : [],
        edges: Array.isArray(json?.provenance?.edges) ? json.provenance.edges : [],
      },
    };
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err?.message || "Chat failed" });
  }
});

export default router;
