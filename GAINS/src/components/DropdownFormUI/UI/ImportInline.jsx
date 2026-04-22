import React, { useRef, useState } from "react";

/**
 * Reusable Import control.
 *
 * Props:
 * - onImport(data: any): void      // call with parsed JSON
 * - layout: "vertical" | "horizontal"  // visual treatment (default: "horizontal")
 * - label?: string                 // custom button label
 * - compact?: boolean              // smaller text treatment for header
 */
export default function ImportInline({
  onImport,
  layout = "horizontal",
  label = "Import",
  compact = false,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const trigger = () => inputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      try {
        const json = JSON.parse(String(reader.result || "{}"));
        if (typeof onImport === "function") onImport(json);
        // also expose a global callback if the project already wired one
        if (typeof window !== "undefined" && typeof window.dfuiOnImport === "function") {
          window.dfuiOnImport(json);
        }
      } catch (err) {
        console.error("Import parse error:", err);
        alert("Could not parse file. Please select a valid JSON export.");
      } finally {
        // allow selecting the same file again
        e.target.value = "";
      }
    };
    reader.onerror = () => {
      setBusy(false);
      alert("Failed to read file.");
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={`import-inline ${layout === "vertical" ? "import-inline--vertical" : "import-inline--horizontal"} ${compact ? "import-inline--compact" : ""}`}
    >
      <button
        type="button"
        className={`btn ${compact ? "btn--sm" : "btn--md"} btn--primary import-inline__btn`}
        onClick={trigger}
        disabled={busy}
      >
        {busy ? (
          <>
            <span className="btn__spinner" />
            Importing…
          </>
        ) : (
          label
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
