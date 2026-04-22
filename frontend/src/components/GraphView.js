import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGraphData, getAnomaly, getEventImpact, getLiveHazards, sendChat } from '../services/api';

// ── Chat message formatter ────────────────────────────────────────────────────
function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin:'6px 0 6px 0', paddingLeft:16, listStyle:'none' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:3 }}>
              <span style={{ color:'#F9B37A', fontWeight:800, flexShrink:0, marginTop:1 }}>·</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} style={{ fontWeight:700, color:'#0f172a' }}>{part.slice(2,-2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} style={{ background:'#f1f5f9', color:'#F47920', padding:'1px 5px', borderRadius:4, fontSize:10.5, fontFamily:'monospace' }}>{part.slice(1,-1)}</code>;
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); elements.push(<div key={`br-${idx}`} style={{ height:4 }} />); return; }
    // Bullet line
    if (/^[-•*]\s+/.test(trimmed)) { listItems.push(trimmed.replace(/^[-•*]\s+/, '')); return; }
    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) { listItems.push(trimmed.replace(/^\d+\.\s+/, '')); return; }
    flushList();
    // Section header (all caps or ends with colon and short)
    if (/^#{1,3}\s/.test(trimmed)) {
      const hText = trimmed.replace(/^#{1,3}\s/, '');
      elements.push(<div key={idx} style={{ fontWeight:800, fontSize:11, color:'#D4621A', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:8, marginBottom:4, paddingBottom:3, borderBottom:'1px solid #FDD8B0' }}>{hText}</div>);
      return;
    }
    // Bold-only line as section heading
    if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
      const hText = trimmed.replace(/^\*\*|\*\*:?$/g, '');
      elements.push(<div key={idx} style={{ fontWeight:800, fontSize:11, color:'#D4621A', marginTop:8, marginBottom:3 }}>{hText}</div>);
      return;
    }
    elements.push(<div key={idx} style={{ marginBottom:2 }}>{renderInline(trimmed)}</div>);
  });
  flushList();
  return <div style={{ fontSize:11.5, lineHeight:1.65 }}>{elements}</div>;
}

// ── Node type metadata ────────────────────────────────────────────────────────
const TYPE_META = {
  well:                { color: '#F47920', size: 26, abbr: 'W',  label: 'Well' },
  pump_station:        { color: '#F47920', size: 34, abbr: 'PS', label: 'Pump Station' },
  compressor_station:  { color: '#8b5cf6', size: 36, abbr: 'CS', label: 'Compressor' },
  pipeline_junction:   { color: '#d97706', size: 32, abbr: 'PJ', label: 'Junction' },
  metering_station:    { color: '#0891b2', size: 30, abbr: 'MS', label: 'Meter Station' },
  storage_tank:        { color: '#059669', size: 38, abbr: 'ST', label: 'Storage Tank' },
  refinery:            { color: '#dc2626', size: 52, abbr: 'RF', label: 'Refinery' },
  terminal:            { color: '#ea580c', size: 46, abbr: 'TR', label: 'Terminal' },
  distribution_center: { color: '#65a30d', size: 40, abbr: 'DC', label: 'Distribution' },
  field_office:        { color: '#64748b', size: 28, abbr: 'FO', label: 'Field Office' },
};

const STATUS_RING = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };
const RISK_COLORS = { normal: '#22c55e', watch: '#f59e0b', warning: '#f97316', critical: '#ef4444' };
const RISK_BG     = { normal: '#f0fdf4', watch: '#fffbeb', warning: '#fff7ed', critical: '#fef2f2' };
const RISK_BORDER = { normal: '#bbf7d0', watch: '#fde68a', warning: '#fed7aa', critical: '#fecaca' };
// Ascentt orange scale for external events
const EVT_COLORS  = { critical: '#D4621A', warning: '#F47920', watch: '#FB923C', normal: '#94a3b8' };
const EVT_BG      = { critical: '#FEF3E8', warning: '#FFF7F0', watch: '#FFF7F0', normal: '#f8fafc' };
const EVT_BORDER  = { critical: '#FBCFA4', warning: '#FDD8B0', watch: '#FDE8C8', normal: '#f1f5f9' };

const TYPE_KEYS  = Object.keys(TYPE_META);
const TREND_ICON  = { rising: '↑', stable: '→', falling: '↓' };
const TREND_COLOR = { rising: '#ef4444', stable: '#94a3b8', falling: '#F47920' };

const EVENT_TYPES = [
  { type: 'hurricane',   name: 'Hurricane'    },
  { type: 'earthquake',  name: 'Earthquake'   },
  { type: 'winter_storm',name: 'Winter Storm' },
  { type: 'extreme_heat',name: 'Extreme Heat' },
  { type: 'flood',       name: 'Flash Flood'  },
  { type: 'power_outage',name: 'Power Outage' },
  { type: 'wildfire',    name: 'Wildfire'     },
  { type: 'cyberattack', name: 'Cyber Attack' },
];

function lightenHex(hex, amt = 55) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Build divIcon — anomaly states take priority over event states ─────────────
function buildIcon(node, { isSelected, isRemoved, isDirect, isImpacted, isDragged, eventRisk, readOnly }) {
  const tm = TYPE_META[node.type] || TYPE_META.well;
  let size      = tm.size;
  let baseColor = tm.color;

  if (isRemoved)                       { baseColor = '#dc2626'; size += 6; }
  else if (isDirect)                   { baseColor = '#d97706'; size += 4; }
  else if (isImpacted)                 { baseColor = '#fbbf24'; size += 2; }
  else if (eventRisk === 'critical')   { baseColor = '#F47920'; size += 4; }
  else if (eventRisk === 'warning')    { baseColor = '#F47920'; size += 2; }
  else if (eventRisk === 'watch')      { baseColor = '#FB923C'; }
  if (isSelected) { size += 4; }

  const lightColor = lightenHex(baseColor, 60);
  const dotColor   = STATUS_RING[node.status] || '#22c55e';
  const dotSize    = Math.max(9, Math.round(size * 0.24));
  const dotOff     = -Math.round(dotSize * 0.35);

  const ringColor = isSelected  ? 'rgba(255,255,255,0.95)'
                  : isRemoved   ? 'rgba(255,180,180,0.85)'
                  : isDragged   ? 'rgba(250,220,120,0.95)'
                  : eventRisk   ? 'rgba(220,200,255,0.90)'
                  : 'rgba(255,255,255,0.65)';
  const ringWidth = isSelected ? 3 : (isRemoved || isDragged || eventRisk) ? 2.5 : 2;

  const shadow = isSelected
    ? `0 0 0 5px ${baseColor}55, 0 0 18px ${baseColor}88, 0 4px 14px rgba(0,0,0,0.45)`
    : isRemoved || isDirect
      ? `0 0 0 3px ${baseColor}55, 0 4px 12px rgba(0,0,0,0.4)`
      : eventRisk
        ? `0 0 0 4px ${baseColor}44, 0 0 12px ${baseColor}66, 0 4px 12px rgba(0,0,0,0.35)`
        : isDragged
          ? `0 0 0 3px #f59e0b44, 0 4px 14px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.35)';

  const abbrSize = size >= 46 ? 13 : size >= 38 ? 11 : size >= 32 ? 9.5 : size >= 26 ? 8 : 7;
  const idNum    = node.id.replace(/^[A-Z]+0*/, '') || '0';
  const idSize   = size >= 46 ? 10 : size >= 38 ? 9 : size >= 32 ? 8 : 7;

  const pinDot = isDragged
    ? `<div style="position:absolute;bottom:${dotOff}px;left:${dotOff}px;width:8px;height:8px;border-radius:50%;background:#f59e0b;border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`
    : '';

  const html = `
<div style="
  width:${size}px;height:${size}px;border-radius:50%;
  background:radial-gradient(circle at 36% 32%, ${lightColor} 0%, ${baseColor} 62%, ${baseColor}cc 100%);
  border:${ringWidth}px solid ${ringColor};
  box-shadow:${shadow};
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  cursor:${readOnly ? 'pointer' : 'grab'};position:relative;box-sizing:border-box;
">
  <span style="font-size:${abbrSize}px;font-weight:900;color:rgba(255,255,255,0.97);font-family:system-ui,-apple-system,sans-serif;line-height:1;letter-spacing:-0.3px;">${tm.abbr}</span>
  <span style="font-size:${idSize}px;font-weight:700;color:rgba(255,255,255,0.82);font-family:system-ui;line-height:1;margin-top:1.5px;">${idNum}</span>
  <div style="
    position:absolute;width:${dotSize}px;height:${dotSize}px;border-radius:50%;
    background:${dotColor};border:${Math.max(1.5, dotSize*0.28)}px solid white;
    top:${dotOff}px;right:${dotOff}px;box-shadow:0 1px 4px rgba(0,0,0,0.35);
  "></div>
  ${pinDot}
</div>`;

  return L.divIcon({ html, className: 'neo4j-icon', iconSize: [size,size], iconAnchor: [size/2,size/2], tooltipAnchor: [Math.ceil(size/2)+6,0] });
}

// ── Ghost icon at original position ──────────────────────────────────────────
function buildGhostIcon(node) {
  const tm   = TYPE_META[node.type] || TYPE_META.well;
  const size = Math.max(20, tm.size - 6);
  const fs   = size >= 32 ? 9 : size >= 26 ? 8 : 7;
  const html = `
<div style="width:${size}px;height:${size}px;border-radius:50%;background:${tm.color}28;border:1.5px dashed ${tm.color}90;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,0.15);">
  <span style="font-size:${fs}px;font-weight:800;color:${tm.color}bb;font-family:system-ui;">${tm.abbr}</span>
</div>`;
  return L.divIcon({ html, className: 'ghost-icon', iconSize: [size,size], iconAnchor: [size/2,size/2], tooltipAnchor: [size/2+4,0] });
}

// ── Track zoom ────────────────────────────────────────────────────────────────
function MapZoomTracker({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
    const h = () => onZoomChange(map.getZoom());
    map.on('zoomend', h);
    return () => { map.off('zoomend', h); };
  }, [map, onZoomChange]);
  return null;
}

// ── Auto-fit ──────────────────────────────────────────────────────────────────
function FitBounds({ nodes }) {
  const map = useMap();
  useEffect(() => {
    if (!nodes.length) return;
    const lats = nodes.map(n => n.lat), lngs = nodes.map(n => n.lng);
    map.fitBounds([[Math.min(...lats)-0.5, Math.min(...lngs)-0.5],[Math.max(...lats)+0.5, Math.max(...lngs)+0.5]], { padding: [40,40] });
  }, [nodes.length]); // eslint-disable-line
  return null;
}

// ── Node tooltip ──────────────────────────────────────────────────────────────
function NodeTooltip({ node, eventData, comparisonMode }) {
  const sc = STATUS_RING[node.status] || '#22c55e';
  return (
    <div style={{ fontFamily: 'system-ui', minWidth: 190 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{node.id}</span>
        <span style={{ background: sc+'22', color: sc, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10 }}>
          {(node.status||'').toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, marginBottom: 1 }}>{node.label}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 7 }}>{(node.type||'').replace(/_/g,' ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 3, columnGap: 10, fontSize: 11 }}>
        {[['Pressure',node.metrics?.pressure,'bar'],['Flow',node.metrics?.flow_rate,'L/m'],
          ['Fuel',node.metrics?.fuel_level,'%'],['Temp',node.metrics?.temperature,'°C']].map(([l,v,u]) => (
          <React.Fragment key={l}>
            <span style={{ color: '#64748b' }}>{l}</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{v} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{u}</span></span>
          </React.Fragment>
        ))}
      </div>
      {eventData && (
        <div style={{ marginTop: 7, padding: '5px 8px', background: EVT_BG[eventData.risk_level], borderRadius: 6, border: `1px solid ${EVT_BORDER[eventData.risk_level]}` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: EVT_COLORS[eventData.risk_level] }}>
            Event impact: {eventData.impact_score}/100 ({eventData.risk_level})
          </span>
        </div>
      )}
      <div style={{ marginTop: 7, fontSize: 10, color: '#F47920', fontWeight: 700 }}>{comparisonMode ? 'Click to switch comparison' : 'Click to detect anomalies · Drag to reposition'}</div>
    </div>
  );
}

// ── Comparison Modal ──────────────────────────────────────────────────────────
function ComparisonMap({ nodes, edges, anomaly, mode, tileUrl, tileAttr, onNodeClick }) {
  const removedId   = mode === 'modified' ? anomaly?.node_id : null;
  const highRiskIds = useMemo(() => new Set(
    mode === 'modified' ? (anomaly?.affected_nodes.filter(n => n.risk_level==='critical'||n.risk_level==='warning').map(n=>n.id)||[]) : []
  ), [anomaly, mode]);
  const watchIds = useMemo(() => new Set(
    mode === 'modified' ? (anomaly?.affected_nodes.filter(n => n.risk_level==='watch').map(n=>n.id)||[]) : []
  ), [anomaly, mode]);
  const impactedIds = useMemo(() => new Set([...highRiskIds, ...watchIds]), [highRiskIds, watchIds]);

  return (
    <MapContainer center={[32.5,-99.0]} zoom={5} style={{ height:'100%', width:'100%' }} zoomControl={true}>
      <TileLayer url={tileUrl} attribution={tileAttr} />
      <FitBounds nodes={nodes} />
      {edges.map((edge,i) => {
        const srcNode = nodes.find(n=>n.id===edge.source);
        const tgtNode = nodes.find(n=>n.id===edge.target);
        if (!srcNode||!tgtNode) return null;
        const pos = [[srcNode.lat,srcNode.lng],[tgtNode.lat,tgtNode.lng]];
        const isDirect = removedId===edge.source && impactedIds.has(edge.target);
        const isTrans  = impactedIds.has(edge.source) && impactedIds.has(edge.target) && edge.source!==removedId;
        if (isDirect||isTrans) {
          const fc = isDirect?'#ef4444':'#f59e0b';
          return <React.Fragment key={i}>
            <Polyline positions={pos} pathOptions={{ color:'#fff', weight:7, opacity:0.7 }} />
            <Polyline positions={pos} pathOptions={{ color:fc, weight:3, opacity:1, dashArray:isDirect?'9 5':undefined }} />
          </React.Fragment>;
        }
        return <React.Fragment key={i}>
          <Polyline positions={pos} pathOptions={{ color:'#fff', weight:5, opacity:0.7 }} />
          <Polyline positions={pos} pathOptions={{ color:'#F47920', weight:2.5, opacity:0.8 }} />
        </React.Fragment>;
      })}
      {nodes.map(node => {
        const isRemoved  = node.id === removedId;
        const isDirect   = highRiskIds.has(node.id);
        const isImpacted = impactedIds.has(node.id) && !isDirect;
        const isSelected = mode === 'original' && node.id === anomaly?.node_id;
        const icon = buildIcon(node, { isSelected, isRemoved, isDirect, isImpacted, isDragged:false, eventRisk:null, readOnly:true });
        const zOffset = isSelected?2000:isRemoved?1800:isDirect?1600:isImpacted?1400:0;
        return (
          <Marker key={node.id} position={[node.lat,node.lng]} icon={icon} zIndexOffset={zOffset}
            eventHandlers={{ click: () => onNodeClick && node.id !== anomaly?.node_id && onNodeClick(node) }}>
            <Tooltip direction="top" opacity={1}><NodeTooltip node={node} eventData={null} comparisonMode /></Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function ComparisonModal({ graphData, anomaly, mapStyle, onClose, onNodeClick }) {
  const TILES = {
    street:    { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                                             attr:'© OpenStreetMap contributors' },
    satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
    dark:      { url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                  attr:'© CARTO' },
  };
  const tile    = TILES[mapStyle] || TILES.street;
  const nodes   = useMemo(() => graphData.nodes.filter(n => n.lat && n.lng), [graphData]);
  const nodeIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);
  const edges   = useMemo(() => graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)), [graphData, nodeIds]);

  // ── Stats derivations ──────────────────────────────────────────────────────
  const removedId   = anomaly.node_id;
  const edgesLost   = useMemo(() => edges.filter(e => e.source===removedId || e.target===removedId).length, [edges, removedId]);
  const statusOrig  = useMemo(() => nodes.reduce((a,n) => { a[n.status]=(a[n.status]||0)+1; return a; }, {}), [nodes]);
  const typeOrig    = useMemo(() => nodes.reduce((a,n) => { a[n.type]=(a[n.type]||0)+1; return a; }, {}), [nodes]);

  const affByCrit   = useMemo(() => anomaly.affected_nodes.filter(n=>n.risk_level==='critical').length,  [anomaly]);
  const affByWarn   = useMemo(() => anomaly.affected_nodes.filter(n=>n.risk_level==='warning').length,   [anomaly]);
  const affByWatch  = useMemo(() => anomaly.affected_nodes.filter(n=>n.risk_level==='watch').length,     [anomaly]);
  const maxHop      = useMemo(() => anomaly.affected_nodes.reduce((m,n)=>Math.max(m,n.hop),0),           [anomaly]);
  const maxRisk     = useMemo(() => anomaly.affected_nodes.reduce((m,n)=>Math.max(m,n.propagated_risk),0),[anomaly]);
  const integrity   = +(((nodes.length - 1 - anomaly.total_downstream) / nodes.length) * 100).toFixed(1);
  const hopDist     = useMemo(() => {
    const d = {};
    anomaly.affected_nodes.forEach(n => { d[n.hop]=(d[n.hop]||0)+1; });
    return Object.entries(d).sort((a,b)=>+a[0]-+b[0]);
  }, [anomaly]);

  // mini stat card
  function StatCard({ label, value, sub, valueColor, accent }) {
    return (
      <div style={{ background:'#fff', borderRadius:10, padding:'10px 14px', border:`1.5px solid ${accent||'#e2e8f0'}`, minWidth:90, flex:1, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:900, color:valueColor||'#0f172a', lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:9, color:'#94a3b8', marginTop:3, fontWeight:600 }}>{sub}</div>}
      </div>
    );
  }

  // status mini-bar
  function StatusBar({ counts, total }) {
    const bars = [
      { key:'normal',   color:'#22c55e' },
      { key:'warning',  color:'#f59e0b' },
      { key:'critical', color:'#ef4444' },
    ];
    return (
      <div>
        <div style={{ display:'flex', height:6, borderRadius:4, overflow:'hidden', gap:1, marginBottom:5 }}>
          {bars.map(b => {
            const w = ((counts[b.key]||0)/total)*100;
            return w > 0 ? <div key={b.key} style={{ width:`${w}%`, background:b.color, borderRadius:2 }} /> : null;
          })}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {bars.map(b => (counts[b.key]||0) > 0 && (
            <div key={b.key} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:b.color }} />
              <span style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>{counts[b.key]} {b.key}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(15,23,42,0.55)', zIndex:9999, display:'flex', flexDirection:'column' }}>

      {/* ── Header ── */}
      <div style={{ background:'#fff', padding:'12px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, borderBottom:'2px solid #e2e8f0', boxShadow:'0 1px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#F47920,#D4621A)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:16 }}>⊞</span>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:'#0f172a', letterSpacing:-0.4 }}>Network Comparison</div>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>Structural impact analysis</div>
            </div>
          </div>
          <div style={{ width:1, height:28, background:'#e2e8f0' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ background:RISK_BG[anomaly.risk_level], border:`1px solid ${RISK_BORDER[anomaly.risk_level]}`, borderLeft:`3px solid ${RISK_COLORS[anomaly.risk_level]}`, borderRadius:6, padding:'3px 10px' }}>
              <span style={{ fontSize:11, fontWeight:800, color:RISK_COLORS[anomaly.risk_level] }}>{anomaly.node_id}</span>
            </div>
            <span style={{ fontSize:11, color:'#475569' }}>{anomaly.name} · <span style={{ textTransform:'capitalize', color:'#94a3b8' }}>{(anomaly.type||'').replace(/_/g,' ')}</span></span>
            <div style={{ background:RISK_BG[anomaly.risk_level], border:`1px solid ${RISK_BORDER[anomaly.risk_level]}`, borderRadius:20, padding:'2px 8px' }}>
              <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', color:RISK_COLORS[anomaly.risk_level] }}>{anomaly.risk_level}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', color:'#475569', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14, lineHeight:1 }}>✕</span> Close
        </button>
      </div>

      {/* ── Stats Panel ── */}
      <div style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0', padding:'14px 22px', flexShrink:0, display:'grid', gridTemplateColumns:'1fr 1px 1.2fr 1px 1fr', gap:0, alignItems:'start' }}>

        {/* Left: Original Network Stats */}
        <div style={{ paddingRight:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e' }} />
            <span style={{ fontSize:10, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:1 }}>Original Network</span>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <StatCard label="Nodes" value={nodes.length} sub="all active" valueColor="#0f172a" />
            <StatCard label="Edges" value={edges.length} sub="connections" valueColor="#0f172a" />
            <StatCard label="Integrity" value="100%" sub="baseline" valueColor="#16a34a" accent="#bbf7d0" />
          </div>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 14px', border:'1.5px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Node Status Distribution</div>
            <StatusBar counts={statusOrig} total={nodes.length} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ background:'#e2e8f0', margin:'0 4px', alignSelf:'stretch' }} />

        {/* Center: Impact Delta */}
        <div style={{ padding:'0 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#F47920', textTransform:'uppercase', letterSpacing:1 }}>Impact Analysis</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            <StatCard label="Affected" value={anomaly.total_downstream} sub="downstream nodes" valueColor="#dc2626" accent="#fecaca" />
            <StatCard label="Severed"  value={edgesLost}                sub="edges lost"       valueColor="#ea580c" accent="#fed7aa" />
            <StatCard label="Max Hop"  value={maxHop}                   sub="propagation depth" valueColor="#D4621A" accent="#FBCFA4" />
          </div>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 14px', border:'1.5px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Downstream Risk Breakdown</div>
            {[
              { label:'Critical', count:affByCrit, color:'#ef4444', total:anomaly.total_downstream },
              { label:'Warning',  count:affByWarn, color:'#f97316', total:anomaly.total_downstream },
              { label:'Watch',    count:affByWatch,color:'#f59e0b', total:anomaly.total_downstream },
            ].map(r => r.count > 0 && (
              <div key={r.label} style={{ marginBottom:5 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontSize:10, color:r.color, fontWeight:700 }}>{r.label}</span>
                  <span style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>{r.count} nodes</span>
                </div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(r.count/r.total)*100}%`, background:r.color, borderRadius:2 }} />
                </div>
              </div>
            ))}
            {hopDist.length > 0 && (
              <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #f1f5f9', display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, color:'#94a3b8', fontWeight:700, width:'100%', textTransform:'uppercase', letterSpacing:0.8, marginBottom:2 }}>By Hop Distance</span>
                {hopDist.map(([hop, cnt]) => (
                  <div key={hop} style={{ display:'flex', alignItems:'center', gap:4, background:'#f1f5f9', borderRadius:6, padding:'2px 7px', border:'1px solid #e2e8f0' }}>
                    <span style={{ fontSize:9, color:'#F47920', fontWeight:800 }}>H{hop}</span>
                    <span style={{ fontSize:9, color:'#64748b', fontWeight:600 }}>{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ background:'#e2e8f0', margin:'0 4px', alignSelf:'stretch' }} />

        {/* Right: Modified Network Stats */}
        <div style={{ paddingLeft:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444' }} />
            <span style={{ fontSize:10, fontWeight:800, color:'#dc2626', textTransform:'uppercase', letterSpacing:1 }}>Without {removedId}</span>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <StatCard label="Nodes"     value={nodes.length-1}       sub="-1 removed"           valueColor="#dc2626" accent="#fecaca" />
            <StatCard label="Edges"     value={edges.length-edgesLost} sub={`-${edgesLost} severed`} valueColor="#ea580c" accent="#fed7aa" />
            <StatCard label="Integrity" value={`${integrity}%`}      sub="network health"       valueColor={integrity>=80?'#16a34a':integrity>=60?'#d97706':'#dc2626'} accent={integrity>=80?'#bbf7d0':integrity>=60?'#fde68a':'#fecaca'} />
          </div>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 14px', border:'1.5px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Node Type Distribution</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {Object.entries(typeOrig).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([type,cnt]) => {
                const tm = TYPE_META[type];
                return (
                  <div key={type} style={{ display:'flex', alignItems:'center', gap:4, background:'#f8fafc', borderRadius:6, padding:'2px 7px', border:`1.5px solid ${tm?.color||'#e2e8f0'}33` }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:tm?.color||'#64748b' }} />
                    <span style={{ fontSize:9, color:'#475569', fontWeight:700 }}>{tm?.abbr||type}</span>
                    <span style={{ fontSize:9, color:'#94a3b8' }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #f1f5f9', display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:9, color:'#94a3b8', marginBottom:3 }}>Max propagated risk</div>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${maxRisk}%`, background:'linear-gradient(90deg,#f59e0b,#ef4444)', borderRadius:3 }} />
                </div>
              </div>
              <span style={{ fontSize:14, fontWeight:900, color:maxRisk>66?'#ef4444':maxRisk>33?'#d97706':'#16a34a' }}>{maxRisk}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Side-by-side maps ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', gap:0 }}>

        {/* Left: Original — green accent */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, borderTop:'4px solid #22c55e', borderRight:'2px solid #e2e8f0' }}>
          <div style={{ background:'#f0fdf4', padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0, borderBottom:'1.5px solid #bbf7d0' }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 2px #bbf7d0' }} />
            <span style={{ fontSize:11, fontWeight:800, color:'#15803d' }}>Original Network</span>
            <span style={{ fontSize:10, color:'#86efac', marginLeft:4 }}>All {nodes.length} nodes active · {anomaly.node_id} selected</span>
          </div>
          <div style={{ flex:1, position:'relative' }}>
            <ComparisonMap nodes={nodes} edges={edges} anomaly={anomaly} mode="original" tileUrl={tile.url} tileAttr={tile.attr} onNodeClick={onNodeClick} />
            {/* Floating badge */}
            <div style={{ position:'absolute', top:10, left:10, zIndex:1000, background:'#15803d', color:'#fff', fontSize:10, fontWeight:800, padding:'4px 10px', borderRadius:20, letterSpacing:0.5, boxShadow:'0 2px 8px rgba(0,0,0,0.18)', pointerEvents:'none' }}>
              BEFORE
            </div>
          </div>
        </div>

        {/* Right: Modified — red accent */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, borderTop:'4px solid #ef4444' }}>
          <div style={{ background:'#fef2f2', padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0, borderBottom:'1.5px solid #fecaca' }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 0 2px #fecaca' }} />
            <span style={{ fontSize:11, fontWeight:800, color:'#dc2626' }}>Without {anomaly.node_id}</span>
            <span style={{ fontSize:10, color:'#fca5a5', marginLeft:4 }}>{anomaly.total_downstream} at risk · {edgesLost} edges severed</span>
          </div>
          <div style={{ flex:1, position:'relative' }}>
            <ComparisonMap nodes={nodes} edges={edges} anomaly={anomaly} mode="modified" tileUrl={tile.url} tileAttr={tile.attr} onNodeClick={onNodeClick} />
            {/* Floating badge */}
            <div style={{ position:'absolute', top:10, left:10, zIndex:1000, background:'#dc2626', color:'#fff', fontSize:10, fontWeight:800, padding:'4px 10px', borderRadius:20, letterSpacing:0.5, boxShadow:'0 2px 8px rgba(0,0,0,0.18)', pointerEvents:'none' }}>
              AFTER REMOVAL
            </div>
            {/* Subtle red tint overlay to reinforce "danger" state */}
            <div style={{ position:'absolute', inset:0, background:'rgba(239,68,68,0.04)', pointerEvents:'none', zIndex:999 }} />
          </div>
        </div>

      </div>

      {/* ── Legend strip ── */}
      <div style={{ background:'#fff', padding:'6px 22px', display:'flex', gap:18, alignItems:'center', flexShrink:0, borderTop:'1.5px solid #e2e8f0' }}>
        {[
          { color:'#dc2626', label:'Removed node' },
          { color:'#d97706', label:'Critical downstream' },
          { color:'#f59e0b', label:'Watch downstream' },
          { color:'#F47920', label:'Unaffected' },
          { color:'#F47920', label:'Selected (left map)', dashed:true },
        ].map(({ color, label, dashed }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: dashed?'transparent':'none', border:`2px ${dashed?'dashed':'solid'} ${color}` }} />
            <span style={{ fontSize:9, color:'#64748b', fontWeight:600 }}>{label}</span>
          </div>
        ))}
        <span style={{ marginLeft:'auto', fontSize:9, color:'#cbd5e1', fontStyle:'italic' }}>Pipeline IoT Dashboard · Network Comparison View</span>
      </div>
    </div>
  );
}

// ── Typing indicator animation ────────────────────────────────────────────────
const chatPulseStyle = document.getElementById('chat-pulse-style') || (() => {
  const s = document.createElement('style');
  s.id = 'chat-pulse-style';
  s.textContent = `@keyframes pulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`;
  document.head.appendChild(s);
  return s;
})();

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GraphView() {
  const [graphData, setGraphData]               = useState(null);
  const [anomaly, setAnomaly]                   = useState(null);
  const [showComparison, setShowComparison]     = useState(false);
  const [selectedNode, setSelected]             = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [activeTypes, setActiveTypes]           = useState(new Set(TYPE_KEYS));
  const [mapStyle, setMapStyle]                 = useState('street');
  const [mapZoom, setMapZoom]                   = useState(6);
  const [draggedPositions, setDraggedPositions] = useState({});
  // Right panel tabs
  const [activeTab, setActiveTab]               = useState('anomaly');
  // Event simulator state
  const [selectedEvent, setSelectedEvent]       = useState(null);
  const [severity, setSeverity]                 = useState('high');
  const [eventImpact, setEventImpact]           = useState(null);
  const [eventLoading, setEventLoading]         = useState(false);
  // Live hazards from USGS + NOAA
  const [liveHazards, setLiveHazards]           = useState(null);
  const [hazardsLoading, setHazardsLoading]     = useState(false);
  // Chat assistant
  const [chatMessages, setChatMessages]         = useState([
    { role: 'assistant', text: 'Hello. I can help you analyze pipeline anomalies, interpret risk scores, and answer questions about network nodes. Select a node on the map or ask me anything.' }
  ]);
  const [chatInput, setChatInput]               = useState('');
  const [chatLoading, setChatLoading]           = useState(false);
  const chatEndRef                              = useRef(null);

  useEffect(() => {
    getGraphData().then(d => { setGraphData(d); setLoading(false); });
  }, []);

  useEffect(() => {
    if (activeTab === 'events' && !liveHazards && !hazardsLoading) {
      setHazardsLoading(true);
      getLiveHazards()
        .then(data => { setLiveHazards(data); setHazardsLoading(false); })
        .catch(() => setHazardsLoading(false));
    }
  }, [activeTab]); // eslint-disable-line

  const getNodePos = useCallback((node) =>
    draggedPositions[node.id] || { lat: node.lat, lng: node.lng }, [draggedPositions]);

  function handleNodeClick(node) {
    if (node.id === selectedNode) { setSelected(null); setAnomaly(null); setShowComparison(false); }
    else {
      setSelected(node.id);
      getAnomaly(node.id, selectedEvent, severity).then(data => {
        setAnomaly(data);
        // Inject a context message into chat so the assistant is aware of the selected node
        setChatMessages(prev => [
          ...prev,
          { role: 'system-info', text: `Node ${node.id} selected — ${node.label} (${(node.type||'').replace(/_/g,' ')})` }
        ]);
      });
      spreadClusterOf(node.id);
      setActiveTab('anomaly');
    }
  }

  function handleDragEnd(nodeId, e) {
    const { lat, lng } = e.target.getLatLng();
    setDraggedPositions(prev => ({ ...prev, [nodeId]: { lat, lng } }));
  }

  function toggleType(type) {
    setActiveTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; });
  }

  function runEventSimulation() {
    if (!selectedEvent) return;
    setEventLoading(true);
    getEventImpact(selectedEvent, severity).then(data => {
      setEventImpact(data);
      setEventLoading(false);
    });
  }

  function clearEvent() {
    setEventImpact(null);
    setSelectedEvent(null);
    // Re-run anomaly without event context if a node is still selected
    if (selectedNode) getAnomaly(selectedNode).then(setAnomaly);
  }

  // ── Chat assistant ────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await sendChat(text, 'graph-view-session');
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error contacting backend. Make sure the server is running.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Cluster detection & spread ─────────────────────────────────────────────
  const overlappingGroups = useMemo(() => {
    if (!graphData) return [];
    const degsPerPixel = 360 / (256 * Math.pow(2, mapZoom));
    const THRESHOLD    = degsPerPixel * 60;
    const positions    = visibleNodesForOverlap(graphData.nodes, activeTypes, draggedPositions);
    const groups = [], assigned = new Set();
    positions.forEach((pos, i) => {
      if (assigned.has(pos.id)) return;
      const group = [pos]; assigned.add(pos.id);
      positions.forEach((other, j) => {
        if (i === j || assigned.has(other.id)) return;
        if (Math.abs(pos.lat-other.lat) < THRESHOLD && Math.abs(pos.lng-other.lng) < THRESHOLD) {
          group.push(other); assigned.add(other.id);
        }
      });
      if (group.length > 1) groups.push(group);
    });
    return groups;
  }, [graphData, activeTypes, draggedPositions, mapZoom]);

  function calcSpreadPositions(group) {
    const pixelsPerDeg = (256 * Math.pow(2, mapZoom)) / 360;
    const centLat  = group.reduce((s,p) => s+p.lat, 0) / group.length;
    const centLng  = group.reduce((s,p) => s+p.lng, 0) / group.length;
    const lngFactor = Math.cos((centLat * Math.PI) / 180);
    const radius   = Math.max((group.length * 70) / (2 * Math.PI * pixelsPerDeg), 0.01);
    const out = {};
    group.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      out[node.id] = { lat: centLat + radius * Math.sin(angle), lng: centLng + (radius / lngFactor) * Math.cos(angle) };
    });
    return out;
  }

  function autoSpreadOverlapping() {
    const pos = {};
    overlappingGroups.forEach(g => Object.assign(pos, calcSpreadPositions(g)));
    setDraggedPositions(prev => ({ ...prev, ...pos }));
  }

  function spreadClusterOf(nodeId) {
    const group = overlappingGroups.find(g => g.some(n => n.id === nodeId));
    if (!group) return;
    setDraggedPositions(prev => ({ ...prev, ...calcSpreadPositions(group) }));
  }

  // ── Anomaly map sets ───────────────────────────────────────────────────────
  const highRiskSet = useMemo(() =>
    new Set(anomaly ? anomaly.affected_nodes.filter(n => n.risk_level==='critical'||n.risk_level==='warning').map(n=>n.id) : []), [anomaly]);
  const watchSet    = useMemo(() =>
    new Set(anomaly ? anomaly.affected_nodes.filter(n => n.risk_level==='watch').map(n=>n.id) : []), [anomaly]);
  const directSet   = highRiskSet;
  const impactedSet = useMemo(() => new Set([...highRiskSet,...watchSet]), [highRiskSet,watchSet]);
  const removedId   = anomaly?.node_id ?? null;

  // ── Event impact map — nodeId → { impact_score, risk_level } ──────────────
  const eventNodeMap = useMemo(() => {
    if (!eventImpact) return {};
    return Object.fromEntries(eventImpact.affected_nodes.map(n => [n.id, n]));
  }, [eventImpact]);

  const visibleNodes = useMemo(() =>
    graphData ? graphData.nodes.filter(n => n.lat && n.lng && activeTypes.has(n.type)) : [], [graphData, activeTypes]);
  const visibleIds   = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() =>
    graphData ? graphData.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)) : [], [graphData, visibleIds]);

  const draggedCount = Object.keys(draggedPositions).length;

  const TILES = {
    street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',            attr: '© OpenStreetMap contributors' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
    dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  };

  const statusCounts = useMemo(() => {
    if (!graphData) return {};
    return graphData.nodes.reduce((a,n) => { a[n.status]=(a[n.status]||0)+1; return a; }, {});
  }, [graphData]);

  return (
    <>
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

      {/* ── Map ── */}
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ background: '#fafafa', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3, marginRight: 6 }}>
            {Object.keys(TILES).map(s => (
              <button key={s} onClick={() => setMapStyle(s)} style={{ padding:'4px 11px', borderRadius:6, border:'1.5px solid', borderColor: mapStyle===s?'#F47920':'#e2e8f0', background: mapStyle===s?'#FEF3E8':'#fff', color: mapStyle===s?'#D4621A':'#64748b', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ width:1, height:18, background:'#e2e8f0', marginRight:2 }} />
          {TYPE_KEYS.map(type => {
            const m=TYPE_META[type], on=activeTypes.has(type);
            return (
              <button key={type} onClick={() => toggleType(type)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, border:'1.5px solid', borderColor: on?m.color:'#e2e8f0', background: on?m.color+'15':'#fafafa', color: on?m.color:'#94a3b8', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: on?m.color:'#cbd5e1' }} />{m.label}
              </button>
            );
          })}
          <div style={{ marginLeft:'auto', display:'flex', gap:5, alignItems:'center' }}>
            {overlappingGroups.length > 0 && (
              <button onClick={autoSpreadOverlapping} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:6, border:'1.5px solid #F47920', background:'#FEF3E8', color:'#D4621A', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                <span style={{ fontSize:13 }}>⊕</span> Spread {overlappingGroups.length} cluster{overlappingGroups.length!==1?'s':''}
              </button>
            )}
            {draggedCount > 0 && (
              <button onClick={() => setDraggedPositions({})} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:6, border:'1.5px solid #e2e8f0', background:'#fff', color:'#64748b', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                <span>↺</span> Reset ({draggedCount})
              </button>
            )}
            {/* Event active indicator */}
            {selectedEvent && (
              <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, background:'#FEF3E8', border:'1.5px solid #FBCFA4' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#F47920' }}>{EVENT_TYPES.find(e=>e.type===selectedEvent)?.name} active</span>
                <span style={{ fontSize:9, color:'#F9B37A', fontWeight:600, textTransform:'capitalize' }}>· {severity}</span>
                <button onClick={clearEvent} style={{ background:'none', border:'none', cursor:'pointer', color:'#F9B37A', fontSize:14, lineHeight:1, padding:0 }}>×</button>
              </div>
            )}
          </div>
        </div>

        {/* Map container */}
        {loading ? (
          <div style={{ height:580, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', flexDirection:'column', gap:12, background:'#f8fafc' }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#F47920,#D4621A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 4px 14px rgba(244,121,32,0.28)' }}>⛽</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>Loading pipeline network…</div>
            <div style={{ fontSize:11, color:'#cbd5e1' }}>Fetching 100 nodes</div>
          </div>
        ) : (
          <MapContainer center={[32.5,-99.0]} zoom={6} style={{ height:580, width:'100%' }} zoomControl>
            <TileLayer url={TILES[mapStyle].url} attribution={TILES[mapStyle].attr} />
            <FitBounds nodes={visibleNodes} />
            <MapZoomTracker onZoomChange={setMapZoom} />

            {/* Pipeline edges */}
            {visibleEdges.map((edge,i) => {
              const srcNode = graphData.nodes.find(n=>n.id===edge.source);
              const tgtNode = graphData.nodes.find(n=>n.id===edge.target);
              if (!srcNode||!tgtNode) return null;
              const srcPos = draggedPositions[edge.source]||{lat:srcNode.lat,lng:srcNode.lng};
              const tgtPos = draggedPositions[edge.target]||{lat:tgtNode.lat,lng:tgtNode.lng};
              const pos    = [[srcPos.lat,srcPos.lng],[tgtPos.lat,tgtPos.lng]];
              const isDirect = removedId===edge.source && impactedSet.has(edge.target);
              const isTrans  = impactedSet.has(edge.source) && impactedSet.has(edge.target) && edge.source!==removedId;
              if (isDirect||isTrans) {
                const fc = isDirect?'#ef4444':'#f59e0b';
                return <React.Fragment key={i}>
                  <Polyline positions={pos} pathOptions={{ color:'#fff', weight:8, opacity:0.7 }} />
                  <Polyline positions={pos} pathOptions={{ color:fc, weight:4, opacity:1, dashArray:isDirect?'10 6':undefined }} />
                </React.Fragment>;
              }
              const lc = mapStyle==='dark'?'#F9B37A':'#F47920';
              const oc = mapStyle==='dark'?'#1e293b':'#ffffff';
              return <React.Fragment key={i}>
                <Polyline positions={pos} pathOptions={{ color:oc, weight:6, opacity:0.75 }} />
                <Polyline positions={pos} pathOptions={{ color:lc, weight:3, opacity:0.82 }} />
              </React.Fragment>;
            })}

            {/* Ghost markers for dragged nodes */}
            {visibleNodes.filter(node=>draggedPositions[node.id]).map(node => {
              const orig  = {lat:node.lat,lng:node.lng};
              const moved = draggedPositions[node.id];
              return (
                <React.Fragment key={`ghost-${node.id}`}>
                  <Polyline positions={[[orig.lat,orig.lng],[moved.lat,moved.lng]]} pathOptions={{ color:'#94a3b8', weight:1.5, opacity:0.65, dashArray:'5 5' }} />
                  <Marker position={[orig.lat,orig.lng]} icon={buildGhostIcon(node)} zIndexOffset={-500}
                    eventHandlers={{ click:()=>setDraggedPositions(prev=>{const n={...prev};delete n[node.id];return n;}) }}>
                    <Tooltip direction="top" opacity={1}>
                      <div style={{ fontFamily:'system-ui', fontSize:11, minWidth:140 }}>
                        <div style={{ fontWeight:800, color:'#0f172a', marginBottom:2 }}>{node.id} — original</div>
                        <div style={{ fontSize:10, color:'#64748b', marginBottom:5 }}>{node.label}</div>
                        <div style={{ fontSize:10, color:'#F47920', fontWeight:700 }}>Click to snap back →</div>
                      </div>
                    </Tooltip>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* Main node markers */}
            {visibleNodes.map(node => {
              const isRemoved  = node.id === removedId;
              const isDirect   = directSet.has(node.id);
              const isImpacted = impactedSet.has(node.id) && !isDirect;
              const isSelected = selectedNode === node.id;
              const isDragged  = !!draggedPositions[node.id];
              const eventData  = eventNodeMap[node.id];
              // Only apply event color if no anomaly state is active for this node
              const eventRisk  = (!isRemoved && !isDirect && !isImpacted && eventData?.risk_level !== 'normal')
                                  ? eventData?.risk_level : null;
              const icon    = buildIcon(node, { isSelected, isRemoved, isDirect, isImpacted, isDragged, eventRisk });
              const zOffset = isSelected?2000:isRemoved?1800:isDirect?1600:isImpacted?1400:eventRisk?1200:0;
              const pos     = getNodePos(node);
              return (
                <Marker
                  key={`${node.id}-${isSelected}-${isRemoved}-${isDirect}-${isImpacted}-${isDragged}-${eventRisk}`}
                  position={[pos.lat,pos.lng]} icon={icon} draggable zIndexOffset={zOffset}
                  eventHandlers={{ click:()=>handleNodeClick(node), dragend:(e)=>handleDragEnd(node.id,e) }}
                >
                  <Tooltip direction="top" offset={[0,0]} opacity={1} sticky={false}>
                    <NodeTooltip node={node} eventData={eventData?.risk_level!=='normal'?eventData:null} />
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        {/* Status bar */}
        {graphData && (
          <div style={{ background:'#fafafa', padding:'7px 14px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:11, color:'#94a3b8', fontWeight:500 }}>
              <strong style={{ color:'#0f172a', fontWeight:700 }}>{visibleNodes.length}</strong>/{graphData.nodes.length} nodes
              <span style={{ margin:'0 4px', color:'#e2e8f0' }}>·</span>
              <strong style={{ color:'#0f172a', fontWeight:700 }}>{visibleEdges.length}</strong> edges
            </span>
            {draggedCount===0
              ? <span style={{ fontSize:10, color:'#F9B37A', fontStyle:'italic', fontWeight:500 }}>Drag any node · ⊕ Spread clusters</span>
              : <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700 }}>{draggedCount} node{draggedCount!==1?'s':''} repositioned</span>}
            {/* Map legend for active layers */}
            <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
              {eventImpact && <>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#F47920' }} />
                  <span style={{ fontSize:10, color:'#F47920', fontWeight:700 }}>Critical event</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#FB923C' }} />
                  <span style={{ fontSize:10, color:'#FB923C', fontWeight:700 }}>Watch/Warning</span>
                </div>
              </>}
              {Object.entries(statusCounts).map(([st,cnt]) => (
                <div key={st} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:STATUS_RING[st] }} />
                  <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{cnt} {st}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel with tabs ── */}
      <div style={{ width:320, flexShrink:0, background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden', maxHeight:720 }}>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
          {[
            { key:'anomaly', label:'Anomaly Detection' },
            { key:'events',  label:'Event Simulator'  },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex:1, padding:'13px 6px', border:'none',
              borderBottom: activeTab===tab.key?'2.5px solid #F47920':'2.5px solid transparent',
              background:'transparent',
              color: activeTab===tab.key?'#F47920':'#94a3b8',
              fontSize:11, fontWeight: activeTab===tab.key?800:500,
              cursor:'pointer', transition:'color 0.15s, border-color 0.15s',
              letterSpacing:'0.2px',
            }}>{tab.label}</button>
          ))}
        </div>

        <div style={{ padding:20, overflowY:'auto', maxHeight:660 }}>

          {/* ── ANOMALY TAB ── */}
          {activeTab === 'anomaly' && (
            <>
              {!anomaly ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🔍</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:4 }}>Select a node</div>
                    <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.6 }}>Click any node on the map to run predictive anomaly analysis and see downstream risk propagation.</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Node header */}
                  <div style={{ background:RISK_BG[anomaly.risk_level], border:`1px solid ${RISK_BORDER[anomaly.risk_level]}`, borderLeft:`4px solid ${RISK_COLORS[anomaly.risk_level]}`, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:16, color:RISK_COLORS[anomaly.risk_level] }}>{anomaly.node_id}</div>
                        <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{anomaly.name}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{(anomaly.type||'').replace(/_/g,' ')}</div>
                      </div>
                      <span style={{ background:RISK_COLORS[anomaly.risk_level]+'22', color:RISK_COLORS[anomaly.risk_level], fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:20, textTransform:'uppercase' }}>{anomaly.risk_level}</span>
                    </div>
                  </div>

                  {/* Combined score when event is active */}
                  {anomaly.event_context && (() => {
                    const ec = anomaly.event_context;
                    const rc = RISK_COLORS[ec.combined_risk] || '#94a3b8';
                    return (
                      <div style={{ background: EVT_BG[ec.combined_risk]||'#FFF7F0', border:`1px solid ${EVT_BORDER[ec.combined_risk]||'#FBCFA4'}`, borderLeft:`4px solid ${EVT_COLORS[ec.combined_risk]||'#F47920'}`, borderRadius:10, padding:'10px 13px', marginBottom:14 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#F47920', textTransform:'uppercase', letterSpacing:0.8 }}>
                            {ec.event_name} Impact
                          </span>
                          <span style={{ background: EVT_COLORS[ec.combined_risk]+'22', color: EVT_COLORS[ec.combined_risk]||'#F47920', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:10, textTransform:'uppercase' }}>{ec.combined_risk}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:18, fontWeight:900, color:RISK_COLORS[anomaly.risk_level] }}>{ec.intrinsic_score}</div>
                            <div style={{ fontSize:8, color:'#94a3b8', fontWeight:700 }}>Intrinsic</div>
                          </div>
                          <span style={{ fontSize:16, color:'#94a3b8' }}>+</span>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:18, fontWeight:900, color: EVT_COLORS[ec.combined_risk]||'#F47920' }}>{Math.round(ec.event_impact_score * 0.4)}</div>
                            <div style={{ fontSize:8, color:'#94a3b8', fontWeight:700 }}>Event (40%)</div>
                          </div>
                          <span style={{ fontSize:16, color:'#94a3b8' }}>=</span>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:24, fontWeight:900, color:rc }}>{ec.combined_score}</div>
                            <div style={{ fontSize:8, color:'#94a3b8', fontWeight:700 }}>Combined</div>
                          </div>
                        </div>
                        <div style={{ height:6, background:'#FEF3E8', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${ec.combined_score}%`, background:`linear-gradient(90deg,${RISK_COLORS[anomaly.risk_level]},${EVT_COLORS[ec.combined_risk]||'#F47920'})`, borderRadius:3 }} />
                        </div>
                        <div style={{ fontSize:10, color:'#F47920', marginTop:5, textTransform:'capitalize', fontWeight:600 }}>
                          Severity: {ec.severity}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Score gauge */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.8 }}>Anomaly Score</span>
                      <span style={{ fontSize:26, fontWeight:900, color:RISK_COLORS[anomaly.risk_level], lineHeight:1 }}>{anomaly.anomaly_score}<span style={{ fontSize:12, fontWeight:600, color:'#94a3b8' }}>/100</span></span>
                    </div>
                    <div style={{ height:10, background:'#f1f5f9', borderRadius:5, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${anomaly.anomaly_score}%`, background:'linear-gradient(90deg,#22c55e 0%,#f59e0b 50%,#ef4444 100%)', backgroundSize:'300px 100%', borderRadius:5 }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                      {['Normal','Watch','Warning','Critical'].map(l => <span key={l} style={{ fontSize:8, color:'#cbd5e1', fontWeight:600 }}>{l}</span>)}
                    </div>
                  </div>

                  {/* Time to critical */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px', marginBottom:14 }}>
                    <span style={{ fontSize:20 }}>⏱</span>
                    <div>
                      <div style={{ fontSize:9, color:'#92400e', fontWeight:800, textTransform:'uppercase' }}>Est. Time to Critical</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'#78350f' }}>{anomaly.time_to_critical}</div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Metric Analysis</div>
                    {Object.entries(anomaly.metrics_analysis).map(([metric,data]) => {
                      const bc = data.anomaly_score>66?'#ef4444':data.anomaly_score>33?'#f59e0b':'#22c55e';
                      return (
                        <div key={metric} style={{ marginBottom:9 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                            <span style={{ fontSize:11, color:'#475569', fontWeight:600, textTransform:'capitalize' }}>{metric.replace(/_/g,' ')}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{data.value} <span style={{ color:'#94a3b8', fontWeight:400 }}>{data.unit}</span></span>
                              <span style={{ fontSize:13, fontWeight:900, color:TREND_COLOR[data.trend] }}>{TREND_ICON[data.trend]}</span>
                            </div>
                          </div>
                          <div style={{ height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${data.anomaly_score}%`, background:bc, borderRadius:3 }} />
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                            <span style={{ fontSize:9, color:'#94a3b8' }}>deviation {data.anomaly_score}%</span>
                            <span style={{ fontSize:9, color:TREND_COLOR[data.trend], fontWeight:700 }}>{data.trend}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Downstream risk */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                      Downstream Risk <span style={{ color:'#64748b', fontWeight:600, textTransform:'none' }}>({anomaly.total_downstream} nodes)</span>
                    </div>
                    {anomaly.affected_nodes.slice(0,10).map(node => {
                      const rc = RISK_COLORS[node.risk_level]||'#94a3b8';
                      return (
                        <div key={node.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background:'#f8fafc', borderRadius:6, marginBottom:4, border:'1px solid #f1f5f9' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:rc, flexShrink:0 }} />
                            <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{node.id}</span>
                            <span style={{ fontSize:9, color:'#94a3b8' }}>hop {node.hop}</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <div style={{ width:36, height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${node.propagated_risk}%`, background:rc, borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:rc, minWidth:24, textAlign:'right' }}>{node.propagated_risk}</span>
                          </div>
                        </div>
                      );
                    })}
                    {anomaly.affected_nodes.length>10 && <span style={{ fontSize:11, color:'#94a3b8' }}>+{anomaly.affected_nodes.length-10} more</span>}
                  </div>

                  {/* Recommendations */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Recommendations</div>
                    <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', border:'1px solid #f1f5f9' }}>
                      {anomaly.recommendations.map((rec,i) => (
                        <div key={i} style={{ display:'flex', gap:7, marginBottom:i<anomaly.recommendations.length-1?7:0, fontSize:11, color:'#475569', lineHeight:1.5 }}>
                          <span style={{ color:'#f59e0b', flexShrink:0, fontWeight:800 }}>•</span>{rec}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setShowComparison(true)} style={{ width:'100%', padding:'8px 0', background:'#FEF3E8', color:'#D4621A', border:'1px solid #FBCFA4', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12, marginBottom:6 }}>
                    ⊞ Compare Networks
                  </button>
                  <button onClick={() => { setSelected(null); setAnomaly(null); setShowComparison(false); }} style={{ width:'100%', padding:'8px 0', background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:12 }}>
                    Clear Selection
                  </button>
                </>
              )}

              {/* ── Pipeline Assistant Chat ── */}
              <div style={{ marginTop:20, borderTop:'1px solid #f1f5f9', paddingTop:16 }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#F47920,#D4621A)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:800, color:'#1e293b', letterSpacing:'-0.1px' }}>Pipeline Assistant</div>
                      <div style={{ fontSize:9, color:'#F9B37A', fontWeight:600, letterSpacing:'0.2px' }}>LangGraph · Beta</div>
                    </div>
                  </div>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 2px #dcfce7' }} />
                </div>

                {/* Message list */}
                <div style={{ height:260, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, padding:'4px 2px', marginBottom:10 }}>
                  {chatMessages.map((msg, i) => {
                    if (msg.role === 'system-info') {
                      return (
                        <div key={i} style={{ textAlign:'center', padding:'2px 0' }}>
                          <span style={{ fontSize:9, color:'#F47920', background:'#FEF3E8', padding:'3px 12px', borderRadius:20, fontWeight:700, border:'1px solid #FBCFA4', letterSpacing:'0.3px' }}>{msg.text}</span>
                        </div>
                      );
                    }
                    const isUser = msg.role === 'user';
                    return (
                      <div key={i} style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems:'flex-start', gap:7 }}>
                        {!isUser && (
                          <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#F47920,#D4621A)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, boxShadow:'0 2px 6px rgba(244,121,32,0.28)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </div>
                        )}
                        <div style={{
                          maxWidth:'82%', padding: isUser ? '9px 13px' : '10px 13px',
                          borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                          background: isUser ? '#F47920' : '#fff',
                          color: isUser ? '#fff' : '#1e293b',
                          fontSize:11.5, lineHeight:1.65, fontWeight: isUser ? 600 : 400,
                          boxShadow: isUser ? '0 3px 10px rgba(244,121,32,0.22)' : '0 1px 4px rgba(0,0,0,0.08)',
                          border: isUser ? 'none' : '1px solid #f1f5f9',
                        }}>
                          {isUser ? msg.text : <FormattedMessage text={msg.text} />}
                        </div>
                      </div>
                    );
                  })}
                  {chatLoading && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                      <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#F47920,#D4621A)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, boxShadow:'0 2px 6px rgba(244,121,32,0.28)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <div style={{ padding:'12px 16px', borderRadius:'4px 14px 14px 14px', background:'#fff', border:'1px solid #f1f5f9', boxShadow:'0 1px 4px rgba(0,0,0,0.08)', display:'flex', alignItems:'center', gap:5 }}>
                        {[0,1,2].map(d => (
                          <div key={d} style={{ width:5, height:5, borderRadius:'50%', background:'#F9B37A', animation:`pulse 1.2s ease-in-out ${d*0.2}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div style={{ display:'flex', gap:7, alignItems:'center', background:'#f8fafc', borderRadius:10, border:'1.5px solid #e2e8f0', padding:'4px 4px 4px 10px', transition:'border-color 0.15s' }}
                  onFocusCapture={e => e.currentTarget.style.borderColor = '#F9B37A'}
                  onBlurCapture={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Ask about anomalies, risk, nodes…"
                    style={{
                      flex:1, border:'none', background:'transparent',
                      fontSize:11.5, color:'#0f172a', outline:'none',
                      fontFamily:'system-ui', padding:'5px 0',
                    }}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{
                      width:32, height:32, borderRadius:8, border:'none', flexShrink:0,
                      background: chatInput.trim() && !chatLoading ? 'linear-gradient(135deg,#F47920,#D4621A)' : '#e2e8f0',
                      color: chatInput.trim() && !chatLoading ? '#fff' : '#94a3b8',
                      cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s', boxShadow: chatInput.trim() && !chatLoading ? '0 2px 8px rgba(244,121,32,0.28)' : 'none',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
                <div style={{ marginTop:6, fontSize:9, color:'#cbd5e1', textAlign:'center', letterSpacing:'0.2px' }}>
                  Powered by LangGraph · GPT-4o
                </div>
              </div>
            </>
          )}

          {/* ── EVENTS TAB ── */}
          {activeTab === 'events' && (
            <>
              <p style={{ fontSize:12, color:'#94a3b8', margin:'0 0 14px' }}>Simulate an external event and see its impact across the pipeline network</p>

              {/* Live Hazards Section */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>Live Hazards — USGS + NOAA</span>
                  {liveHazards && <span style={{ fontSize:9, color:'#94a3b8', fontWeight:600, textTransform:'none' }}>{new Date(liveHazards.fetched_at).toLocaleTimeString()}</span>}
                </div>
                {hazardsLoading && (
                  <div style={{ background:'#f8fafc', borderRadius:8, padding:'12px', textAlign:'center', border:'1px dashed #e2e8f0' }}>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>Fetching live data…</span>
                  </div>
                )}
                {!hazardsLoading && liveHazards && (
                  <div style={{ borderRadius:8, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                    {/* USGS Earthquakes */}
                    {liveHazards.earthquakes?.length > 0 && (
                      <div style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ background:'#fff7ed', padding:'6px 10px', borderBottom:'1px solid #fed7aa' }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#ea580c' }}>USGS Earthquakes — M3.0+, last 14 days</span>
                        </div>
                        {liveHazards.earthquakes.slice(0,5).map((eq, i) => {
                          const magColor = eq.magnitude >= 5 ? '#ef4444' : eq.magnitude >= 4 ? '#f97316' : '#f59e0b';
                          return (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 10px', background: i%2===0?'#fff':'#fafafa', borderBottom: i<Math.min(4, liveHazards.earthquakes.length-1)?'1px solid #f1f5f9':'none' }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:10, color:'#0f172a', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{eq.place}</div>
                                <div style={{ fontSize:9, color:'#94a3b8' }}>{new Date(eq.time).toLocaleDateString()}</div>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                                <span style={{ background: magColor+'22', color: magColor, fontSize:10, fontWeight:900, padding:'2px 7px', borderRadius:10 }}>M{eq.magnitude}</span>
                                <span style={{ fontSize:9, color:'#94a3b8', textTransform:'capitalize' }}>{eq.severity}</span>
                              </div>
                            </div>
                          );
                        })}
                        {liveHazards.earthquakes.length > 5 && <div style={{ fontSize:10, color:'#94a3b8', padding:'4px 10px', background:'#fafafa' }}>+{liveHazards.earthquakes.length-5} more</div>}
                      </div>
                    )}
                    {/* NOAA Alerts */}
                    {liveHazards.weather_alerts?.length > 0 && (
                      <div>
                        <div style={{ background:'#FEF3E8', padding:'6px 10px', borderBottom:'1px solid #FBCFA4' }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#D4621A' }}>NOAA Active Alerts — TX / OK</span>
                        </div>
                        {liveHazards.weather_alerts.slice(0,5).map((al, i) => {
                          const sevColor = al.severity === 'Extreme' ? '#ef4444' : al.severity === 'Severe' ? '#f97316' : al.severity === 'Moderate' ? '#f59e0b' : '#22c55e';
                          return (
                            <div key={i} style={{ padding:'6px 10px', background: i%2===0?'#fff':'#fafafa', borderBottom: i<Math.min(4, liveHazards.weather_alerts.length-1)?'1px solid #f1f5f9':'none' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                                <span style={{ fontSize:10, fontWeight:700, color:'#0f172a' }}>{al.event}</span>
                                <span style={{ background: sevColor+'22', color: sevColor, fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:8, flexShrink:0, marginLeft:4 }}>{al.severity}</span>
                              </div>
                              <div style={{ fontSize:9, color:'#64748b', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{al.area_desc}</div>
                            </div>
                          );
                        })}
                        {liveHazards.weather_alerts.length > 5 && <div style={{ fontSize:10, color:'#94a3b8', padding:'4px 10px', background:'#fafafa' }}>+{liveHazards.weather_alerts.length-5} more</div>}
                      </div>
                    )}
                    {liveHazards.earthquakes?.length === 0 && liveHazards.weather_alerts?.length === 0 && (
                      <div style={{ padding:'12px', textAlign:'center', background:'#f8fafc' }}>
                        <span style={{ fontSize:11, color:'#22c55e', fontWeight:700 }}>✓ No active hazards detected in pipeline region</span>
                      </div>
                    )}
                  </div>
                )}
                {!hazardsLoading && !liveHazards && (
                  <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px', border:'1px dashed #e2e8f0', textAlign:'center' }}>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>Live hazard data unavailable</span>
                  </div>
                )}
              </div>

              {/* Event type grid */}
              <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Select Event</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
                {EVENT_TYPES.map(evt => {
                  const active = selectedEvent===evt.type;
                  return (
                    <button key={evt.type} onClick={() => setSelectedEvent(evt.type)} style={{
                      display:'flex', alignItems:'center', gap:7, padding:'8px 10px',
                      borderRadius:8, border:`1.5px solid ${active?'#F47920':'#e2e8f0'}`,
                      background: active?'#FEF3E8':'#fafafa',
                      color: active?'#D4621A':'#475569',
                      fontSize:11, fontWeight:700, cursor:'pointer', textAlign:'left',
                    }}>
                      {evt.name}
                    </button>
                  );
                })}
              </div>

              {/* Severity */}
              <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Severity</div>
              <div style={{ display:'flex', gap:5, marginBottom:16 }}>
                {['low','medium','high','extreme'].map(s => {
                  const colors = { low:'#22c55e', medium:'#f59e0b', high:'#f97316', extreme:'#ef4444' };
                  const active = severity===s;
                  return (
                    <button key={s} onClick={() => setSeverity(s)} style={{
                      flex:1, padding:'6px 4px', borderRadius:6, border:`1.5px solid ${active?colors[s]:'#e2e8f0'}`,
                      background: active?colors[s]+'18':'#fafafa',
                      color: active?colors[s]:'#94a3b8',
                      fontSize:10, fontWeight:800, cursor:'pointer', textTransform:'capitalize',
                    }}>{s}</button>
                  );
                })}
              </div>

              {/* Simulate button */}
              <button
                onClick={runEventSimulation}
                disabled={!selectedEvent || eventLoading}
                style={{ width:'100%', padding:'10px 0', borderRadius:8, border:'none', background: selectedEvent?'#F47920':'#e2e8f0', color: selectedEvent?'#fff':'#94a3b8', fontSize:13, fontWeight:800, cursor: selectedEvent?'pointer':'not-allowed', marginBottom:16 }}
              >
                {eventLoading ? 'Simulating…' : selectedEvent ? `Run Network Simulation — ${EVENT_TYPES.find(e=>e.type===selectedEvent)?.name}` : 'Select an event first'}
              </button>

              {/* Results */}
              {eventImpact && (
                <>
                  {/* Event header */}
                  <div style={{ background:'#FEF3E8', border:'1px solid #FBCFA4', borderLeft:'4px solid #F47920', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:'#D4621A' }}>{eventImpact.event_name}</div>
                        <div style={{ fontSize:10, color:'#F47920', marginTop:2, textTransform:'capitalize' }}>{eventImpact.severity} severity</div>
                      </div>
                      <button onClick={clearEvent} style={{ background:'#FEF3E8', border:'none', borderRadius:6, padding:'3px 8px', color:'#F47920', fontSize:11, fontWeight:700, cursor:'pointer' }}>Clear</button>
                    </div>
                    <div style={{ fontSize:11, color:'#58595B', marginTop:8, lineHeight:1.5 }}>{eventImpact.description}</div>
                  </div>

                  {/* Impact stats */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:14 }}>
                    {[['Critical', eventImpact.counts.critical, '#ef4444'], ['Warning', eventImpact.counts.warning, '#f97316'], ['Watch', eventImpact.counts.watch, '#f59e0b']].map(([label,val,color]) => (
                      <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 6px', textAlign:'center', border:`1px solid ${color}33` }}>
                        <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
                        <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginTop:1 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Most at risk nodes */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Most at Risk</div>
                    {eventImpact.affected_nodes.filter(n=>n.risk_level!=='normal').slice(0,12).map(node => {
                      const rc = EVT_COLORS[node.risk_level];
                      return (
                        <div key={node.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background:'#f8fafc', borderRadius:6, marginBottom:4, border:'1px solid #f1f5f9' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:rc, flexShrink:0 }} />
                            <div>
                              <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{node.id}</span>
                              <span style={{ fontSize:9, color:'#94a3b8', marginLeft:5 }}>{node.type.replace(/_/g,' ')}</span>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <div style={{ width:36, height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${node.impact_score}%`, background:rc, borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:rc, minWidth:24, textAlign:'right' }}>{node.impact_score}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Response Actions</div>
                    <div style={{ background:'#FEF3E8', borderRadius:8, padding:'10px 12px', border:'1px solid #FBCFA4' }}>
                      {eventImpact.recommendations.map((rec,i) => (
                        <div key={i} style={{ display:'flex', gap:7, marginBottom:i<eventImpact.recommendations.length-1?8:0, fontSize:11, color:'#58595B', lineHeight:1.5 }}>
                          <span style={{ color:'#F47920', flexShrink:0, fontWeight:800 }}>→</span>{rec}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* ── Comparison Modal ── */}
    {showComparison && anomaly && graphData && (
      <ComparisonModal
        graphData={graphData}
        anomaly={anomaly}
        mapStyle={mapStyle}
        onClose={() => setShowComparison(false)}
        onNodeClick={node => {
          if (node.id === selectedNode) return;
          setSelected(node.id);
          getAnomaly(node.id, selectedEvent, severity).then(data => {
            setAnomaly(data);
            setChatMessages(prev => [...prev, { role:'system-info', text:`Node ${node.id} selected — ${node.label} (${(node.type||'').replace(/_/g,' ')})` }]);
          });
        }}
      />
    )}
    </>
  );
}

function visibleNodesForOverlap(nodes, activeTypes, draggedPositions) {
  return nodes
    .filter(n => n.lat && n.lng && activeTypes.has(n.type))
    .map(n => ({ id: n.id, lat: (draggedPositions[n.id]||n).lat, lng: (draggedPositions[n.id]||n).lng }));
}
