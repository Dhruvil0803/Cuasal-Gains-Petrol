import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCombined } from '../services/api';

const SENSOR_COLORS = {
  S001: '#F47920', S002: '#16a34a', S003: '#d97706', S004: '#dc2626', S005: '#FB923C',
};
const METRICS = ['pressure', 'temperature', 'flow_rate', 'fuel_level'];
const METRIC_LABELS = { pressure: 'Pressure', temperature: 'Temperature', flow_rate: 'Flow Rate', fuel_level: 'Fuel Level' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
      <p style={{ color: '#94a3b8', fontSize: 10, marginBottom: 8, fontWeight: 600, letterSpacing: '0.3px' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{p.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginLeft: 'auto', paddingLeft: 12 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function CombinedChart() {
  const [rawData, setRawData] = useState([]);
  const [metric, setMetric]   = useState('pressure');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCombined(60).then(d => { setRawData(d); setLoading(false); });
  }, []);

  const pivoted = React.useMemo(() => {
    const map = {};
    rawData.forEach(row => {
      const key = row.timestamp.substring(5, 16);
      if (!map[key]) map[key] = { time: key };
      map[key][row.sensor_id] = row[metric];
    });
    return Object.values(map).sort((a, b) => a.time.localeCompare(b.time)).slice(-60);
  }, [rawData, metric]);

  const sensors = [...new Set(rawData.map(r => r.sensor_id))];

  return (
    <div>
      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {METRICS.map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: `1.5px solid ${metric === m ? '#F47920' : '#e2e8f0'}`,
              background: metric === m ? '#F4792012' : '#fff',
              color: metric === m ? '#F47920' : '#64748b',
              cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >{METRIC_LABELS[m]}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60, fontSize: 13, fontWeight: 500 }}>Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pivoted} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#cbd5e1', fontSize: 10 }} interval={14} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
              formatter={(value) => <span style={{ color: '#64748b', fontWeight: 600 }}>{value}</span>}
            />
            {sensors.map(sid => (
              <Line key={sid} type="monotone" dataKey={sid} name={sid}
                stroke={SENSOR_COLORS[sid] || '#94a3b8'}
                strokeWidth={2} dot={false} connectNulls
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
