import React from "react";

export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-2.5 text-indigo-600">
      <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label && <span className="text-[13px] font-medium text-slate-600">{label}</span>}
    </div>
  );
}
