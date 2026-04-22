import React, { useState } from 'react'

const APPS = [
  {
    id: 'petrol',
    emoji: '🛢️',
    tag: 'IoT Monitoring',
    title: 'Petrol IoT Monitor',
    desc: 'Real-time pipeline sensor monitoring across a 100-node oil & gas network spanning Texas and Oklahoma.',
    features: [
      'Live sensor readings — pressure, temperature, flow & fuel',
      'Predictive anomaly detection with time-to-critical estimates',
      'Disaster event simulation — hurricane, earthquake, flood & more',
      'AI pipeline assistant for instant operational queries',
    ],
    url: 'http://localhost:3001',
    port: '3001',
    iconBg: 'from-[#F47920] to-[#D4621A]',
    tagColor: 'text-[#F47920]',
    hoverBorder: 'hover:border-[#FBCFA4]',
    hoverShadow: 'hover:shadow-[0_8px_32px_rgba(244,121,32,0.18)]',
  },
  {
    id: 'causal',
    emoji: '🔗',
    tag: 'Causal Analytics',
    title: 'Causal Intelligence',
    desc: 'Discover cause-and-effect relationships in your supply chain and operational data using advanced causal graph analysis.',
    features: [
      'Interactive causal graph visualization',
      'Root cause identification across supply chain data',
      'What-if scenario analysis and impact tracing',
      'Node-level drill-down for any causal relationship',
    ],
    url: 'http://localhost:3002',
    port: '3002',
    iconBg: 'from-[#0891b2] to-[#0e7490]',
    tagColor: 'text-[#0891b2]',
    hoverBorder: 'hover:border-[#a5f3fc]',
    hoverShadow: 'hover:shadow-[0_8px_32px_rgba(8,145,178,0.18)]',
  },
  {
    id: 'gains',
    emoji: '📊',
    tag: 'Graph Analytics',
    title: 'GAINS',
    desc: 'Graph-powered freight cost analytics and network intelligence with Snowflake data integration and Neo4j graph database.',
    features: [
      'Freight cost analytics across 2000+ data points',
      'Neo4j graph database powered network visualization',
      'Snowflake data integration with live querying',
      'AI-assisted insights and reporting',
    ],
    url: 'http://localhost:5173',
    port: '5173',
    iconBg: 'from-[#059669] to-[#047857]',
    tagColor: 'text-[#059669]',
    hoverBorder: 'hover:border-[#6ee7b7]',
    hoverShadow: 'hover:shadow-[0_8px_32px_rgba(5,150,105,0.18)]',
  },
]

function AppCard({ app }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        bg-white rounded-2xl border border-[#e8e4de] flex flex-col
        shadow-sm transition-all duration-200
        ${app.hoverBorder} ${app.hoverShadow}
        ${hovered ? '-translate-y-1' : 'translate-y-0'}
      `}
    >
      {/* Card Top */}
      <div className="p-7 border-b border-[#f0ece6]">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.iconBg} flex items-center justify-center text-2xl mb-5 shadow-md`}>
          {app.emoji}
        </div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${app.tagColor}`}>
          {app.tag}
        </p>
        <h3 className="text-xl font-extrabold text-gray-900 mb-3 tracking-tight">
          {app.title}
        </h3>
        <p className="text-sm text-[#58595B] leading-relaxed">
          {app.desc}
        </p>
      </div>

      {/* Features */}
      <div className="px-7 py-5 flex-1 flex flex-col gap-3">
        {app.features.map((f, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-snug">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F47920] flex-shrink-0 mt-1.5" />
            {f}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-7 pb-7 pt-2">
        <a
          href={app.url}
          target="_blank"
          rel="noreferrer"
          className="
            block w-full text-center py-3 px-5 rounded-xl
            bg-gradient-to-r from-[#F47920] to-[#D4621A]
            text-white text-sm font-bold tracking-wide
            shadow-[0_3px_12px_rgba(244,121,32,0.35)]
            hover:opacity-90 hover:shadow-[0_6px_20px_rgba(244,121,32,0.45)]
            transition-all duration-150
          "
        >
          Launch Application →
        </a>
        <div className="flex items-center gap-2 mt-3">
          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_0_3px_#bbf7d0]" />
          <span className="text-xs text-slate-400 font-semibold">localhost:{app.port}</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e8e4de] shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <img src="/ascentt.png" alt="Ascentt" className="h-9 object-contain" />
          <span className="text-xs font-semibold text-[#58595B] bg-[#FEF3E8] border border-[#FBCFA4] rounded-full px-4 py-1.5 tracking-wide">
            Unified Analytics Platform
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-12">
        <p className="text-xs font-bold uppercase tracking-[3px] text-[#F47920] mb-4">
          Welcome to Ascentt
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4">
          One Platform,{' '}
          <span className="text-[#F47920]">Three Powerful</span>
          <br />Applications
        </h1>
        <p className="text-base md:text-lg text-[#58595B] max-w-xl mx-auto leading-relaxed">
          Select an application below to launch it. Each runs independently
          with its own data, analytics and AI capabilities.
        </p>
        {/* Divider */}
        <div className="w-14 h-1 rounded-full bg-gradient-to-r from-[#F47920] to-[#D4621A] mx-auto mt-8" />
      </section>

      {/* Cards */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {APPS.map(app => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e8e4de] py-5 text-center text-xs text-slate-400">
        © 2026 Ascentt &nbsp;·&nbsp; Unified Analytics Platform &nbsp;·&nbsp; All rights reserved
      </footer>

    </div>
  )
}
