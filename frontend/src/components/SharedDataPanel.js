import React, { useState } from 'react';
import { getSharedData } from '../services/api';

const SENSORS = ['S001', 'S002', 'S003', 'S004', 'S005'];

const corrColor = v => {
  if (v === null || v === undefined || isNaN(v)) return '#94a3b8';
  if (v > 0.7) return '#16a34a';
  if (v > 0.4) return '#d97706';
  return '#dc2626';
};

const corrBg = v => {
  if (v === null || v === undefined || isNaN(v)) return '#f8fafc';
  if (v > 0.7) return '#f0fdf4';
  if (v > 0.4) return '#fffbeb';
  return '#fff1f2';
};

const corrBorder = v => {
  if (v === null || v === undefined || isNaN(v)) return '#e2e8f0';
  if (v > 0.7) return '#bbf7d0';
  if (v > 0.4) return '#fde68a';
  return '#fecaca';
};

const METRIC_LABELS = { pressure: 'Pressure', temperature: 'Temperature', flow_rate: 'Flow Rate', fuel_level: 'Fuel Level' };

function StatCard({ label, children }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function SharedDataPanel() {
  const [sensorA, setSensorA] = useState('S001');
  const [sensorB, setSensorB] = useState('S003');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  function query() {
    setLoading(true);
    getSharedData(sensorA, sensorB).then(setData).finally(() => setLoading(false));
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Select label="Sensor A" value={sensorA} onChange={setSensorA} options={SENSORS.filter(s => s !== sensorB)} />
        <div style={{ paddingBottom: 8 }}>
          <span style={{ fontSize: 16, color: '#cbd5e1', fontWeight: 400, userSelect: 'none' }}>↔</span>
        </div>
        <Select label="Sensor B" value={sensorB} onChange={setSensorB} options={SENSORS.filter(s => s !== sensorA)} />
        <button
          onClick={query}
          disabled={loading}
          style={{
            padding: '9px 24px',
            background: loading ? '#F9B37A' : '#F47920',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 13,
            boxShadow: loading ? 'none' : '0 2px 8px rgba(244,121,32,0.28)',
            transition: 'background 0.15s',
            letterSpacing: '0.2px',
          }}
        >{loading ? 'Comparing…' : 'Compare'}</button>
      </div>

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard label="Common Time Windows">
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{data.common_time_windows}</div>
            </StatCard>
            <StatCard label="Sensors Compared">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>{sensorA} ↔ {sensorB}</div>
            </StatCard>
          </div>

          {/* Correlations */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
              Metric Correlations
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(data.correlation).map(([metric, val]) => {
                const pct   = isNaN(val) ? 0 : Math.abs(val) * 100;
                const color  = corrColor(val);
                const bg     = corrBg(val);
                const border = corrBorder(val);
                return (
                  <div key={metric} style={{ background: bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{METRIC_LABELS[metric] || metric}</span>
                      <span style={{ color, fontWeight: 800, fontSize: 15 }}>{isNaN(val) ? 'N/A' : val.toFixed(3)}</span>
                    </div>
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Averages */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
              Averages
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[sensorA, sensorB].map((sid, i) => (
                <div key={sid} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {sid}
                  </div>
                  {Object.entries(i === 0 ? data.summary.sensor_a_mean : data.summary.sensor_b_mean).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#94a3b8', fontWeight: 500 }}>{METRIC_LABELS[k] || k}</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: '#fff', color: '#0f172a',
          border: '1.5px solid #e2e8f0', borderRadius: 8,
          padding: '8px 12px', fontSize: 13, fontWeight: 600,
          outline: 'none', cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: 28,
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
