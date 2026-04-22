from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any, List
import io
import pandas as pd

router = APIRouter(prefix="/graph", tags=["supply-chain"])

# Column names that define entity nodes (in supply chain flow order)
ENTITY_FLOW = ["supplier", "factory", "warehouse", "distribution_center", "retailer"]
ENTITY_TYPE_MAP = {
    "supplier": "Supplier",
    "factory": "Factory",
    "warehouse": "Warehouse",
    "distribution_center": "DistributionCenter",
    "retailer": "Retailer",
}
NUMERIC_METRICS = [
    "volume", "lead_time_days", "transport_cost",
    "delay_days", "quality_score", "defect_rate", "production_cost",
]
NODE_COLORS = {
    "Supplier": "#6366f1",
    "Factory": "#10b981",
    "Warehouse": "#f59e0b",
    "DistributionCenter": "#8b5cf6",
    "Retailer": "#ef4444",
}


VARIABLE_COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
    "#0ea5e9", "#f97316", "#14b8a6", "#ec4899", "#84cc16",
    "#a855f7", "#06b6d4", "#eab308", "#64748b",
]


def _build_variable_graph(df: pd.DataFrame) -> Dict[str, Any]:
    """Fallback: build a node-per-column graph for purely numeric datasets."""
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and df[c].std() > 0]

    nodes = []
    for i, col in enumerate(numeric_cols):
        nodes.append({
            "id": col,
            "label": col.replace("_", " ").title(),
            "type": "Variable",
            "color": VARIABLE_COLORS[i % len(VARIABLE_COLORS)],
            "entity_col": col,
            "mean": round(float(df[col].mean()), 3),
            "min": round(float(df[col].min()), 3),
            "max": round(float(df[col].max()), 3),
            "row_count": int(df[col].count()),
        })

    # Build edges from strong correlations (|r| > 0.5) so the graph isn't empty
    edges = []
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr()
        seen = set()
        for i, c1 in enumerate(numeric_cols):
            for j, c2 in enumerate(numeric_cols):
                if i >= j:
                    continue
                r = corr.loc[c1, c2]
                if abs(r) > 0.5 and (c1, c2) not in seen:
                    seen.add((c1, c2))
                    edges.append({
                        "source": c1,
                        "target": c2,
                        "relationship": "correlated",
                        "weight": round(float(r), 3),
                    })

    return {
        "nodes": nodes,
        "edges": edges,
        "node_types": ["Variable"],
        "edge_types": ["correlated"],
        "metric_columns": numeric_cols,
        "entity_columns": [],
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "row_count": int(len(df)),
        },
    }


def _build_graph(df: pd.DataFrame) -> Dict[str, Any]:
    present_entities = [(c, ENTITY_TYPE_MAP[c]) for c in ENTITY_FLOW if c in df.columns]
    present_metrics = [m for m in NUMERIC_METRICS if m in df.columns]

    # No entity columns found — fall back to variable graph
    if not present_entities:
        return _build_variable_graph(df)

    nodes: List[Dict] = []
    seen_ids: set = set()
    name_to_id: Dict[str, str] = {}

    for col, node_type in present_entities:
        for val in df[col].dropna().unique():
            node_id = f"{node_type}::{val}"
            if node_id in seen_ids:
                continue
            seen_ids.add(node_id)
            name_to_id[str(val)] = node_id
            subset = df[df[col] == val]
            metrics = {m: round(float(subset[m].mean()), 3) for m in present_metrics}
            nodes.append({
                "id": node_id,
                "label": str(val),
                "type": node_type,
                "color": NODE_COLORS.get(node_type, "#64748b"),
                "entity_col": col,
                "row_count": int(len(subset)),
                **metrics,
            })

    edges: List[Dict] = []
    seen_edges: set = set()

    for i in range(len(present_entities) - 1):
        src_col = present_entities[i][0]
        tgt_col = present_entities[i + 1][0]
        rel = f"{present_entities[i][1]}_TO_{present_entities[i+1][1]}"
        for _, row in df[[src_col, tgt_col]].dropna().drop_duplicates().iterrows():
            sid = name_to_id.get(str(row[src_col]))
            tid = name_to_id.get(str(row[tgt_col]))
            if sid and tid and (sid, tid) not in seen_edges:
                seen_edges.add((sid, tid))
                sub = df[(df[src_col] == row[src_col]) & (df[tgt_col] == row[tgt_col])]
                metrics = {m: round(float(sub[m].mean()), 3) for m in present_metrics}
                edges.append({
                    "source": sid,
                    "target": tid,
                    "relationship": rel,
                    "flow_count": int(len(sub)),
                    **metrics,
                })

    return {
        "nodes": nodes,
        "edges": edges,
        "node_types": list({n["type"] for n in nodes}),
        "edge_types": list({e["relationship"] for e in edges}),
        "metric_columns": present_metrics,
        "entity_columns": [c for c, _ in present_entities],
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "row_count": int(len(df)),
        },
    }


@router.post("/upload")
async def upload_supply_chain(file: UploadFile = File(...)):
    """Parse a supply chain events CSV into a graph for visualization."""
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        return _build_graph(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/schema")
async def get_schema():
    """Return the expected CSV column schema for the supply chain uploader."""
    return {
        "entity_columns": {k: v for k, v in ENTITY_TYPE_MAP.items()},
        "metric_columns": NUMERIC_METRICS,
        "note": "At least two entity columns and two metric columns are required.",
        "example_columns": "supplier,factory,warehouse,retailer,volume,lead_time_days,transport_cost,delay_days,quality_score,defect_rate,production_cost",
    }
