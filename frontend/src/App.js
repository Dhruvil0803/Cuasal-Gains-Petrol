import React, { useEffect, useState } from 'react';
import SensorCard from './components/SensorCard';
import SensorChart from './components/SensorChart';
import CombinedChart from './components/CombinedChart';
import GraphView from './components/GraphView';
import SharedDataPanel from './components/SharedDataPanel';
import { getSensors } from './services/api';

const TABS = ['Overview', 'Graph', 'Analysis'];

const STATUS_BADGE = {
  normal:   { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  warning:  { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  critical: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
};

/* Ascentt logo */
function AscenttLogo({ height = 32 }) {
  return <img src="/ascentt.png" alt="Ascentt" style={{ height, width: 'auto', display: 'block' }} />;
}

export default function App() {
  const [sensors, setSensors]         = useState([]);
  const [selectedSensor, setSelected] = useState('S001');
  const [activeTab, setActiveTab]     = useState('Overview');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    getSensors()
      .then(data => { setSensors(data); setLoading(false); })
      .catch(() => setLoading(false));
    const id = setInterval(() => { getSensors().then(setSensors); }, 30000);
    return () => clearInterval(id);
  }, []);

  const statusCounts = sensors.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f5', color: '#2d2d2d', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #ede9e3',
        boxShadow: '0 1px 8px rgba(244,121,32,0.07)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        height: 62,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 0,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 40, flexShrink: 0 }}>
          <AscenttLogo height={34} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: '#ede9e3', marginRight: 32, flexShrink: 0 }} />

        {/* Tab nav */}
        <nav style={{ display: 'flex', gap: 0, height: '100%' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                height: '100%',
                padding: '0 20px',
                border: 'none',
                borderBottom: activeTab === tab ? '2.5px solid #F47920' : '2.5px solid transparent',
                background: 'transparent',
                color: activeTab === tab ? '#F47920' : '#64748b',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 13,
                letterSpacing: '0.1px',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >{tab}</button>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href="http://localhost:3000"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 13px', borderRadius: 8,
              border: '1px solid #ede9e3', background: '#f8f7f5',
              color: '#58595B', fontWeight: 700, fontSize: 12,
              textDecoration: 'none', flexShrink: 0,
            }}
          >
            ← Go to Home
          </a>
          <div style={{ width: 1, height: 20, background: '#ede9e3', margin: '0 4px' }} />
          {Object.entries(statusCounts).map(([status, count]) => {
            const s = STATUS_BADGE[status] || { bg: '#f8f7f5', text: '#64748b', dot: '#94a3b8' };
            return (
              <span key={status} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: s.bg, color: s.text,
                fontSize: 11, fontWeight: 700,
                padding: '4px 10px', borderRadius: 20,
                letterSpacing: '0.3px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                {count} {status}
              </span>
            );
          })}

          <div style={{ width: 1, height: 20, background: '#ede9e3', margin: '0 6px' }} />

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 10px' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 0 2px #86efac',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>Live</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 120, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <AscenttLogo height={48} />
            </div>
            <div style={{ fontWeight: 600, color: '#58595B', fontSize: 14 }}>Connecting to sensor network…</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Fetching real-time pipeline data</div>
          </div>
        ) : (
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                sensors={sensors}
                selectedSensor={selectedSensor}
                onSelectSensor={setSelected}
              />
            )}
            {activeTab === 'Graph' && <GraphView />}
            {activeTab === 'Analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section title="All Sensors — Comparative View" subtitle="Last 60 readings per sensor overlaid">
                  <CombinedChart />
                </Section>
                <Section title="Sensor Correlation Analysis" subtitle="Shared data across overlapping time windows">
                  <SharedDataPanel />
                </Section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────────────── */
function Section({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ede9e3', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #f8f7f5' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2d2d2d', letterSpacing: '-0.2px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

/* ── Overview tab ─────────────────────────────────────────────────────────── */
function OverviewTab({ sensors, selectedSensor, onSelectSensor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2d2d2d', letterSpacing: '-0.3px' }}>Sensor Overview</h2>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{sensors.length} sensors active</span>
      </div>

      {/* Sensor cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {sensors.map(s => (
          <SensorCard key={s.sensor_id} sensor={s} onClick={onSelectSensor} selected={s.sensor_id === selectedSensor} />
        ))}
      </div>

      {/* Selected sensor chart */}
      {selectedSensor && (
        <Section
          title={`Sensor ${selectedSensor} — Time Series`}
          subtitle="Click any card above to switch sensor"
        >
          <SensorChart sensorId={selectedSensor} />
        </Section>
      )}

      {/* Combined chart */}
      <Section title="All Sensors — Comparative View" subtitle="Last 60 readings per sensor overlaid">
        <CombinedChart />
      </Section>
    </div>
  );
}
