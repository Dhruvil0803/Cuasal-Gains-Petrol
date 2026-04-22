# =====================================================
# 🌳 Interactive Causal Graph Dashboard (with Business Insights)
# =====================================================

import json
import pandas as pd
import numpy as np
import networkx as nx
import tempfile
from pyvis.network import Network
from causallearn.search.ConstraintBased.PC import pc
from causallearn.utils.GraphUtils import GraphUtils
from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import streamlit as st

# -------------------------
# STEP 1: Load Neo4j-exported data
# -------------------------
file_path = r"C:\Users\DhruvilPatel\Desktop\GAINS\neo4j_full_export.json"

with open(file_path, "r") as f:
    graph_data = json.load(f)

# Build readable graph
G = nx.DiGraph()
for node in graph_data["nodes"]:
    node_id = node["id"]
    labels = node.get("labels", [])
    props = node.get("props", {})

    label_part = labels[0] if labels else "Node"
    display_name = f"{label_part}_{props.get('name', node_id)}"
    G.add_node(node_id, display_name=display_name, **props)

for rel in graph_data["relationships"]:
    G.add_edge(rel["start_id"], rel["end_id"], type=rel.get("type", "RELATIONSHIP"))

st.title("🧠 Causal Discovery + Causal Forest Simulator ")
st.write(f"Loaded graph: **{G.number_of_nodes()} nodes**, **{G.number_of_edges()} edges**")

# -------------------------
# STEP 2: Extract numeric data
# -------------------------
numeric_nodes, numeric_data = [], []
for node_id, props in G.nodes(data=True):
    nums = {k: v for k, v in props.items() if isinstance(v, (int, float))}
    if nums:
        numeric_nodes.append(G.nodes[node_id].get("display_name"))
        numeric_data.append(nums)

if not numeric_data:
    st.error("No numeric features found in your graph.")
    st.stop()

df = pd.DataFrame(numeric_data).fillna(0)
df.index = numeric_nodes

st.subheader("📊 Sample Numeric Data")
st.dataframe(df.head())

# -------------------------
# STEP 3: PC Algorithm for causal structure
# -------------------------
st.subheader("🔍 Discovering Causal Structure using PC Algorithm...")
data = df.to_numpy()
variable_names = df.columns.tolist()
cg = pc(data, alpha=0.05, indep_test="fisherz", labels=variable_names)

edges = []
for i in range(len(cg.G.graph)):
    for j in range(len(cg.G.graph)):
        if cg.G.graph[i][j] != 0:
            edges.append((variable_names[i], variable_names[j]))
edges = list(set(edges))

st.success(f"Detected {len(edges)} candidate causal edges.")

# -------------------------
# STEP 4: Visualize Causal Graph
# -------------------------
def visualize_graph(edges):
    H = nx.DiGraph()
    for src, tgt in edges:
        H.add_edge(src, tgt)
    net = Network(height="700px", width="100%", directed=True, bgcolor="#111", font_color="white")
    net.from_nx(H)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    net.save_graph(tmp.name)
    return tmp.name, H

graph_path, causal_graph = visualize_graph(edges)
st.components.v1.html(open(graph_path, "r", encoding="utf-8").read(), height=750, scrolling=True)

# -------------------------
# STEP 5: Base Causal Forest Model
# -------------------------
st.subheader("🌲 Causal Forest Estimation (Example: unit_cost → list_price)")

model = None
if "unit_cost" in df.columns and "list_price" in df.columns:
    Y = df["list_price"].values
    T = df["unit_cost"].values
    X = df.drop(["list_price", "unit_cost"], axis=1).values

    X_train, X_test, T_train, T_test, Y_train, Y_test = train_test_split(
        X, T, Y, test_size=0.2, random_state=42
    )

    model = CausalForestDML(
        model_t=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
        model_y=RandomForestRegressor(n_estimators=100, min_samples_leaf=10),
        random_state=42,
    )
    model.fit(Y_train, T_train, X=X_train)

    effect = model.effect(X_test)
    avg_effect = np.mean(effect)

    st.success(f"Estimated average effect of unit_cost → list_price: **{avg_effect:.4f}**")
    st.caption("This measures how changes in unit cost influence list price, on average.")
else:
    st.warning("unit_cost or list_price not found in dataset.")

# -------------------------
# STEP 6: Interactive Node Deletion Simulation
# -------------------------
st.subheader("🧩 Node Deletion Simulation ")

node_to_delete = st.selectbox("Select a node (variable) to delete:", df.columns.tolist())
simulate = st.button("Simulate Causal Impact After Deletion")

if simulate:
    st.info(f"Deleting node **{node_to_delete}** and recalculating effects...")

    # Remove node from graph + data
    updated_edges = [(a, b) for (a, b) in edges if a != node_to_delete and b != node_to_delete]
    updated_df = df.drop(columns=[node_to_delete])

    # Re-run Causal Forest simulation
    if model and "unit_cost" in updated_df.columns and "list_price" in updated_df.columns:
        Y = updated_df["list_price"].values
        T = updated_df["unit_cost"].values
        X = updated_df.drop(["list_price", "unit_cost"], axis=1).values

        model.fit(Y, T, X=X)
        effect = model.effect(X)
        avg_effect = np.mean(effect)

        st.success(f"New average effect after deleting '{node_to_delete}': **{avg_effect:.4f}**")

        # 💬 Business-friendly explanation
        if avg_effect > 0:
            st.info(
                f"💡 Removing **'{node_to_delete}'** makes other variables more sensitive to change "
                f"(average effect increased by **{avg_effect:.2f}**). "
                f"This means **'{node_to_delete}'** was stabilizing the system — "
                f"it used to absorb some of the variation between cost and price."
            )
        else:
            st.info(
                f"💡 Removing **'{node_to_delete}'** reduces sensitivity between variables "
                f"(average effect decreased by **{abs(avg_effect):.2f}**). "
                f"This means **'{node_to_delete}'** was amplifying interactions — "
                f"without it, the system becomes more stable."
            )
    else:
        st.warning("Key variables for causal effect not found after deletion.")

    # Re-visualize updated graph
    new_graph_path, _ = visualize_graph(updated_edges)
    st.components.v1.html(open(new_graph_path, "r", encoding="utf-8").read(), height=750, scrolling=True)

st.caption("🧠 Delete one variable to simulate its business impact on causal relationships.")
