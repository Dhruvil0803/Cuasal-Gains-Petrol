// src/components/GraphBloomClone/StatusBanner.jsx
import React from "react";

export default function StatusBanner({ status }) {
  if (!status) return null;

  const isConnected = status.startsWith("Connected");
  return (
    <div
      style={{
        background: isConnected ? "#083d2f" : "#0f172a",
        color: isConnected ? "#c7f9e5" : "#e5e7eb",
        border: `1px solid ${isConnected ? "#10b981" : "#334155"}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 14,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {status}
    </div>
  );
}
