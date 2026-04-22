// src/components/GraphBloomClone/styleRuleStore.js
export const STYLE_KEY = "gbc_style_rule_v1";

export function readActiveStyleRule() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_KEY) || "null");
  } catch {
    return null;
  }
}

export function writeActiveStyleRule(ruleOrNull) {
  if (!ruleOrNull) localStorage.removeItem(STYLE_KEY);
  else localStorage.setItem(STYLE_KEY, JSON.stringify(ruleOrNull));
}
