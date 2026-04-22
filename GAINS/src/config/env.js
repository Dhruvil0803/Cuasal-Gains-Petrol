// src/config/env.js
export const getEnv = (k) => {
  if (typeof import.meta !== "undefined" && import.meta.env && k in import.meta.env) return import.meta.env[k]; // Vite
  if (typeof process !== "undefined" && process.env && k in process.env) return process.env[k]; // CRA fallback
  return undefined;
};

export const NEO4J_URI      = getEnv("VITE_NEO4J_URI")      || getEnv("REACT_APP_NEO4J_URI")      || "";
export const NEO4J_USER     = getEnv("VITE_NEO4J_USER")     || getEnv("REACT_APP_NEO4J_USER")     || "";
export const NEO4J_PASSWORD = getEnv("VITE_NEO4J_PASSWORD") || getEnv("REACT_APP_NEO4J_PASSWORD") || "";
export const GEMINI_API_KEY = getEnv("VITE_GEMINI_API_KEY") || getEnv("REACT_APP_GEMINI_API_KEY") || "";