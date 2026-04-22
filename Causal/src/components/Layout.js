import React from "react";
import { Link, useLocation } from "react-router-dom";
import ascenttLogo from "../ascentt.png";

const STEPS = [
  { path: "/",        label: "Upload" },
  { path: "/explore", label: "Explore" },
  { path: "/results", label: "Results" },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const activeStep = STEPS.findIndex(s => s.path === pathname);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-8">

          {/* Logo */}
          <Link to="/" className="flex-shrink-0" style={{ textDecoration: "none" }}>
            <img src={ascenttLogo} alt="Ascentt" className="h-7 w-auto" />
          </Link>

          {/* Step indicator */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {STEPS.map((step, i) => {
              const done   = i < activeStep;
              const active = i === activeStep;
              return (
                <React.Fragment key={step.path}>
                  {i > 0 && (
                    <div className={`h-px w-8 flex-shrink-0 transition-colors ${done ? "bg-orange-400" : "bg-slate-200"}`} />
                  )}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-all ${
                    active ? "bg-slate-100 text-slate-900" :
                    done   ? "text-slate-400" : "text-slate-400"
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      active ? "bg-orange-500 text-white" :
                      done   ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                    }`}>
                      {done ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : i + 1}
                    </span>
                    {step.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="http://localhost:3000"
              style={{ textDecoration: "none" }}
              className="text-[12px] font-bold text-[#58595B] border border-[#e8e4de] bg-[#f5f4f2] hover:bg-[#FEF3E8] hover:border-[#FBCFA4] hover:text-[#F47920] transition-colors px-3 py-1.5 rounded-lg"
            >
              ← Go to Home
            </a>
            <Link to="/" style={{ textDecoration: "none" }}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100">
              New Analysis
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
