import { createContext, useContext, useState } from "react";
import API_BASE from "../config";

const GraphContext = createContext(null);

export function GraphProvider({ children }) {
  const [graphData, setGraphData] = useState(null);
  const [file, setFile] = useState(null);
  const [causalResults, setCausalResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = async (uploadedFile) => {
    setLoading(true);
    setError(null);
    setCausalResults(null);
    setFile(uploadedFile);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      const res = await fetch(`${API_BASE}/graph/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Upload failed");
      }
      const data = await res.json();
      setGraphData(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async () => {
    setLoading(true);
    setError(null);
    setCausalResults(null);
    try {
      const res = await fetch("/sample_supply_chain.csv");
      const blob = await res.blob();
      const sampleFile = new File([blob], "sample_supply_chain.csv", { type: "text/csv" });
      setLoading(false);
      return uploadFile(sampleFile);
    } catch (e) {
      setError("Failed to load sample data");
      setLoading(false);
      return null;
    }
  };

  const runCausalAnalysis = async ({ models = ["pc", "causal_forest"], alpha = 0.05, timeColumn = null, yCols = null, tCols = null } = {}) => {
    if (!file) return null;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "config_json",
        JSON.stringify({ models, alpha, y_cols: yCols, t_cols: tCols, time_column: timeColumn || null })
      );
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Analysis failed");
      }
      const data = await res.json();
      setCausalResults(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setGraphData(null);
    setFile(null);
    setCausalResults(null);
    setError(null);
  };

  return (
    <GraphContext.Provider
      value={{ graphData, file, causalResults, loading, error, uploadFile, loadSample, runCausalAnalysis, reset }}
    >
      {children}
    </GraphContext.Provider>
  );
}

export function useGraph() {
  return useContext(GraphContext);
}
