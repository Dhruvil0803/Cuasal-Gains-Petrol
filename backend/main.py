from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import requests as req
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from nodes_data import ALL_NODES, ALL_EDGES, DOWNSTREAM, NODE_TYPE_CONFIG, make_metrics, _status
from chatbot_engine import chat as chatbot_chat

app = FastAPI(title="Petrol IoT Sensor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://192.168.3.66:3001", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data" / "sensors"

SENSOR_META = {
    "S001": {"name": "Pump Station Alpha", "file": "sensor_1.csv", "color": "#3b82f6"},
    "S002": {"name": "Pump Station Beta",  "file": "sensor_2.csv", "color": "#10b981"},
    "S003": {"name": "Pipeline Junction 1","file": "sensor_3.csv", "color": "#f59e0b"},
    "S004": {"name": "Storage Tank West",  "file": "sensor_4.csv", "color": "#ef4444"},
    "S005": {"name": "Refinery Inlet",     "file": "sensor_5.csv", "color": "#8b5cf6"},
}

# Shared pipeline: S001 -> S003 -> S005, S002 -> S003, S004 -> S005
SENSOR_RELATIONSHIPS = [
    {"source": "S001", "target": "S003", "label": "feeds into"},
    {"source": "S002", "target": "S003", "label": "feeds into"},
    {"source": "S003", "target": "S005", "label": "flows to"},
    {"source": "S004", "target": "S005", "label": "backup feed"},
]


def load_sensor_df(sensor_id: str) -> pd.DataFrame:
    meta = SENSOR_META.get(sensor_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Sensor {sensor_id} not found")
    path = DATA_DIR / meta["file"]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    return df


def load_all_df() -> pd.DataFrame:
    path = DATA_DIR / "combined.csv"
    return pd.read_csv(path, parse_dates=["timestamp"])


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/sensors")
def list_sensors():
    """Return metadata for all sensors including latest reading."""
    result = []
    for sid, meta in SENSOR_META.items():
        df = load_sensor_df(sid)
        latest = df.iloc[-1]
        result.append({
            "sensor_id": sid,
            "name": meta["name"],
            "color": meta["color"],
            "location": latest["location"],
            "status": latest["status"],
            "latest": {
                "timestamp": str(latest["timestamp"]),
                "pressure": float(latest["pressure"]),
                "temperature": float(latest["temperature"]),
                "flow_rate": float(latest["flow_rate"]),
                "fuel_level": float(latest["fuel_level"]),
            },
        })
    return result


@app.get("/api/sensors/{sensor_id}")
def get_sensor_data(sensor_id: str, limit: int = 50):
    """Return time-series data for a single sensor."""
    df = load_sensor_df(sensor_id)
    df = df.tail(limit)
    records = df.to_dict(orient="records")
    for r in records:
        r["timestamp"] = str(r["timestamp"])
    meta = SENSOR_META[sensor_id]
    return {
        "sensor_id": sensor_id,
        "name": meta["name"],
        "color": meta["color"],
        "data": records,
    }


@app.get("/api/sensors/{sensor_id}/stats")
def get_sensor_stats(sensor_id: str):
    """Aggregate statistics for a sensor."""
    df = load_sensor_df(sensor_id)
    cols = ["pressure", "temperature", "flow_rate", "fuel_level"]
    stats = {}
    for col in cols:
        stats[col] = {
            "min": round(float(df[col].min()), 2),
            "max": round(float(df[col].max()), 2),
            "mean": round(float(df[col].mean()), 2),
            "std": round(float(df[col].std()), 2),
        }
    status_counts = df["status"].value_counts().to_dict()
    return {"sensor_id": sensor_id, "stats": stats, "status_counts": status_counts}


@app.get("/api/combined")
def get_combined_data(limit: int = 100):
    """Return combined data from all sensors."""
    df = load_all_df()
    # Return last `limit` records per sensor
    result = []
    for sid in SENSOR_META:
        subset = df[df["sensor_id"] == sid].tail(limit)
        for r in subset.to_dict(orient="records"):
            r["timestamp"] = str(r["timestamp"])
            result.append(r)
    return result


@app.get("/api/graph")
def get_graph_data():
    """Return all 100 nodes with lat/lng and edges for the map view."""
    nodes = []
    for nid, meta in ALL_NODES.items():
        ntype = meta["type"]
        cfg   = NODE_TYPE_CONFIG.get(ntype, NODE_TYPE_CONFIG["well"])
        m     = make_metrics(ntype)
        nodes.append({
            "id":      nid,
            "label":   meta["name"],
            "type":    ntype,
            "color":   cfg["color"],
            "lat":     meta["lat"],
            "lng":     meta["lng"],
            "status":  _status(),
            "metrics": m,
        })
    return {"nodes": nodes, "edges": ALL_EDGES}


@app.get("/api/shared-data")
def get_shared_data(sensor_a: str, sensor_b: str):
    """Find overlapping timestamp windows and common metrics between two sensors."""
    df_a = load_sensor_df(sensor_a)
    df_b = load_sensor_df(sensor_b)

    # Overlap by hour bucket
    df_a["hour"] = df_a["timestamp"].dt.floor("h")
    df_b["hour"] = df_b["timestamp"].dt.floor("h")

    common_hours = set(df_a["hour"].dt.strftime("%Y-%m-%d %H:00")) & set(
        df_b["hour"].dt.strftime("%Y-%m-%d %H:00")
    )

    overlap_a = df_a[df_a["hour"].dt.strftime("%Y-%m-%d %H:00").isin(common_hours)]
    overlap_b = df_b[df_b["hour"].dt.strftime("%Y-%m-%d %H:00").isin(common_hours)]

    cols = ["pressure", "temperature", "flow_rate", "fuel_level"]
    corr = {}
    for col in cols:
        if len(overlap_a) > 1 and len(overlap_b) > 1:
            min_len = min(len(overlap_a), len(overlap_b))
            corr[col] = round(
                float(
                    pd.Series(overlap_a[col].values[:min_len]).corr(
                        pd.Series(overlap_b[col].values[:min_len])
                    )
                ),
                3,
            )

    return {
        "sensor_a": sensor_a,
        "sensor_b": sensor_b,
        "common_time_windows": len(common_hours),
        "correlation": corr,
        "summary": {
            "sensor_a_mean": {c: round(float(df_a[c].mean()), 2) for c in cols},
            "sensor_b_mean": {c: round(float(df_b[c].mean()), 2) for c in cols},
        },
    }


# ── External event configurations ────────────────────────────────────────────
EVENT_CONFIGS = {
    "hurricane": {
        "name": "Hurricane", "icon": "🌀",
        "description": "Category 3+ hurricane making landfall on the Gulf Coast",
        "primary_regions": ["gulf_coast"],
        "secondary_regions": ["texas_coast"],
        "impact_by_type": {
            "terminal": 0.95, "refinery": 0.90, "distribution_center": 0.85,
            "storage_tank": 0.78, "pipeline_junction": 0.70, "compressor_station": 0.65,
            "pump_station": 0.60, "metering_station": 0.50, "well": 0.35, "field_office": 0.30,
        },
        "recommendations": [
            "Evacuate personnel from coastal terminals and refineries",
            "Pre-shut Gulf Coast pump stations before landfall",
            "Activate storm surge protection on Baytown and Deer Park tanks",
            "Reroute Seaway pipeline flow to inland storage",
        ],
    },
    "earthquake": {
        "name": "Earthquake", "icon": "🌍",
        "description": "M6.5 earthquake near Cushing, Oklahoma — world's largest oil storage hub",
        "primary_regions": ["oklahoma"],
        "secondary_regions": ["corridor"],
        "impact_by_type": {
            "storage_tank": 0.92, "pipeline_junction": 0.85, "compressor_station": 0.85,
            "pump_station": 0.72, "metering_station": 0.68, "terminal": 0.55,
            "refinery": 0.50, "well": 0.35, "distribution_center": 0.40, "field_office": 0.25,
        },
        "recommendations": [
            "Immediately inspect Cushing tank farm structural integrity",
            "Check pipeline welds along Seaway corridor for stress fractures",
            "Activate emergency shutoff on all Oklahoma compressor stations",
            "Assess Wichita Falls and Chickasha compressor structural damage",
        ],
    },
    "winter_storm": {
        "name": "Winter Storm", "icon": "❄️",
        "description": "Severe Texas freeze event — similar to Winter Storm Uri (Feb 2021)",
        "primary_regions": ["permian", "corridor", "texas_coast"],
        "secondary_regions": ["gulf_coast", "oklahoma"],
        "impact_by_type": {
            "pump_station": 0.88, "compressor_station": 0.84, "metering_station": 0.78,
            "pipeline_junction": 0.72, "well": 0.68, "refinery": 0.62,
            "storage_tank": 0.50, "terminal": 0.45, "distribution_center": 0.55, "field_office": 0.30,
        },
        "recommendations": [
            "Weatherize pump station control systems immediately",
            "Pre-heat wellheads across Permian Basin to prevent freeze-off",
            "Increase pipeline insulation checks along Abilene corridor",
            "Prepare backup heating fuel for compressor station facilities",
        ],
    },
    "extreme_heat": {
        "name": "Extreme Heat", "icon": "🌡️",
        "description": "Record 115°F heat wave across Texas and Oklahoma",
        "primary_regions": ["permian", "corridor", "oklahoma", "gulf_coast", "texas_coast", "south_texas"],
        "secondary_regions": [],
        "impact_by_type": {
            "compressor_station": 0.82, "refinery": 0.78, "pump_station": 0.68,
            "storage_tank": 0.62, "terminal": 0.58, "pipeline_junction": 0.48,
            "metering_station": 0.42, "well": 0.38, "distribution_center": 0.52, "field_office": 0.22,
        },
        "recommendations": [
            "Reduce compressor station throughput to prevent overheating",
            "Monitor refinery cooling tower capacity at Baytown and Deer Park",
            "Increase storage tank vapor recovery unit operations",
            "Deploy additional cooling to Abilene and Breckenridge compressors",
        ],
    },
    "flood": {
        "name": "Flash Flood", "icon": "🌊",
        "description": "Major flooding along Texas river basins after 20-inch rainfall event",
        "primary_regions": ["texas_coast", "gulf_coast"],
        "secondary_regions": ["south_texas", "corridor"],
        "impact_by_type": {
            "pipeline_junction": 0.88, "pump_station": 0.82, "metering_station": 0.78,
            "compressor_station": 0.68, "well": 0.62, "refinery": 0.72,
            "terminal": 0.78, "storage_tank": 0.58, "distribution_center": 0.68, "field_office": 0.32,
        },
        "recommendations": [
            "Shut in Eagle Ford wells in flood-prone low-lying areas",
            "Elevate portable metering equipment above projected flood lines",
            "Activate Houston Ship Channel emergency spill containment",
            "Reroute Columbus CS flow to avoid submerged pipeline segments",
        ],
    },
    "power_outage": {
        "name": "Power Grid Failure", "icon": "⚡",
        "description": "Regional ERCOT grid failure causing widespread power loss across Texas",
        "primary_regions": ["permian", "corridor", "texas_coast", "gulf_coast", "south_texas", "oklahoma"],
        "secondary_regions": [],
        "impact_by_type": {
            "pump_station": 0.96, "compressor_station": 0.92, "refinery": 0.88,
            "metering_station": 0.74, "terminal": 0.68, "distribution_center": 0.62,
            "pipeline_junction": 0.32, "storage_tank": 0.22, "well": 0.18, "field_office": 0.12,
        },
        "recommendations": [
            "Start backup diesel generators at all pump and compressor stations",
            "Activate manual flow control at metering stations",
            "Prioritize power restoration to Midland PS Alpha and Beta first",
            "Coordinate with ERCOT for critical infrastructure priority load shedding",
        ],
    },
    "wildfire": {
        "name": "Wildfire", "icon": "🔥",
        "description": "Wildfire spreading through West Texas Permian Basin oil fields",
        "primary_regions": ["permian"],
        "secondary_regions": ["corridor"],
        "impact_by_type": {
            "well": 0.92, "pump_station": 0.88, "field_office": 0.85,
            "metering_station": 0.72, "pipeline_junction": 0.68, "compressor_station": 0.58,
            "storage_tank": 0.42, "refinery": 0.22, "terminal": 0.12, "distribution_center": 0.18,
        },
        "recommendations": [
            "Emergency shut-in all Wolfcamp and Spraberry wells in fire path",
            "Evacuate Midland Field HQ personnel immediately",
            "Activate fire suppression systems at Permian pump stations",
            "Pre-position emergency response at Abilene Compressor station",
        ],
    },
    "cyberattack": {
        "name": "Cyber Attack", "icon": "💻",
        "description": "SCADA system compromise targeting pipeline control infrastructure",
        "primary_regions": ["permian", "corridor", "oklahoma", "gulf_coast", "texas_coast", "south_texas"],
        "secondary_regions": [],
        "impact_by_type": {
            "metering_station": 0.96, "field_office": 0.92, "compressor_station": 0.88,
            "pump_station": 0.82, "refinery": 0.78, "terminal": 0.72,
            "distribution_center": 0.62, "pipeline_junction": 0.52, "storage_tank": 0.32, "well": 0.22,
        },
        "recommendations": [
            "Immediately isolate all SCADA metering systems from network",
            "Switch to manual operation at Permian Meter Stations 1-4",
            "Audit field office HQ systems — likely primary attack vector",
            "Engage ICS-CERT emergency response for critical infrastructure",
        ],
    },
}

SEVERITY_MULTIPLIER = {"low": 0.5, "medium": 0.75, "high": 1.0, "extreme": 1.3}

def classify_region(lat, lng):
    if lat > 34.5:                          return "oklahoma"
    if lat > 31 and lng < -100:             return "permian"
    if lat < 29 and lng < -97:             return "south_texas"
    if lat < 30.5 and lng > -96:           return "gulf_coast"
    if lat < 30.5:                          return "texas_coast"
    return "corridor"


@app.get("/api/live-hazards")
def live_hazards():
    """
    Fetch real-time hazard data from public APIs:
    - USGS Earthquake Hazards Program (free, no key)
    - NOAA Weather.gov Alerts (free, no key)
    covering the Texas / Oklahoma pipeline corridor.
    """
    result = {
        "earthquakes":    [],
        "weather_alerts": [],
        "fetched_at":     datetime.utcnow().isoformat() + "Z",
        "sources": [
            {"name": "USGS Earthquake Hazards Program", "url": "https://earthquake.usgs.gov"},
            {"name": "NOAA National Weather Service",   "url": "https://api.weather.gov"},
        ],
    }

    # ── USGS: real earthquakes M3.0+ in TX/OK last 14 days ───────────────────
    since = (datetime.utcnow() - timedelta(days=14)).strftime("%Y-%m-%d")
    try:
        r = req.get(
            "https://earthquake.usgs.gov/fdsnws/event/1/query",
            params={
                "format": "geojson", "minmagnitude": 3.0,
                "orderby": "magnitude", "limit": 10,
                "minlatitude": 25,  "maxlatitude": 38,
                "minlongitude": -106, "maxlongitude": -90,
                "starttime": since,
            },
            timeout=8,
        )
        if r.status_code == 200:
            for feat in r.json().get("features", []):
                p, c = feat["properties"], feat["geometry"]["coordinates"]
                mag = p.get("mag") or 0
                result["earthquakes"].append({
                    "magnitude": mag,
                    "place":     p.get("place", "Unknown"),
                    "time_utc":  datetime.utcfromtimestamp(p["time"] / 1000).strftime("%Y-%m-%d %H:%M UTC"),
                    "lat":       round(c[1], 3),
                    "lng":       round(c[0], 3),
                    "depth_km":  round(c[2], 1),
                    "severity":  "critical" if mag >= 6 else "warning" if mag >= 5 else "watch" if mag >= 4 else "normal",
                    "url":       p.get("url", ""),
                })
    except Exception:
        pass   # API unavailable — return empty list gracefully

    # ── NOAA: active weather alerts for TX and OK ─────────────────────────────
    SEVERITY_MAP = {"Extreme": "critical", "Severe": "warning", "Moderate": "watch", "Minor": "normal"}
    PIPELINE_KEYWORDS = {
        "Hurricane", "Tropical", "Tornado", "Ice Storm", "Winter Storm",
        "Freeze", "Flood", "Flash Flood", "High Wind", "Excessive Heat",
        "Fire Weather", "Blizzard", "Extreme Cold",
    }
    try:
        r = req.get(
            "https://api.weather.gov/alerts/active",
            params={"area": "TX,OK"},
            headers={"User-Agent": "PetrolIoTDashboard/1.0"},
            timeout=8,
        )
        if r.status_code == 200:
            for feat in r.json().get("features", [])[:8]:
                p = feat["properties"]
                event = p.get("event", "")
                # Only surface alerts relevant to pipeline operations
                if not any(kw in event for kw in PIPELINE_KEYWORDS):
                    continue
                result["weather_alerts"].append({
                    "event":     event,
                    "headline":  p.get("headline", ""),
                    "severity":  SEVERITY_MAP.get(p.get("severity", "Minor"), "normal"),
                    "urgency":   p.get("urgency", ""),
                    "areas":     p.get("areaDesc", "")[:120],
                    "effective": (p.get("effective") or "")[:16].replace("T", " "),
                    "expires":   (p.get("expires")   or "")[:16].replace("T", " "),
                })
    except Exception:
        pass

    return result


@app.get("/api/event-impact")
def event_impact(event_type: str, severity: str = "high"):
    """Simulate external event impact across the pipeline network."""
    if event_type not in EVENT_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Unknown event. Choose: {list(EVENT_CONFIGS.keys())}")

    cfg   = EVENT_CONFIGS[event_type]
    mult  = SEVERITY_MULTIPLIER.get(severity, 1.0)

    affected_nodes = []
    counts = {"critical": 0, "warning": 0, "watch": 0, "normal": 0}

    for node_id, meta in ALL_NODES.items():
        region   = classify_region(meta["lat"], meta["lng"])
        ntype    = meta["type"]
        base_imp = cfg["impact_by_type"].get(ntype, 0.3)

        if region in cfg["primary_regions"]:
            regional_factor = 1.0
        elif region in cfg["secondary_regions"]:
            regional_factor = 0.55
        else:
            regional_factor = 0.15  # small indirect supply-chain impact

        score = round(min(100.0, base_imp * regional_factor * mult * 100), 1)
        rl    = ("critical" if score >= 75 else "warning" if score >= 50
                 else "watch" if score >= 25 else "normal")

        counts[rl] += 1
        affected_nodes.append({
            "id": node_id, "name": meta["name"], "type": ntype,
            "region": region, "impact_score": score, "risk_level": rl,
        })

    affected_nodes.sort(key=lambda x: -x["impact_score"])

    return {
        "event_type":    event_type,
        "event_name":    cfg["name"],
        "event_icon":    cfg["icon"],
        "severity":      severity,
        "description":   cfg["description"],
        "counts":        counts,
        "affected_nodes": affected_nodes,
        "recommendations": cfg["recommendations"],
    }


@app.get("/api/anomaly/{node_id}")
def anomaly_analysis(
    node_id: str,
    event_type: Optional[str] = Query(default=None),
    severity:   Optional[str] = Query(default="high"),
):
    """
    Predictive anomaly detection. Optionally pass event_type + severity to
    get a combined risk score that blends intrinsic sensor anomalies with
    external event pressure on this node.
    """
    if node_id not in ALL_NODES:
        raise HTTPException(status_code=404, detail="Node not found")

    meta  = ALL_NODES[node_id]
    ntype = meta["type"]
    cfg   = NODE_TYPE_CONFIG.get(ntype, NODE_TYPE_CONFIG["well"])
    metrics = make_metrics(ntype)

    ranges = {
        "pressure":    cfg["pr"],
        "temperature": cfg["te"],
        "flow_rate":   cfg["fr"],
        "fuel_level":  cfg["fl"],
    }
    units   = {"pressure": "bar", "temperature": "°C", "flow_rate": "L/m", "fuel_level": "%"}
    # pressure and flow_rate weighted higher for pipeline health
    weights = {"pressure": 0.35, "flow_rate": 0.30, "temperature": 0.25, "fuel_level": 0.10}

    metrics_analysis = {}
    composite_score  = 0.0

    for metric, (lo, hi) in ranges.items():
        value   = metrics[metric]
        mid     = (lo + hi) / 2.0
        half_r  = (hi - lo) / 2.0
        # deviation: 0 = at center, 1 = at boundary, >1 = out of range
        deviation = abs(value - mid) / half_r
        score     = round(min(100.0, deviation * 100), 1)

        # Deterministic trend per (node_id, metric) using char sum
        h     = sum(ord(c) for c in (node_id + metric))
        trend = ["rising", "stable", "falling"][h % 3]

        # Which direction is the dangerous anomaly?
        dev_dir = "low" if (metric == "fuel_level" and value < mid) else (
                  "high" if value > mid else "low")

        metrics_analysis[metric] = {
            "value":                value,
            "unit":                 units[metric],
            "anomaly_score":        score,
            "trend":                trend,
            "deviation_direction":  dev_dir,
            "threshold_proximity":  round(max(0.0, min(100.0, deviation * 100)), 1),
        }
        composite_score += score * weights[metric]

    composite_score = round(composite_score, 1)

    if composite_score < 25:
        risk_level = "normal"
    elif composite_score < 50:
        risk_level = "watch"
    elif composite_score < 75:
        risk_level = "warning"
    else:
        risk_level = "critical"

    if composite_score < 30:
        time_to_critical = "> 72 hrs"
    elif composite_score < 50:
        time_to_critical = "24 – 72 hrs"
    elif composite_score < 70:
        time_to_critical = "6 – 24 hrs"
    else:
        time_to_critical = "< 6 hrs"

    # BFS to find all downstream nodes with hop depth
    directly_affected = list(DOWNSTREAM.get(node_id, []))
    visited = {node_id: 0}
    for nid in directly_affected:
        visited[nid] = 1
    queue = [(nid, 1) for nid in directly_affected]
    all_downstream = []
    while queue:
        curr, depth = queue.pop(0)
        all_downstream.append((curr, depth))
        for nxt in DOWNSTREAM.get(curr, []):
            if nxt not in visited:
                visited[nxt] = depth + 1
                queue.append((nxt, depth + 1))

    DECAY = 0.72
    affected_nodes = []
    for nid, depth in all_downstream:
        node_risk = round(composite_score * (DECAY ** depth), 1)
        n_meta    = ALL_NODES.get(nid, {})
        nrl = ("normal"  if node_risk < 25 else
               "watch"   if node_risk < 50 else
               "warning" if node_risk < 75 else "critical")
        affected_nodes.append({
            "id":              nid,
            "name":            n_meta.get("name", nid),
            "type":            n_meta.get("type", "unknown"),
            "hop":             depth,
            "propagated_risk": node_risk,
            "risk_level":      nrl,
        })

    # Actionable recommendations based on worst metrics
    recommendations = []
    recs_map = {
        "pressure":    "Inspect pressure regulators — significant deviation detected",
        "temperature": "Check cooling/heating systems — temperature anomaly above threshold",
        "flow_rate":   "Verify flow meters & valves — abnormal flow rate detected",
        "fuel_level":  "Schedule fuel replenishment — level approaching critical low",
    }
    for metric, data in sorted(metrics_analysis.items(), key=lambda x: -x[1]["anomaly_score"]):
        if data["anomaly_score"] > 60:
            recommendations.append(recs_map[metric])

    if not recommendations:
        if composite_score > 30:
            recommendations.append("Continue monitoring — metrics trending toward watch thresholds")
        else:
            recommendations.append("All parameters within normal operating bounds")

    # ── Combined risk: blend intrinsic anomaly + external event pressure ──────
    event_context = None
    combined_score = composite_score
    combined_risk  = risk_level

    if event_type and event_type in EVENT_CONFIGS:
        evt_cfg  = EVENT_CONFIGS[event_type]
        evt_mult = SEVERITY_MULTIPLIER.get(severity or "high", 1.0)
        region   = classify_region(meta["lat"], meta["lng"])

        if region in evt_cfg["primary_regions"]:
            reg_factor = 1.0
        elif region in evt_cfg["secondary_regions"]:
            reg_factor = 0.55
        else:
            reg_factor = 0.15

        event_impact_score = round(
            min(100.0, evt_cfg["impact_by_type"].get(ntype, 0.3) * reg_factor * evt_mult * 100), 1
        )

        # Combined = intrinsic anomaly + 40% of event pressure (capped at 100)
        combined_score = round(min(100.0, composite_score + event_impact_score * 0.40), 1)
        combined_risk  = ("critical" if combined_score >= 75 else
                          "warning"  if combined_score >= 50 else
                          "watch"    if combined_score >= 25 else "normal")

        # Add event-specific recommendations on top of sensor recommendations
        for rec in evt_cfg["recommendations"][:2]:
            if rec not in recommendations:
                recommendations.append(f"[{evt_cfg['name']}] {rec}")

        event_context = {
            "event_type":        event_type,
            "event_name":        evt_cfg["name"],
            "event_icon":        evt_cfg["icon"],
            "severity":          severity,
            "event_impact_score": event_impact_score,
            "intrinsic_score":   composite_score,
            "combined_score":    combined_score,
            "combined_risk":     combined_risk,
        }

    return {
        "node_id":          node_id,
        "name":             meta["name"],
        "type":             ntype,
        "anomaly_score":    composite_score,
        "risk_level":       risk_level,
        "time_to_critical": time_to_critical,
        "metrics_analysis": metrics_analysis,
        "affected_nodes":   affected_nodes,
        "total_downstream": len(all_downstream),
        "recommendations":  recommendations,
        "event_context":    event_context,   # None when no event active
    }


@app.get("/api/impact/{node_id}")
def impact_analysis(node_id: str):
    """BFS to find all downstream nodes affected if this node is removed."""
    if node_id not in ALL_NODES:
        raise HTTPException(status_code=404, detail="Node not found")

    directly_affected = list(DOWNSTREAM.get(node_id, []))

    visited = set(directly_affected)
    queue   = list(directly_affected)
    transitively_affected = []
    while queue:
        current = queue.pop(0)
        for nxt in DOWNSTREAM.get(current, []):
            if nxt not in visited:
                visited.add(nxt)
                transitively_affected.append(nxt)
                queue.append(nxt)

    meta    = ALL_NODES[node_id]
    ntype   = meta["type"]
    metrics = make_metrics(ntype)
    cols    = ["pressure", "temperature", "flow_rate", "fuel_level"]

    return {
        "removed_sensor": node_id,
        "name":           meta["name"],
        "type":           ntype,
        "directly_affected":     directly_affected,
        "transitively_affected": transitively_affected,
        "data_lost": {
            "records": 200,
            "metrics": cols,
            "averages": {c: metrics[c] for c in cols},
        },
        "is_critical_path": len(directly_affected) > 0,
    }


# ── Chatbot endpoint ───────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"

@app.post("/api/chat")
def chat_endpoint(body: ChatRequest):
    """Send a message to the LangGraph chatbot and return the assistant's reply."""
    response = chatbot_chat(body.message, body.thread_id)
    return {"response": response}
