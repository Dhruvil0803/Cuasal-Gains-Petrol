import React from 'react';

const STATUS = {
  normal:   { accent: '#22c55e', accentDim: '#dcfce7', badgeBg: '#f0fdf4', badgeText: '#15803d', borderColor: '#d1fae5' },
  warning:  { accent: '#f59e0b', accentDim: '#fef3c7', badgeBg: '#fffbeb', badgeText: '#b45309', borderColor: '#fde68a' },
  critical: { accent: '#ef4444', accentDim: '#fee2e2', badgeBg: '#fff1f2', badgeText: '#dc2626', borderColor: '#fecaca' },
};

function MetricRow({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
        {value}
        <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500, marginLeft: 2 }}>{unit}</span>
      </span>
    </div>
  );
}

export default function SensorCard({ sensor, onClick, selected }) {
  const s = STATUS[sensor.status] || STATUS.normal;

  return (
    <div
      onClick={() => onClick(sensor.sensor_id)}
      style={{
        background: '#ffffff',
        border: `1.5px solid ${selected ? '#F9B37A' : s.borderColor}`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.18s',
        boxShadow: selected
          ? '0 0 0 3px #FBCFA4, 0 6px 20px rgba(244,121,32,0.12)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        transform: selected ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: 3, background: s.accent, opacity: selected ? 1 : 0.7 }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 }}>
              {sensor.sensor_id}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
              {sensor.name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 400 }}>
              {sensor.location}
            </div>
          </div>
          <span style={{
            background: s.badgeBg,
            color: s.badgeText,
            fontSize: 9, fontWeight: 800,
            padding: '3px 9px', borderRadius: 20,
            textTransform: 'uppercase', letterSpacing: '0.6px',
            flexShrink: 0,
          }}>{sensor.status}</span>
        </div>

        {/* Metrics */}
        <div style={{ borderTop: '1px solid #f8fafc' }}>
          <MetricRow label="Pressure"   value={sensor.latest.pressure}    unit="bar" />
          <MetricRow label="Temp"       value={sensor.latest.temperature} unit="°C"  />
          <MetricRow label="Flow Rate"  value={sensor.latest.flow_rate}   unit="L/m" />
          <MetricRow label="Fuel Level" value={sensor.latest.fuel_level}  unit="%"   />
        </div>
      </div>
    </div>
  );
}
