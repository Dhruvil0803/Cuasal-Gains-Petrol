// src/components/GraphBloomClone/neighborhood-llm/LLMClient.js

/**
 * Thin client for stateless LLM endpoints.
 * Both functions expect the FULL CURRENT SNAPSHOT (no history).
 */

async function postJSON(path, body, { signal } = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status}: ${text || "request failed"}`);
  }
  return res.json();
}

/**
 * Analyze the current neighborhood snapshot (entities/relationships/metrics/summary).
 * @param {{ snapshot: object, signal?: AbortSignal }} params
 * @returns {Promise<object>}
 */
export function analyzeNeighborhood({ snapshot, signal } = {}) {
  if (!snapshot) throw new Error("analyzeNeighborhood: snapshot is required");
  return postJSON("/llm/analyze-neighborhood", { snapshot }, { signal });
}

/**
 * Ask a question about the current neighborhood snapshot.
 * @param {{ message: string, snapshot: object, signal?: AbortSignal }} params
 * @returns {Promise<{ text: string, provenance?: {nodes:string[], edges:string[]}, tables?: any }>}
 */
export function chatNeighborhood({ message, snapshot, signal } = {}) {
  if (!message) throw new Error("chatNeighborhood: message is required");
  if (!snapshot) throw new Error("chatNeighborhood: snapshot is required");
  return postJSON("/llm/chat", { message, snapshot }, { signal });
}
