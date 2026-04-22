import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getSensorData } from '../services/api';

const METRICS = [
  { key: 'pressure',    label: 'Pressure',    unit: 'bar', color: '#F47920' },
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: '#d97706' },
  { key: 'flow_rate',   label: 'Flow Rate',   unit: 'L/m', color: '#16a34a' },
  { key: 'fuel_level',  label: 'Fuel Level',  unit: '%',   color: '#FB923C' },
];

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
    }}>
      <p style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, fontWeight: 600, letterSpacing: '0.3px' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontSize: 14, margin: 0, fontWeight: 800 }}>
          {p.value} <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>{unit}</span>
        </p>
      ))}
    </div>
  );
};

export default function SensorChart({ sensorId }) {
  const [data, setData]       = useState([]);
  const [metric, setMetric]   = useState('pressure');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sensorId) return;
    setLoading(true);
    getSensorData(sensorId, 60)
      .then(res => setData(res.data.map(d => ({ ...d, time: d.timestamp.substring(5, 16) }))))
      .finally(() => setLoading(false));
  }, [sensorId]);

  const selected = METRICS.find(m => m.key === metric);

  return (
    <div>
      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: `1.5px solid ${metric === m.key ? m.color : '#e2e8f0'}`,
              background: metric === m.key ? m.color + '12' : '#fff',
              color: metric === m.key ? m.color : '#64748b',
              cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: 80, fontSize: 13, fontWeight: 500 }}>
          Loading sensor data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={selected.color} stopOpacity={0.12} />
                <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#cbd5e1', fontSize: 10 }} interval={9} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip unit={selected.unit} />} />
            <Area
              type="monotone"
              dataKey={metric}
              name={selected.label}
              stroke={selected.color}
              strokeWidth={2}
              fill={`url(#grad-${metric})`}
              dot={false}
              activeDot={{ r: 4, fill: selected.color, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
