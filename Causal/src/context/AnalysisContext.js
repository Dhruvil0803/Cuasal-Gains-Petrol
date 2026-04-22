import React, { createContext, useContext, useState } from "react";
import { analyze } from "../api";

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (fileArg, configArg) => {
    setFile(fileArg);
    setConfig(configArg);
    setLoading(true);
    setError("");
    try {
      const out = await analyze(fileArg, configArg);
      setResult(out);
      return out;
    } catch (e) {
      setError(e.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnalysisContext.Provider value={{ config, file, result, loading, error, run }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
