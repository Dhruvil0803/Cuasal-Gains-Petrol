import API_BASE from "./config";

export async function analyze(file, config) {
  const form = new FormData();
  form.append("file", file);
  form.append("config_json", JSON.stringify(config));

  console.log("📡 Sending request to backend:", {
    url: `${API_BASE}/analyze`,
    file: file.name,
    config: config,
    fileSize: file.size,
  });

  let res;
  try {
    res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
  } catch (e) {
    console.error("❌ Network error:", e);
    throw new Error("Failed to connect to backend. Is FastAPI running on port 8000?");
  }

  console.log("📨 Response status:", res.status, res.statusText);

  if (!res.ok) {
    let details = '';
    try {
      details = await res.text();
      console.error("❌ Error response body:", details);
    } catch {}
    throw new Error(`Analyze failed: ${res.status} ${res.statusText}${details ? ' - ' + details : ''}`);
  }

  const result = await res.json();
  console.log("✅ Success! Result received:", {
    graphs: Object.keys(result.graphs || {}),
    warnings: result.warnings || [],
    meta: result.meta,
  });

  return result;
}
