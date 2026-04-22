import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGraph } from "../context/GraphContext";
import SupplyChainGraphView from "../components/SupplyChainGraphView";
import Spinner from "../components/Spinner";
import Layout from "../components/Layout";

const NODE_DOT = {
  Supplier: "bg-indigo-500", Factory: "bg-emerald-500",
  Warehouse: "bg-amber-500", DistributionCenter: "bg-violet-500", Retailer: "bg-red-500",
};
const NODE_PILL = {
  Supplier: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Factory:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Warehouse:"bg-amber-50 text-amber-700 border-amber-200",
  DistributionCenter:"bg-violet-50 text-violet-700 border-violet-200",
  Retailer: "bg-red-50 text-red-700 border-red-200",
};

// Business tasks — each maps internally to one or more models
const TASKS = [
  {
    key: "drivers",
    label: "Find Key Drivers",
    desc: "Which factors are causing changes in my outcomes?",
    models: ["pc", "causal_forest"],
    color: "indigo",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    key: "impact",
    label: "Measure Impact",
    desc: "How much does changing one factor affect another?",
    models: ["causal_forest"],
    color: "emerald",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    key: "trends",
    label: "Track Time Patterns",
    desc: "How do effects play out over days or weeks?",
    models: ["varlingam", "pcmci", "granger"],
    color: "violet",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "full",
    label: "Full Deep Analysis",
    desc: "Run everything for the most complete picture",
    models: ["pc", "causal_forest", "varlingam"],
    color: "orange",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
];

const TASK_COLORS = {
  indigo:  { ring: "ring-2 ring-indigo-400 border-indigo-200 bg-indigo-50",   icon: "bg-indigo-100 text-indigo-600",  btn: "bg-indigo-600 hover:bg-indigo-700"  },
  emerald: { ring: "ring-2 ring-emerald-400 border-emerald-200 bg-emerald-50", icon: "bg-emerald-100 text-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700" },
  violet:  { ring: "ring-2 ring-violet-400 border-violet-200 bg-violet-50",   icon: "bg-violet-100 text-violet-600",  btn: "bg-violet-600 hover:bg-violet-700"  },
  orange:  { ring: "ring-2 ring-orange-400 border-orange-200 bg-orange-50",   icon: "bg-orange-100 text-orange-600",  btn: "bg-orange-600 hover:bg-orange-700"  },
};

function EmptyInspector() {
  return (
    <div className="flex flex-col items-center justify-center h-48 px-6 text-center select-none">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
        </svg>
      </div>
      <p className="text-[12px] font-semibold text-slate-500">Select a node or edge</p>
    </div>
  );
}

function Inspector({ el, type }) {
  if (!el) return <EmptyInspector />;
  const skip = ["id", "source", "target", "color", "entity_col"];
  const entries = Object.entries(el).filter(([k, v]) => !skip.includes(k) && v !== undefined && v !== "");
  const name = type === "node" ? el.label : `${(el.source || "").split("::")[1] || el.source} → ${(el.target || "").split("::")[1] || el.target}`;

  return (
    <div className="p-4">
      <div className="mb-3">
        {el.type && <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border mb-2 ${NODE_PILL[el.type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{el.type}</span>}
        {type === "edge" && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border mb-2 bg-slate-100 text-slate-600 border-slate-200">Edge</span>}
        <p className="text-[14px] font-bold text-slate-900 leading-snug">{name}</p>
        {type === "edge" && el.relationship && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{el.relationship.replace(/_/g, " ")}</p>}
      </div>
      <div className="space-y-0 border border-slate-100 rounded-xl overflow-hidden">
        {entries.map(([k, v], i) => (
          <div key={k} className={`flex items-center justify-between px-3 py-2.5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
            <span className="text-[11px] text-slate-500 capitalize">{k.replace(/_/g, " ")}</span>
            <span className="text-[11px] font-semibold text-slate-800 font-mono">{typeof v === "number" ? v.toLocaleString() : String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, active, onSelect }) {
  const c = TASK_COLORS[task.color];
  return (
    <button
      onClick={() => onSelect(task.key)}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 ${active ? c.ring : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? c.icon : "bg-slate-100 text-slate-400"}`}>
          {task.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-bold leading-tight ${active ? "text-slate-900" : "text-slate-700"}`}>{task.label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{task.desc}</p>
        </div>
        {active && (
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}

export default function SupplyChainExplorer() {
  const nav = useNavigate();
  const { graphData, loading, error, runCausalAnalysis } = useGraph();

  const [selectedEl, setSelectedEl]   = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [activeTypes, setActiveTypes] = useState(null);
  const [search, setSearch]           = useState("");
  const [rightTab, setRightTab]       = useState("analysis");
  const [selectedTask, setSelectedTask] = useState("drivers");

  const handleNodeClick = useCallback((data) => {
    setSelectedEl(data); setSelectedType(data ? "node" : null);
    if (data) setRightTab("inspector");
  }, []);
  const handleEdgeClick = useCallback((data) => {
    setSelectedEl(data); setSelectedType(data ? "edge" : null);
    if (data) setRightTab("inspector");
  }, []);

  const toggleType = (type) =>
    setActiveTypes(prev => {
      if (!prev) { const s = new Set(graphData.node_types); s.delete(type); return s; }
      const n = new Set(prev);
      n.has(type) ? n.delete(type) : n.add(type);
      return n.size === graphData.node_types.length ? null : n;
    });

  const activeTask = TASKS.find(t => t.key === selectedTask) || TASKS[0];

  const handleRun = async () => {
    const result = await runCausalAnalysis({ models: activeTask.models, alpha: 0.05 });
    if (result) nav("/results");
  };

  if (!graphData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-slate-900 mb-2">No data loaded</h2>
          <p className="text-[14px] text-slate-500 mb-6">Upload a supply chain CSV to get started.</p>
          <button onClick={() => nav("/")} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[14px] font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            Upload Data
          </button>
        </div>
      </Layout>
    );
  }

  const filteredNodes = graphData.nodes.filter(n =>
    (!activeTypes || activeTypes.has(n.type)) &&
    (!search || n.label.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredGraph = {
    nodes: filteredNodes,
    edges: graphData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
  };


  return (
    <Layout>
      <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-0" style={{ height: 52 }}>
          <div className="h-full flex items-center gap-4">
            {/* Left: back + title */}
            <button onClick={() => nav("/")} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <p className="text-[13px] font-bold text-slate-900 leading-none">Supply Chain Explorer</p>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 ml-2">
              {[
                { label: "nodes", val: graphData.stats.node_count },
                { label: "edges", val: graphData.stats.edge_count },
                { label: "events", val: graphData.stats.row_count },
              ].map(s => (
                <span key={s.label} className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600">
                  {s.val} <span className="font-normal text-slate-400">{s.label}</span>
                </span>
              ))}
            </div>

            {/* Selected task badge */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Goal:</span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">{activeTask.label}</span>
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={loading}
              className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                !loading ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {loading
                ? <><Spinner label="" /><span>Running…</span></>
                : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>Run Analysis</>
              }
            </button>
          </div>
        </div>

        {error && (
          <div className="flex-shrink-0 px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {/* Body: sidebar + graph + right panel */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <div className="flex-shrink-0 w-44 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="p-3 flex-shrink-0">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search nodes…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              />
            </div>

            {/* Node type filters */}
            <div className="px-3 pb-2 flex-shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Filter</p>
              <div className="space-y-0.5">
                {graphData.node_types.map(type => {
                  const on = !activeTypes || activeTypes.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${on ? "text-slate-800 bg-slate-100" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? NODE_DOT[type] || "bg-slate-400" : "bg-slate-200"}`} />
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full h-px bg-slate-100 flex-shrink-0" />

            {/* Node list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nodes</p>
              <div className="space-y-0.5">
                {filteredGraph.nodes.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedEl(n); setSelectedType("node"); setRightTab("inspector"); }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-all ${selectedEl?.id === n.id ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${NODE_DOT[n.type] || "bg-slate-400"}`} />
                    <span className="truncate">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Graph canvas */}
          <div className="flex-1 overflow-hidden" style={{ background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)" }}>
            <div className="w-full h-full p-3">
              <SupplyChainGraphView
                graph={filteredGraph}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                selectedId={selectedEl?.id}
                height="100%"
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-shrink-0 w-72 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-slate-200">
              {[
                { key: "analysis",  label: "Analysis Goal" },
                { key: "inspector", label: "Inspector"      },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setRightTab(t.key)}
                  className={`flex-1 py-3 text-[12px] font-semibold transition-all border-b-2 ${
                    rightTab === t.key ? "border-indigo-500 text-indigo-700 bg-indigo-50/40" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Analysis Goal content */}
            {rightTab === "analysis" && (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">What do you want to find out?</p>
                  <div className="space-y-2">
                    {TASKS.map(task => (
                      <TaskCard
                        key={task.key}
                        task={task}
                        active={selectedTask === task.key}
                        onSelect={setSelectedTask}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-white">
                  <button
                    onClick={handleRun}
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                      !loading ? `${TASK_COLORS[activeTask.color].btn} text-white shadow-sm` : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {loading
                      ? <><Spinner label="" /><span>Running…</span></>
                      : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>{activeTask.label}</>
                    }
                  </button>
                </div>
              </>
            )}

            {/* Inspector content */}
            {rightTab === "inspector" && (
              <div className="flex-1 overflow-y-auto">
                <Inspector el={selectedEl} type={selectedType} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
