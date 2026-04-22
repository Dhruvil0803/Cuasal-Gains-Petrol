// src/components/GraphBloomClone/scenariosStore.js

/* ----------------------------- localStorage scenarios ----------------------------- */
export const STORAGE_KEY = "gbc_scenarios_v1";
export const genId = () =>
  Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);

export const readScenarios = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

export const writeScenarios = (arr) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
