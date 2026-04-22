from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
import io, json, warnings
import pandas as pd
import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning, module="statsmodels")


def sanitize(obj):
    """Recursively convert numpy scalars/arrays to native Python types."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

# Models and helpers
try:
    from causallearn.search.ConstraintBased.PC import pc
    HAVE_CAUSALLEARN = True
except Exception:
    pc = None
    HAVE_CAUSALLEARN = False

from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder

try:
    from tigramite.data_processing import DataFrame as TgmDF
    from tigramite.pcmci import PCMCI
    from tigramite.independence_tests import ParCorr
    HAVE_TIGRAMITE = True
except Exception:
    HAVE_TIGRAMITE = False

try:
    from statsmodels.tsa.stattools import grangercausalitytests
    HAVE_STATSMODELS = True
except Exception:
    HAVE_STATSMODELS = False

try:
    from lingam import VARLiNGAM
    HAVE_LINGAM = True
except Exception:
    HAVE_LINGAM = False


app = FastAPI(title="Causal Analysis API")

from app.routers.graph import router as graph_router
app.include_router(graph_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeConfig(BaseModel):
    models: List[str]  # ["pc","causal_forest","pcmci","granger","varlingam"]
    alpha: float = 0.05
    maxlag: int = 3
    time_column: Optional[str] = None
    y_cols: Optional[List[str]] = None
    t_cols: Optional[List[str]] = None


def read_table(file: UploadFile) -> pd.DataFrame:
    name = (file.filename or "").lower()
    raw = file.file.read()
    file.file.seek(0)
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(raw))
    if name.endswith(".json"):
        try:
            return pd.read_json(io.BytesIO(raw), orient="records")
        except ValueError:
            data_obj = json.loads(raw.decode("utf-8"))
            if isinstance(data_obj, dict):
                keys = [k for k, v in data_obj.items() if isinstance(v, list)]
                if keys:
                    return pd.json_normalize(data_obj[keys[0]])
                return pd.json_normalize(data_obj)
            return pd.json_normalize(data_obj)
    try:
        return pd.read_csv(io.BytesIO(raw))
    except Exception:
        raise ValueError("Unsupported file format. Upload CSV or JSON.")


def is_id_col(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in ["id", "uuid", "guid"]) and n not in ("index",)


def prepare_data(df: pd.DataFrame) -> Dict[str, Any]:
    df = df.copy()
    id_cols = [c for c in df.columns if is_id_col(c)]
    if id_cols:
        df.drop(columns=id_cols, inplace=True, errors="ignore")

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    encoders: Dict[str, LabelEncoder] = {}

    for c in numeric_cols:
        df[c] = df[c].fillna(df[c].median())
    for c in categorical_cols:
        df[c] = df[c].fillna(df[c].mode()[0] if not df[c].mode().empty else "Unknown")
        le = LabelEncoder()
        df[c] = le.fit_transform(df[c].astype(str))
        encoders[c] = le

    const_cols = [c for c in df.columns if df[c].nunique() <= 1]
    if const_cols:
        df.drop(columns=const_cols, inplace=True, errors="ignore")
    df = df.T.drop_duplicates().T

    if df.shape[1] > 1:
        corr = df.corr().abs()
        upper = corr.where(np.triu(np.ones(corr.shape), 1).astype(bool))
        to_drop = [c for c in upper.columns if any(upper[c] > 0.95)]
        if to_drop:
            df.drop(columns=to_drop, inplace=True, errors="ignore")

    if df.shape[1] < 2:
        raise ValueError("Not enough usable columns after cleaning.")

    return {"df": df, "encoders": encoders, "categorical_cols": categorical_cols}


def as_graph(nodes: list[str], edges: list[Dict[str, Any]]) -> Dict[str, Any]:
    return {"nodes": [{"id": n, "label": n} for n in nodes], "edges": edges}


def run_pc(df: pd.DataFrame, alpha: float) -> Dict[str, Any]:
    """
    PC algorithm for causal discovery.
    Returns comprehensive statistics including edges, adjacency matrix, and separation sets.
    """
    if not HAVE_CAUSALLEARN:
        raise RuntimeError("causal-learn is not installed")
    data = df.to_numpy()
    names = df.columns.tolist()
    cg = pc(data, alpha=alpha, indep_test="fisherz", labels=names)
    
    edges = []
    G = cg.G.graph
    for i in range(len(G)):
        for j in range(len(G)):
            if G[i][j] != 0:
                edges.append({"source": names[i], "target": names[j], "weight": 1.0, "method": "pc"})
    uniq = {(e["source"], e["target"]): e for e in edges}
    graph = as_graph(names, list(uniq.values()))
    
    # Extract adjacency matrix (for advanced stats visualization)
    adjacency_matrix = G.tolist() if hasattr(G, 'tolist') else G
    
    # Extract separation sets (independence relationships discovered)
    sepsets = {}
    if hasattr(cg, 'sepset') and cg.sepset:
        for (i, j), sep_set in cg.sepset.items():
            if sep_set is not None:
                sep_set_names = [names[k] for k in sep_set if k < len(names)]
                sepsets[f"{names[i]} ⊥ {names[j]}"] = sep_set_names
    
    # Build key insights (top relationships)
    insights = []
    if len(graph["edges"]) > 0:
        # Most connected nodes
        node_connections = {}
        for edge in graph["edges"]:
            source = edge["source"]
            target = edge["target"]
            node_connections[source] = node_connections.get(source, 0) + 1
            node_connections[target] = node_connections.get(target, 0) + 1
        
        top_nodes = sorted(node_connections.items(), key=lambda x: x[1], reverse=True)[:3]
        insights.append({
            "type": "hub_nodes",
            "title": "Key Hub Variables",
            "description": f"Variables with most causal connections: {', '.join([n[0] for n in top_nodes])}"
        })
        
        insights.append({
            "type": "network_size",
            "title": "Network Complexity",
            "description": f"Discovered {len(graph['edges'])} causal relationships among {len(names)} variables (density: {len(graph['edges'])/(len(names)*(len(names)-1)):.3f})"
        })
    
    return {
        "graph": graph,
        "adjacency_matrix": adjacency_matrix,
        "separation_sets": sepsets,
        "insights": insights,
        "n_variables": len(names),
        "n_edges": len(graph["edges"]),
    }


def run_pc_v2(df: pd.DataFrame, alpha: float) -> Dict[str, Any]:
    """Robust PC runner that avoids ambiguous truth checks for sepset."""
    if not HAVE_CAUSALLEARN:
        raise RuntimeError("causal-learn is not installed")

    # Subsample for large datasets — Fisher-Z is sample-efficient, 1500 rows is plenty
    if len(df) > 1500:
        df = df.sample(1500, random_state=42)

    data = df.to_numpy()
    names = df.columns.tolist()
    cg = pc(data, alpha=alpha, indep_test="fisherz", labels=names)

    # Edges
    G = cg.G.graph
    edges = []
    n = len(G)
    for i in range(n):
        for j in range(n):
            try:
                val = G[i][j]
            except Exception:
                val = 0
            if val != 0:
                edges.append({"source": names[i], "target": names[j], "weight": 1.0, "method": "pc"})
    graph = as_graph(names, list({(e["source"], e["target"]): e for e in edges}.values()))

    # Adjacency matrix
    adjacency_matrix = G.tolist() if hasattr(G, "tolist") else [[float(G[i][j]) for j in range(n)] for i in range(n)]

    # Safe sepset extraction
    sepsets: Dict[str, Any] = {}
    ss = getattr(cg, "sepset", None)
    try:
        if ss is not None:
            if isinstance(ss, dict):
                if len(ss) > 0 and all(isinstance(k, tuple) and len(k) == 2 for k in ss.keys()):
                    iterator = ss.items()
                else:
                    iterator = (( (int(i), int(j)), sep ) for i, inner in ss.items() for j, sep in getattr(inner, 'items', lambda: [])())
                for (i, j), sep_set in iterator:
                    if sep_set is None:
                        continue
                    names_list = []
                    for v in list(sep_set):
                        try:
                            idx = int(v)
                            names_list.append(names[idx] if 0 <= idx < len(names) else str(v))
                        except Exception:
                            names_list.append(str(v))
                    sepsets[f"{names[int(i)]} || {names[int(j)]}"] = names_list
            else:
                for i in range(len(names)):
                    for j in range(len(names)):
                        if i == j:
                            continue
                        try:
                            sep = ss[i][j]
                        except Exception:
                            sep = None
                        if sep is None:
                            continue
                        names_list = []
                        for v in list(sep):
                            try:
                                idx = int(v)
                                names_list.append(names[idx] if 0 <= idx < len(names) else str(v))
                            except Exception:
                                names_list.append(str(v))
                        sepsets[f"{names[i]} || {names[j]}"] = names_list
    except Exception:
        pass

    # Insights
    insights: list[dict] = []
    if graph["edges"]:
        deg: Dict[str, int] = {}
        for e in graph["edges"]:
            deg[e["source"]] = deg.get(e["source"], 0) + 1
            deg[e["target"]] = deg.get(e["target"], 0) + 1
        hubs = sorted(deg.items(), key=lambda kv: kv[1], reverse=True)[:3]
        if hubs:
            insights.append({
                "type": "hub_nodes",
                "title": "Key Hub Variables",
                "description": "Variables with most causal connections: " + ", ".join([h[0] for h in hubs])
            })
        density = (len(graph["edges"]) / (len(names) * (len(names) - 1))) if len(names) > 1 else 0.0
        insights.append({
            "type": "network_size",
            "title": "Network Complexity",
            "description": f"Discovered {len(graph['edges'])} causal relationships among {len(names)} variables (density: {density:.3f})"
        })

    return {
        "graph": graph,
        "adjacency_matrix": adjacency_matrix,
        "separation_sets": sepsets,
        "insights": insights,
        "n_variables": len(names),
        "n_edges": len(graph["edges"]),
    }


def run_causal_forest(
    df: pd.DataFrame, 
    y_cols: Optional[list[str]], 
    t_cols: Optional[list[str]], 
    encoders: Dict[str, LabelEncoder],
    categorical_cols: list[str],
    candidate_edges: Optional[List[Tuple[str, str]]] = None,
):
    """
    Causal Forest implementation matching Streamlit version exactly.
    Returns: {
        "influence_table": list of {treatment, outcome, effect},
        "heatmap_data": pivot table for visualization,
        "graph": node/edge graph,
        "encoders": label encoder mappings for decoding
    }
    """
    cols = df.columns.tolist()
    if not y_cols:
        y_cols = cols
    if not t_cols:
        t_cols = cols  # any column can be a treatment; pairs skip t==y below

    # If candidate_edges provided (e.g., from PC), restrict estimation to those pairs
    pair_iter: List[Tuple[str, str]]
    if candidate_edges:
        # keep only pairs that exist in dataframe and respect provided y/t columns
        pairs = []
        t_set = set(t_cols)
        y_set = set(y_cols)
        cols_set = set(df.columns)
        for src, dst in candidate_edges:
            if src in cols_set and dst in cols_set and src in t_set and dst in y_set and src != dst:
                pairs.append((src, dst))
        pair_iter = pairs
    else:
        all_pairs = [(t, y) for y in y_cols for t in t_cols if t != y]
        pair_iter = all_pairs[:30]  # cap at 30 pairs when no PC edges available

    # Subsample for large datasets — ATE estimates are stable at 1500 rows
    if len(df) > 1500:
        df = df.sample(1500, random_state=42)

    results = []
    for t, y in pair_iter:
        Y = df[y].values
        T = df[t].values
        X = df.drop(columns=[y, t]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))
        try:
            model = CausalForestDML(
                model_t=RandomForestRegressor(n_estimators=30, min_samples_leaf=15),
                model_y=RandomForestRegressor(n_estimators=30, min_samples_leaf=15),
                random_state=42,
            )
            model.fit(Y, T, X=X)
            effect = model.effect(X)
            avg = float(np.mean(effect))
            results.append({"treatment": t, "outcome": y, "effect": avg})
        except Exception as e:
            results.append({"treatment": t, "outcome": y, "error": str(e)})

    # Build edges for graph
    if candidate_edges:
        # Build graph aligned to candidate topology (e.g., PC) but weighted by CF effects
        effect_map = {(r["treatment"], r["outcome"]): r.get("effect") for r in results if "effect" in r}
        edges = []
        for src, dst in candidate_edges:
            if (src, dst) in effect_map and effect_map[(src, dst)] is not None:
                edges.append({"source": src, "target": dst, "weight": float(effect_map[(src, dst)]), "method": "causal_forest"})
        # Keep only nodes present in any edge
        used_nodes = sorted({n for e in edges for n in (e["source"], e["target"])})
        graph = as_graph(used_nodes if used_nodes else cols, edges)
    else:
        edges = [
            {"source": r["treatment"], "target": r["outcome"], "weight": r.get("effect", 0.0), "method": "causal_forest"}
            for r in results if "effect" in r
        ]
        graph = as_graph(cols, edges)

    # Build heatmap pivot table
    heatmap_data = {}
    for r in results:
        if "effect" in r:
            treatment = r["treatment"]
            outcome = r["outcome"]
            effect = r["effect"]
            if treatment not in heatmap_data:
                heatmap_data[treatment] = {}
            heatmap_data[treatment][outcome] = effect

    # Encoder mappings for UI
    encoder_mappings = {}
    for col, le in encoders.items():
        encoder_mappings[col] = {
            "classes": le.classes_.tolist(),
            "is_categorical": col in categorical_cols
        }

    return {
        "influence_table": results,
        "heatmap_data": heatmap_data,
        "graph": graph,
        "encoder_mappings": encoder_mappings,
        "outcome_cols": y_cols,
        "treatment_cols": t_cols,
    }


def require_timeseries(df: pd.DataFrame, time_column: Optional[str]) -> pd.DataFrame:
    ts = df.copy()
    if time_column and time_column in ts.columns:
        ts = ts.sort_values(by=time_column).reset_index(drop=True)
        ts = ts.drop(columns=[time_column])
    ts = ts.select_dtypes(include=[np.number])
    if ts.shape[1] < 2:
        raise ValueError("Time series requires at least two numeric variables.")
    return ts


def run_pcmci(df: pd.DataFrame, alpha: float, maxlag: int) -> Dict[str, Any]:
    if not HAVE_TIGRAMITE:
        raise RuntimeError("tigramite not installed")
    data = df.to_numpy()
    names = df.columns.tolist()
    tgmdf = TgmDF(data, var_names=names)
    pcmci = PCMCI(dataframe=tgmdf, cond_ind_test=ParCorr(), verbosity=0)
    res = pcmci.run_pcmci(tau_max=maxlag, pc_alpha=alpha)
    p_matrix = res['p_matrix']
    val_matrix = res['val_matrix']
    edges = []
    n = len(names)
    for i in range(n):
        for j in range(n):
            for tau in range(1, maxlag + 1):
                p = p_matrix[i, j, tau]
                val = val_matrix[i, j, tau]
                if np.isfinite(p) and p < alpha:
                    edges.append({
                        "source": names[j],
                        "target": names[i],
                        "weight": float(val),
                        "lag": tau,
                        "p_value": float(p),
                        "method": "pcmci",
                    })
    return as_graph(names, edges)


def run_granger(df: pd.DataFrame, alpha: float, maxlag: int) -> Dict[str, Any]:
    if not HAVE_STATSMODELS:
        raise RuntimeError("statsmodels not installed")
    names = df.columns.tolist()
    edges = []
    for x in names:
        for y in names:
            if x == y:
                continue
            try:
                data_xy = df[[y, x]].dropna()
                res = grangercausalitytests(data_xy, maxlag=maxlag, verbose=False)
                best = min((r[0]["ssr_ftest"][1], lag) for lag, r in res.items() if "ssr_ftest" in r[0])
                pval, lag = best
                if pval < alpha:
                    edges.append({
                        "source": x,
                        "target": y,
                        "weight": 1.0 - float(pval),
                        "lag": lag,
                        "p_value": float(pval),
                        "method": "granger",
                    })
            except Exception:
                pass
    return as_graph(names, edges)


def run_varlingam(df: pd.DataFrame) -> Dict[str, Any]:
    """Run VARLiNGAM and return graph plus adjacency and counts."""
    if not HAVE_LINGAM:
        raise RuntimeError("lingam not installed")
    if len(df) > 1500:
        df = df.sample(1500, random_state=42)
    names = df.columns.tolist()
    model = VARLiNGAM()
    model.fit(df.values)
    B = getattr(model, "adjacency_matrix_", None)
    if B is None:
        B = model.adjacency_matrices_[-1]
    edges = []
    n = len(names)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            w = float(B[i, j])
            if abs(w) > 1e-8:
                edges.append({"source": names[j], "target": names[i], "weight": w, "method": "varlingam"})
    graph = as_graph(names, edges)
    return {
        "graph": graph,
        "adjacency_matrix": B.tolist() if hasattr(B, "tolist") else [[float(B[i][j]) for j in range(n)] for i in range(n)],
        "n_variables": len(names),
        "n_edges": len(edges),
    }


class WhatIfConfig(BaseModel):
    """Configuration for what-if scenario analysis"""
    treatment_col: str
    outcome_col: str
    baseline_value: float
    new_value: float
    is_categorical: bool = False
    categorical_index: Optional[int] = None


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), config_json: str = Form(...)):
    config = AnalyzeConfig(**json.loads(config_json))

    raw_df = read_table(file)
    prepped = prepare_data(raw_df)
    df = prepped["df"]

    out: Dict[str, Any] = {
        "meta": {
            "n_rows": int(len(df)),
            "n_cols": int(len(df.columns)),
            "columns": list(df.columns),
        },
        "graphs": {},
        "tables": {},
        "warnings": [],
    }

    if "pc" in config.models:
        try:
            pc_result = run_pc_v2(df, alpha=config.alpha)
            out["graphs"]["pc"] = pc_result["graph"]
            out["tables"]["pc"] = {
                "adjacency_matrix": pc_result["adjacency_matrix"],
                "separation_sets": pc_result["separation_sets"],
                "insights": pc_result["insights"],
                "n_variables": pc_result["n_variables"],
                "n_edges": pc_result["n_edges"],
            }
        except Exception as e:
            out["warnings"].append(f"PC failed: {e}")

    if "causal_forest" in config.models:
        try:
            # Use PC edges if already computed — never re-run PC just for CF
            candidate_edges = None
            try:
                pc_graph = out.get("graphs", {}).get("pc")
                if pc_graph and pc_graph.get("edges"):
                    candidate_edges = [(e["source"], e["target"]) for e in pc_graph["edges"]]
            except Exception:
                candidate_edges = None

            cf = run_causal_forest(
                df,
                config.y_cols,
                config.t_cols,
                prepped["encoders"],
                prepped["categorical_cols"],
                candidate_edges=candidate_edges,
            )
            out["graphs"]["causal_forest"] = cf["graph"]
            out["tables"]["causal_forest"] = cf["influence_table"]
            out["heatmap"] = cf["heatmap_data"]
            out["encoder_mappings"] = cf["encoder_mappings"]
            out["outcome_cols"] = cf["outcome_cols"]
            out["treatment_cols"] = cf["treatment_cols"]
        except Exception as e:
            out["warnings"].append(f"CausalForest failed: {e}")

    if any(m in config.models for m in ["pcmci", "granger", "varlingam"]):
        try:
            ts_df = require_timeseries(raw_df, config.time_column)
        except Exception as e:
            ts_df = None
            out["warnings"].append(f"Time-series prep failed: {e}")

        if ts_df is not None:
            if "pcmci" in config.models:
                try:
                    out["graphs"]["pcmci"] = run_pcmci(ts_df, alpha=config.alpha, maxlag=config.maxlag)
                except Exception as e:
                    out["warnings"].append(f"PCMCI failed: {e}")
            if "granger" in config.models:
                try:
                    out["graphs"]["granger"] = run_granger(ts_df, alpha=config.alpha, maxlag=config.maxlag)
                except Exception as e:
                    out["warnings"].append(f"Granger failed: {e}")
            if "varlingam" in config.models:
                try:
                    vl = run_varlingam(ts_df)
                    out["graphs"]["varlingam"] = vl["graph"]
                    out["tables"]["varlingam"] = {
                        "adjacency_matrix": vl["adjacency_matrix"],
                        "n_variables": vl["n_variables"],
                        "n_edges": vl["n_edges"],
                    }
                except Exception as e:
                    out["warnings"].append(f"VARLiNGAM failed: {e}")

    return sanitize(out)


@app.post("/whatif")
async def whatif_scenario(file: UploadFile = File(...), config_json: str = Form(...)):
    """
    What-if scenario analysis for Causal Forest.
    Given a treatment change, estimate outcome change.
    """
    config_dict = json.loads(config_json)
    treatment_col = config_dict.get("treatment_col")
    outcome_col = config_dict.get("outcome_col")
    baseline_value = float(config_dict.get("baseline_value", 0.0))
    new_value = float(config_dict.get("new_value", 0.0))

    raw_df = read_table(file)
    prepped = prepare_data(raw_df)
    df = prepped["df"]
    encoders = prepped["encoders"]

    if treatment_col not in df.columns or outcome_col not in df.columns:
        return {"error": f"Column not found. Treatment: {treatment_col}, Outcome: {outcome_col}"}

    try:
        Y = df[outcome_col].values
        T = df[treatment_col].values
        X = df.drop(columns=[outcome_col, treatment_col]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))

        # Train Causal Forest model
        model = CausalForestDML(
            model_t=RandomForestRegressor(n_estimators=50, min_samples_leaf=10),
            model_y=RandomForestRegressor(n_estimators=50, min_samples_leaf=10),
            random_state=42,
        )
        model.fit(Y, T, X=X)
        cate = model.effect(X)
        avg_effect = float(np.mean(cate))

        # Calculate delta
        delta_T = new_value - baseline_value
        delta_Y = float(avg_effect * delta_T)
        baseline_mean_Y = float(np.mean(Y))
        new_mean_Y = baseline_mean_Y + delta_Y

        # Decode if categorical
        display_baseline = baseline_mean_Y
        display_new = new_mean_Y
        if outcome_col in encoders:
            le = encoders[outcome_col]
            try:
                idx_base = int(round(baseline_mean_Y))
                idx_new = int(round(new_mean_Y))
                idx_base = max(0, min(idx_base, len(le.classes_) - 1))
                idx_new = max(0, min(idx_new, len(le.classes_) - 1))
                display_baseline = le.classes_[idx_base]
                display_new = le.classes_[idx_new]
            except:
                pass

        pct_delta_Y = (delta_Y / baseline_mean_Y * 100.0) if baseline_mean_Y != 0 else 0.0

        return sanitize({
            "treatment_col": treatment_col,
            "outcome_col": outcome_col,
            "baseline_treatment": baseline_value,
            "new_treatment": new_value,
            "delta_treatment": delta_T,
            "baseline_outcome": display_baseline,
            "new_outcome": display_new,
            "delta_outcome": delta_Y,
            "pct_change": pct_delta_Y,
            "avg_causal_effect": avg_effect,
        })
    except Exception as e:
        return {"error": f"What-if analysis failed: {str(e)}"}


@app.post("/sim/columns")
async def sim_columns(file: UploadFile = File(...)):
    """Return numeric column names and row count for simulation setup."""
    raw_df = read_table(file)
    df = raw_df.select_dtypes(include=[np.number])
    df = df.loc[:, df.std() > 0]
    return sanitize({
        "columns": df.columns.tolist(),
        "n_rows": int(len(df)),
        "column_stats": {
            col: {"mean": round(float(df[col].mean()), 2), "min": round(float(df[col].min()), 2), "max": round(float(df[col].max()), 2)}
            for col in df.columns
        }
    })


@app.post("/simulate")
async def simulate_whatif(file: UploadFile = File(...), config_json: str = Form(...)):
    """
    Multi-output what-if simulation using Causal Forest.
    Given a treatment variable and % change, estimates impact on all other variables.
    """
    config_dict = json.loads(config_json)
    treatment_col = config_dict.get("treatment_col")
    delta_pct = float(config_dict.get("delta_pct", 10.0))

    raw_df = read_table(file)

    # Simulation-specific prep: keep correlated columns (don't drop high-corr vars)
    df = raw_df.select_dtypes(include=[np.number]).copy()
    for c in df.columns:
        df[c] = df[c].fillna(df[c].median())
    df = df.loc[:, df.std() > 0]

    if treatment_col not in df.columns:
        return {"error": f"Variable '{treatment_col}' not found"}

    T = df[treatment_col].values
    baseline_T = float(np.mean(T))
    delta_T = baseline_T * (delta_pct / 100.0)

    if len(df) > 1500:
        df = df.sample(1500, random_state=42)
    min_leaf = max(10, len(df) // 20)
    impacts = []

    for outcome_col in df.columns:
        if outcome_col == treatment_col:
            continue
        try:
            Y = df[outcome_col].values
            X_cols = [c for c in df.columns if c not in [outcome_col, treatment_col]]
            X = df[X_cols].values if X_cols else np.zeros((len(Y), 1))

            model = CausalForestDML(
                model_t=RandomForestRegressor(n_estimators=30, min_samples_leaf=min_leaf),
                model_y=RandomForestRegressor(n_estimators=30, min_samples_leaf=min_leaf),
                random_state=42,
            )
            model.fit(Y, T, X=X)
            ate = float(np.mean(model.effect(X)))

            baseline_Y = float(np.mean(Y))
            delta_Y = ate * delta_T
            new_Y = baseline_Y + delta_Y
            pct_change = (delta_Y / abs(baseline_Y) * 100) if baseline_Y != 0 else 0.0

            impacts.append({
                "variable": outcome_col,
                "baseline": round(baseline_Y, 2),
                "new_value": round(new_Y, 2),
                "delta": round(delta_Y, 2),
                "pct_change": round(pct_change, 2),
            })
        except Exception:
            pass

    impacts.sort(key=lambda x: abs(x["pct_change"]), reverse=True)

    return sanitize({
        "treatment": treatment_col,
        "delta_pct": delta_pct,
        "baseline_treatment": round(baseline_T, 2),
        "new_treatment": round(baseline_T + delta_T, 2),
        "impacts": impacts,
    })
