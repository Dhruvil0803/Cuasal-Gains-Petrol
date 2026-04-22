# # =====================================================
# # Business-Friendly Causal Insights Dashboard
# # (Loads data from freight_cost_analytics_sample.json)
# # =====================================================

# import json
# import pandas as pd
# import numpy as np
# import networkx as nx
# import tempfile
# from pyvis.network import Network
# from causallearn.search.ConstraintBased.PC import pc
# from econml.dml import CausalForestDML
# from sklearn.ensemble import RandomForestRegressor
# import streamlit as st
# import seaborn as sns
# import matplotlib.pyplot as plt
# from pathlib import Path

# # -----------------------------------------------------
# # App Title and Brief Guide
# # -----------------------------------------------------
# st.title("Business Impact and Relationship Explorer")

# with st.expander("How to interpret this dashboard"):
#     st.write("""
#     This tool helps you understand how measurable factors influence business results.
#     • Relationships: The tool identifies which factors tend to drive changes in other factors.  
#     • Impact Strength: Larger magnitudes indicate stronger influence.  
#     • Scenario Planner: Adjust an input factor and see the expected change in selected results.  
#     Notes: All calculations are based on numeric fields in your dataset.
#     """)

# # -----------------------------------------------------
# # STEP 1: Load JSON data (freight_cost_analytics_sample.json)
# # -----------------------------------------------------
# # Default to the uploaded path. Change this string if your file lives elsewhere.
# file_path = Path("C:\\Users\\DhruvilPatel\\Desktop\\GAINS\\freight_cost_analytics_sample.json")

# st.subheader("Load Dataset")

# if not file_path.exists():
#     st.error(f"Data file not found: {file_path}. Please place your JSON at this path or update 'file_path' in the script.")
#     st.stop()

# # Robust JSON loading into a DataFrame
# try:
#     # Try fast path for standard records-oriented JSON
#     df_raw = pd.read_json(file_path, orient="records", lines=False)
# except ValueError:
#     # Fallback: parse and normalize nested structures
#     with open(file_path, "r", encoding="utf-8") as f:
#         data_obj = json.load(f)
#     if isinstance(data_obj, dict):
#         # If top-level is a dict, search for a likely records list
#         candidates = [k for k, v in data_obj.items() if isinstance(v, list)]
#         if candidates:
#             df_raw = pd.json_normalize(data_obj[candidates[0]])
#         else:
#             df_raw = pd.json_normalize(data_obj)
#     else:
#         df_raw = pd.json_normalize(data_obj)

# st.write(f"Loaded dataset with {len(df_raw):,} rows and {len(df_raw.columns):,} columns.")
# st.dataframe(df_raw.head())

# # -----------------------------------------------------
# # STEP 2: Select numeric fields
# # -----------------------------------------------------
# st.subheader("Select Numeric Fields")
# numeric_df = df_raw.select_dtypes(include=[np.number]).copy()

# if numeric_df.empty:
#     st.error("No numeric columns were found in the dataset. Please provide numeric fields to proceed.")
#     st.stop()

# # Optional: allow user to choose which numeric columns to include
# selected_numeric_cols = st.multiselect(
#     "Choose numeric columns to include in the analysis:",
#     options=list(numeric_df.columns),
#     default=list(numeric_df.columns)[: min(25, len(numeric_df.columns))]  # cap default to keep UI responsive
# )
# if not selected_numeric_cols:
#     st.warning("Please select at least one numeric column.")
#     st.stop()

# df = numeric_df[selected_numeric_cols].copy()
# st.write(f"Using {len(selected_numeric_cols)} numeric columns for analysis.")
# st.dataframe(df.head())

# # -----------------------------------------------------
# # STEP 3: Data Preparation and Basic Cleaning
# # -----------------------------------------------------
# st.subheader("Preparing Data for Analysis")

# # Drop rows with all NaNs in selected columns (rare, but safe)
# df.dropna(how="all", inplace=True)

# # Fill remaining NaNs with column medians to keep data usable
# df = df.apply(lambda c: c.fillna(c.median() if np.issubdtype(c.dtype, np.number) else c))

# # Remove constant columns
# const_cols = [c for c in df.columns if df[c].nunique() <= 1]
# if const_cols:
#     st.write(f"Removing constant columns: {const_cols}")
#     df.drop(columns=const_cols, inplace=True)

# # Remove duplicate columns
# df = df.T.drop_duplicates().T

# # Remove highly correlated columns to reduce redundancy
# if df.shape[1] >= 2:
#     corr = df.corr().abs()
#     upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
#     to_drop = [c for c in upper.columns if any(upper[c] > 0.95)]
#     if to_drop:
#         st.write(f"Removing highly correlated columns: {to_drop}")
#         df.drop(columns=to_drop, inplace=True)

# # Stabilize correlation matrix if ill-conditioned
# if df.shape[1] >= 2:
#     try:
#         cond_number = np.linalg.cond(np.corrcoef(df.T))
#         st.write(f"Condition number (data stability check): {cond_number:.2e}")
#         if cond_number > 1e12:
#             st.write("Adding slight random noise to stabilize numeric matrix.")
#             df += np.random.normal(0, 1e-6, df.shape)
#     except Exception as e:
#         st.info(f"Condition number could not be computed: {e}")

# if df.shape[1] < 2:
#     st.error("Not enough numeric columns after cleaning to perform relationship discovery. Please select more numeric fields.")
#     st.stop()

# # -----------------------------------------------------
# # STEP 4: Discover Relationships (PC algorithm)
# # -----------------------------------------------------
# st.subheader("Identifying Key Relationships Between Factors")
# st.write("This step finds potential directional links between numeric variables in your data.")

# data = df.to_numpy()
# variable_names = df.columns.tolist()

# with st.spinner("Discovering relationships..."):
#     try:
#         cg = pc(data, alpha=0.05, indep_test="fisherz", labels=variable_names)

#         # Extract directed edges from the CPDAG/graph matrix
#         edges = []
#         for i in range(len(cg.G.graph)):
#             for j in range(len(cg.G.graph)):
#                 if cg.G.graph[i][j] != 0:
#                     edges.append((variable_names[i], variable_names[j]))

#         edges = list(set(edges))
#         st.success(f"Identified {len(edges)} directional relationships.")
#     except ValueError as e:
#         st.error(f"Relationship discovery failed: {e}")
#         st.stop()

# # -----------------------------------------------------
# # STEP 5: Visualize Relationship Map
# # -----------------------------------------------------
# G_causal = nx.DiGraph()
# for u, v in edges:
#     G_causal.add_edge(u, v)

# st.write(f"Relationship map: {G_causal.number_of_nodes()} variables, {G_causal.number_of_edges()} connections.")

# def visualize_graph(graph: nx.DiGraph) -> str:
#     net = Network(height="650px", width="100%", directed=True, bgcolor="#ffffff", font_color="#000000")
#     net.set_options("""
#     var options = {
#       "nodes": {
#         "shape": "dot",
#         "size": 18,
#         "color": {"background": "#6BAED6", "border": "#2171B5"},
#         "font": {"size": 13, "color": "#111"}
#       },
#       "edges": {
#         "color": {"color": "#9E9E9E"},
#         "arrows": {"to": {"enabled": true, "scaleFactor": 0.7}},
#         "smooth": false
#       },
#       "physics": {
#         "enabled": true,
#         "barnesHut": {
#           "gravitationalConstant": -2000,
#           "centralGravity": 0.25,
#           "springLength": 90,
#           "springConstant": 0.04,
#           "damping": 0.09
#         },
#         "minVelocity": 0.75
#       }
#     }
#     """)
#     net.from_nx(graph)
#     tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
#     net.save_graph(tmp.name)
#     return tmp.name

# if G_causal.number_of_edges() > 0:
#     graph_path = visualize_graph(G_causal)
#     with open(graph_path, "r", encoding="utf-8") as f:
#         html_content = f.read()
#     st.components.v1.html(html_content, height=650, scrolling=True)
# st.caption("Each arrow represents an estimated direction of influence between factors.")

# # -----------------------------------------------------
# # STEP 6: Measure Influence Strength (CausalForestDML)
# # -----------------------------------------------------
# st.subheader("Measuring How Each Factor Affects Results")
# st.write("Select input factors (drivers) and result metrics (outcomes) to estimate direct influence strengths.")

# Y_cols = st.multiselect("Select result metrics (outcomes):", df.columns)
# T_cols = st.multiselect("Select input factors (drivers):", [c for c in df.columns if c not in Y_cols])

# if not Y_cols or not T_cols:
#     st.warning("Please select at least one input and one outcome variable.")
#     st.stop()

# results = []
# with st.spinner("Estimating impact strength..."):
#     for Y_col in Y_cols:
#         for T_col in T_cols:
#             if T_col == Y_col:
#                 continue
#             try:
#                 Y = df[Y_col].values
#                 T = df[T_col].values
#                 X = df.drop(columns=[Y_col, T_col]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))

#                 model = CausalForestDML(
#                     model_t=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
#                     model_y=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
#                     random_state=42,
#                 )
#                 model.fit(Y, T, X=X)
#                 effect = model.effect(X)
#                 avg_effect = float(np.mean(effect))
#                 results.append((T_col, Y_col, avg_effect))
#             except Exception as e:
#                 st.warning(f"Skipping {T_col} → {Y_col}: {e}")

# if results:
#     result_df = pd.DataFrame(results, columns=["Input Factor", "Result Metric", "Estimated Impact"])
#     result_df = result_df.sort_values(by="Estimated Impact", ascending=False)
#     st.dataframe(result_df, use_container_width=True)

#     st.write("Heatmap of influence strength (blue = positive impact, red = negative).")
#     pivot = result_df.pivot(index="Input Factor", columns="Result Metric", values="Estimated Impact").fillna(0)
#     fig, ax = plt.subplots(figsize=(10, 6))
#     sns.heatmap(pivot, cmap="coolwarm", center=0, annot=True, fmt=".2f", ax=ax)
#     st.pyplot(fig)
# else:
#     st.warning("No measurable influence found. Check selected variables or data quality.")

# # -----------------------------------------------------
# # STEP 7: What-If Scenario Planner (Interactive Simulation)
# # -----------------------------------------------------
# st.subheader("What-If Scenario Planner")
# st.write("Adjust an input factor and see the expected change in selected result metrics.")

# sim_T = st.selectbox("Select an input factor to adjust:", T_cols)
# default_Ys = Y_cols if len(Y_cols) > 0 else list(df.columns.drop(sim_T))
# sim_Ys = st.multiselect("Select result metrics to observe:", default_Ys, default=default_Ys)

# unit_label = st.text_input("Units for the selected input factor (optional)", value="")

# if sim_T and len(sim_Ys) > 0:
#     current_mean_T = float(df[sim_T].mean())
#     st.write(f"Current average of {sim_T}: {current_mean_T:.6f}" + (f" {unit_label}" if unit_label else ""))

#     sim_mode = st.radio("Change mode:", ("Set new value", "Apply percentage change"), horizontal=True)

#     if sim_mode == "Set new value":
#         new_value_T = st.number_input(
#             f"Enter new value for {sim_T}" + (f" ({unit_label})" if unit_label else ""),
#             value=current_mean_T, format="%.6f"
#         )
#         delta_T = new_value_T - current_mean_T
#     else:
#         pct_change = st.number_input(
#             f"Enter percentage change for {sim_T} (e.g., 10 for +10%, -5 for -5%)",
#             value=0.0, format="%.4f"
#         )
#         delta_T = current_mean_T * (pct_change / 100.0)
#         new_value_T = current_mean_T + delta_T

#     if st.button("Run Scenario"):
#         sim_rows = []
#         for sim_Y in sim_Ys:
#             try:
#                 Y = df[sim_Y].values
#                 T = df[sim_T].values
#                 X = df.drop(columns=[sim_Y, sim_T]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))

#                 # Fit causal forest for this pair
#                 model = CausalForestDML(
#                     model_t=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
#                     model_y=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
#                     random_state=42,
#                 )
#                 model.fit(Y, T, X=X)

#                 # Heterogeneous treatment effect (CATE) per sample
#                 cate = model.effect(X)  # shape (n_samples,)

#                 # Linearized what-if: ΔY ≈ E[CATE] * ΔT
#                 delta_Y = float(np.mean(cate) * delta_T)

#                 baseline_mean_Y = float(np.mean(Y))
#                 new_mean_Y = baseline_mean_Y + delta_Y
#                 pct_delta_Y = (delta_Y / baseline_mean_Y * 100.0) if baseline_mean_Y != 0 else np.nan

#                 sim_rows.append({
#                     "Input Factor": sim_T,
#                     "Units": unit_label,
#                     "Baseline Input": current_mean_T,
#                     "New Input Value": new_value_T,
#                     "Result Metric": sim_Y,
#                     "Current Value": baseline_mean_Y,
#                     "Predicted Value After Change": new_mean_Y,
#                     "Estimated Change": delta_Y,
#                     "Expected % Change": pct_delta_Y
#                 })
#             except Exception as e:
#                 st.warning(f"Simulation failed for {sim_T} → {sim_Y}: {e}")

#         if sim_rows:
#             sim_df = pd.DataFrame(sim_rows)
#             st.dataframe(sim_df, use_container_width=True)

#             # Simple before/after bar charts per outcome
#             for _, r in sim_df.iterrows():
#                 fig2, ax2 = plt.subplots(figsize=(5, 3))
#                 ax2.bar(["Before", "After"], [r["Current Value"], r["Predicted Value After Change"]], color=["#6BAED6", "#2171B5"])
#                 ax2.set_title(f"Effect of changing {r['Input Factor']} on {r['Result Metric']}")
#                 ax2.set_ylabel(r["Result Metric"])
#                 st.pyplot(fig2)

# st.caption("All results are based on numeric relationships detected from your dataset.")
# =====================================================
# Business-Friendly Causal Insights Dashboard
# (Now supports both numeric and categorical data)
# =====================================================
# =====================================================
# Business-Friendly Causal Insights Dashboard
# (Supports numeric + categorical inputs and outputs)
# =====================================================
# =====================================================
# Business-Friendly Causal Insights Dashboard
# (Supports numeric + categorical data, skips ID columns)
# =====================================================

import json
import pandas as pd
import numpy as np
import networkx as nx
import tempfile
from pyvis.network import Network
from causallearn.search.ConstraintBased.PC import pc
from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import streamlit as st
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path

# -----------------------------------------------------
# Title and Intro
# -----------------------------------------------------
st.title("Business Impact and Relationship Explorer")

with st.expander("How to interpret this dashboard"):
    st.write("""
    This dashboard helps you understand how both numeric and categorical factors 
    influence business outcomes.

    - **Relationships:** Detects cause-and-effect links between variables.
    - **Impact Strength:** Quantifies how strongly one factor influences another.
    - **Scenario Planner:** Lets you change an input factor (numeric or categorical) 
      and see how results are expected to change.
    """)

# -----------------------------------------------------
# STEP 1: Load Dataset
# -----------------------------------------------------
file_path = Path("C:\\Users\\DhruvilPatel\\Desktop\\GAINS\\freight_cost_analytics_2000.json")

st.subheader("Load Dataset")

if not file_path.exists():
    st.error(f"Data file not found: {file_path}")
    st.stop()

try:
    df_raw = pd.read_json(file_path, orient="records")
except Exception:
    with open(file_path, "r", encoding="utf-8") as f:
        data_obj = json.load(f)
    if isinstance(data_obj, dict):
        keys = [k for k, v in data_obj.items() if isinstance(v, list)]
        if keys:
            df_raw = pd.json_normalize(data_obj[keys[0]])
        else:
            df_raw = pd.json_normalize(data_obj)
    else:
        df_raw = pd.json_normalize(data_obj)

# Automatically exclude identifier-like columns
id_like_cols = [c for c in df_raw.columns if "id" in c.lower() or "uuid" in c.lower()]
if id_like_cols:
    st.write(f"Automatically excluding identifier columns: {id_like_cols}")
    df_raw = df_raw.drop(columns=id_like_cols)

st.write(f"Loaded dataset with {len(df_raw):,} rows and {len(df_raw.columns):,} columns.")
st.dataframe(df_raw.head())

# -----------------------------------------------------
# STEP 2: Encode categorical columns but keep mappings
# -----------------------------------------------------
st.subheader("Data Preparation")

df = df_raw.copy()
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
label_encoders = {}

if categorical_cols:
    st.write(f"Detected categorical columns: {categorical_cols}")

for col in numeric_cols:
    df[col] = df[col].fillna(df[col].median())

for col in categorical_cols:
    df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "Unknown")
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    label_encoders[col] = le

st.write("Data prepared and categorical columns encoded for modeling.")
st.dataframe(df.head())

# -----------------------------------------------------
# STEP 3: Clean data
# -----------------------------------------------------
st.subheader("Preparing Data for Analysis")

const_cols = [c for c in df.columns if df[c].nunique() <= 1]
if const_cols:
    st.write(f"Removing constant columns: {const_cols}")
    df = df.drop(columns=const_cols)

df = df.T.drop_duplicates().T

if len(df.columns) > 1:
    corr = df.corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = [c for c in upper.columns if any(upper[c] > 0.95)]
    if to_drop:
        st.write(f"Removing highly correlated columns: {to_drop}")
        df = df.drop(columns=to_drop)

if df.shape[1] < 2:
    st.error("Not enough features left to analyze relationships.")
    st.stop()

# -----------------------------------------------------
# STEP 4: Discover Relationships (PC algorithm)
# -----------------------------------------------------
st.subheader("Identifying Key Relationships Between Factors")

data = df.to_numpy()
variable_names = df.columns.tolist()

with st.spinner("Discovering relationships..."):
    try:
        cg = pc(data, alpha=0.05, indep_test="fisherz", labels=variable_names)
        edges = []
        for i in range(len(cg.G.graph)):
            for j in range(len(cg.G.graph)):
                if cg.G.graph[i][j] != 0:
                    edges.append((variable_names[i], variable_names[j]))
        edges = list(set(edges))
        st.success(f"Identified {len(edges)} directional relationships.")
    except ValueError as e:
        st.error(f"Relationship discovery failed: {e}")
        st.stop()

# -----------------------------------------------------
# STEP 5: Visualize Relationship Map
# -----------------------------------------------------
G_causal = nx.DiGraph()
for u, v in edges:
    G_causal.add_edge(u, v)

st.write(f"Relationship map: {G_causal.number_of_nodes()} variables, {G_causal.number_of_edges()} connections.")

def visualize_graph(graph):
    net = Network(height="650px", width="100%", directed=True, bgcolor="#ffffff", font_color="#000000")
    net.set_options("""
    var options = {
      "nodes": {"shape": "dot","size": 18,"color": {"background": "#6BAED6","border": "#2171B5"}},
      "edges": {"color": {"color": "#9E9E9E"},"arrows": {"to": {"enabled": true}}},
      "physics": {"enabled": true,"barnesHut": {"gravitationalConstant": -2000}}
    }""")
    net.from_nx(graph)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    net.save_graph(tmp.name)
    return tmp.name

if G_causal.number_of_edges() > 0:
    graph_path = visualize_graph(G_causal)
    with open(graph_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    st.components.v1.html(html_content, height=650, scrolling=True)
st.caption("Each arrow represents an estimated direction of influence between factors.")

# -----------------------------------------------------
# STEP 6: Measure Influence Strength
# -----------------------------------------------------
st.subheader("Measuring How Each Factor Affects Results")

Y_cols = st.multiselect("Select result metrics (outcomes):", df.columns)
T_cols = st.multiselect("Select input factors (drivers):", [c for c in df.columns if c not in Y_cols])

if not Y_cols or not T_cols:
    st.warning("Please select at least one input and one outcome variable.")
    st.stop()

results = []
with st.spinner("Estimating influence strength..."):
    for Y_col in Y_cols:
        for T_col in T_cols:
            if T_col == Y_col:
                continue
            try:
                Y = df[Y_col].values
                T = df[T_col].values
                X = df.drop(columns=[Y_col, T_col]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))
                model = CausalForestDML(
                    model_t=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
                    model_y=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
                    random_state=42,
                )
                model.fit(Y, T, X=X)
                effect = model.effect(X)
                avg_effect = np.mean(effect)
                results.append((T_col, Y_col, avg_effect))
            except Exception as e:
                st.warning(f"Skipping {T_col} → {Y_col}: {e}")

if results:
    result_df = pd.DataFrame(results, columns=["Input Factor", "Result Metric", "Estimated Impact"])
    result_df = result_df.sort_values(by="Estimated Impact", ascending=False)
    st.dataframe(result_df, use_container_width=True)

    st.write("Heatmap of influence strength (blue = positive, red = negative).")
    pivot = result_df.pivot(index="Input Factor", columns="Result Metric", values="Estimated Impact").fillna(0)
    fig, ax = plt.subplots(figsize=(10, 6))
    sns.heatmap(pivot, cmap="coolwarm", center=0, annot=True, fmt=".2f", ax=ax)
    st.pyplot(fig)

# -----------------------------------------------------
# STEP 7: What-If Scenario Planner
# -----------------------------------------------------
st.subheader("What-If Scenario Planner")
st.write("Adjust an input factor and view how the selected business results may change.")

sim_T = st.selectbox("Select an input factor to adjust:", T_cols)
default_Ys = Y_cols if len(Y_cols) > 0 else list(df.columns.drop(sim_T))
sim_Ys = st.multiselect("Select result metrics to observe:", default_Ys, default=default_Ys)
unit_label = st.text_input("Units for the selected factor (optional)", value="")

if sim_T and len(sim_Ys) > 0:
    # Handle categorical or numeric current value
    if sim_T in label_encoders:
        le_T = label_encoders[sim_T]
        unique_cats = le_T.classes_.tolist()
        current_mean_T = unique_cats[int(round(df[sim_T].mean()))]
        st.write(f"Current average category for {sim_T}: {current_mean_T}")
        new_cat = st.selectbox(f"Select new category for {sim_T}:", unique_cats)
        new_value_T = le_T.transform([new_cat])[0]
        delta_T = new_value_T - df[sim_T].mean()
    else:
        current_mean_T = float(df[sim_T].mean())
        st.write(f"Current average of {sim_T}: {current_mean_T:.3f}" + (f" {unit_label}" if unit_label else ""))
        sim_mode = st.radio("Change mode:", ("Set new value", "Apply percentage change"), horizontal=True)
        if sim_mode == "Set new value":
            new_value_T = st.number_input(f"Enter new value for {sim_T}", value=current_mean_T, format="%.3f")
            delta_T = new_value_T - current_mean_T
        else:
            pct_change = st.number_input(f"Enter percentage change for {sim_T}", value=0.0, format="%.2f")
            delta_T = current_mean_T * (pct_change / 100.0)
            new_value_T = current_mean_T + delta_T

    if st.button("Run Scenario"):
        sim_rows = []
        for sim_Y in sim_Ys:
            try:
                Y = df[sim_Y].values
                T = df[sim_T].values
                X = df.drop(columns=[sim_Y, sim_T]).values if df.shape[1] > 2 else np.zeros((len(Y), 0))
                model = CausalForestDML(
                    model_t=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
                    model_y=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
                    random_state=42,
                )
                model.fit(Y, T, X=X)
                cate = model.effect(X)
                delta_Y = float(np.mean(cate) * delta_T)
                baseline_mean_Y = float(np.mean(Y))
                new_mean_Y = baseline_mean_Y + delta_Y

                # Decode categorical outcomes back to original labels if needed
                if sim_Y in label_encoders:
                    le_Y = label_encoders[sim_Y]
                    baseline_label = le_Y.inverse_transform([int(round(baseline_mean_Y))])[0]
                    new_label = le_Y.inverse_transform([min(max(int(round(new_mean_Y)), 0), len(le_Y.classes_) - 1)])[0]
                    display_change = f"{baseline_label} → {new_label}"
                else:
                    pct_delta_Y = (delta_Y / baseline_mean_Y * 100.0) if baseline_mean_Y != 0 else np.nan
                    display_change = f"{baseline_mean_Y:.3f} → {new_mean_Y:.3f} ({pct_delta_Y:.2f}%)"

                sim_rows.append({
                    "Input Factor": sim_T,
                    "Result Metric": sim_Y,
                    "Change Observed": display_change,
                    "Units": unit_label
                })
            except Exception as e:
                st.warning(f"Simulation failed for {sim_T} → {sim_Y}: {e}")

        if sim_rows:
            sim_df = pd.DataFrame(sim_rows)
            st.dataframe(sim_df, use_container_width=True)

st.caption("All results are automatically decoded to show original category names for clarity.")
