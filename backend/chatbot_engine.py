"""
LangGraph chatbot engine — exposes a single `chat()` function
used by the FastAPI /api/chat endpoint.
"""
import os
from typing import Annotated
from typing_extensions import TypedDict

import requests as req
from dotenv import load_dotenv
from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

load_dotenv()

BASE_URL = "http://localhost:8000/api"


# ── State ─────────────────────────────────────────────────────────────────────
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


# ── Tools ─────────────────────────────────────────────────────────────────────
@tool
def get_all_sensors() -> dict:
    """
    Get the latest real-time readings for all 5 pipeline sensors: S001, S002, S003, S004, S005.
    Each sensor returns sensor_id, name, location, status (normal/warning/critical),
    and latest pressure (bar), temperature (°C), flow_rate (L/m), fuel_level (%).
    Use when the user asks for a general overview, current status, or wants to see all sensors.
    """
    return req.get(f"{BASE_URL}/sensors").json()


@tool
def get_sensor_data(sensor_id: str, limit: int = 50) -> dict:
    """
    Get time-series historical readings for a specific sensor.
    sensor_id: one of S001, S002, S003, S004, S005.
    limit: number of recent data points (default 50, max ~200).
    Use when the user asks about historical trends for a specific sensor.
    """
    return req.get(f"{BASE_URL}/sensors/{sensor_id}", params={"limit": limit}).json()


@tool
def get_sensor_stats(sensor_id: str) -> dict:
    """
    Get statistical summary (min, max, mean, std) for a specific sensor.
    sensor_id: one of S001, S002, S003, S004, S005.
    Also returns status counts (normal/warning/critical readings).
    Use when the user asks about averages, min/max values, or sensor statistics.
    """
    return req.get(f"{BASE_URL}/sensors/{sensor_id}/stats").json()


@tool
def get_combined_data(limit: int = 100) -> dict:
    """
    Get combined data from all 5 sensors merged into a single flat dataset.
    limit: number of records to return (default 100).
    Use when the user wants to compare all sensors side by side in one call.
    """
    return req.get(f"{BASE_URL}/combined", params={"limit": limit}).json()


@tool
def get_pipeline_graph() -> dict:
    """
    Get the full 100-node pipeline network topology with all connections.
    Returns nodes (wells, pump stations, compressors, junctions, storage tanks,
    refineries, terminals, distribution centers) and edges between them.
    Network covers Permian Basin, Eagle Ford, Gulf Coast, and Cushing Hub.
    Use when the user asks about the pipeline network, nodes, or infrastructure layout.
    """
    return req.get(f"{BASE_URL}/graph").json()


@tool
def get_shared_data(sensor_a: str, sensor_b: str) -> dict:
    """
    Compare two sensors and calculate their correlation.
    sensor_a, sensor_b: sensor IDs from S001-S005.
    Returns correlation coefficients per metric and mean values per sensor.
    Use when the user asks to compare or find correlations between two sensors.
    """
    return req.get(f"{BASE_URL}/shared-data", params={"sensor_a": sensor_a, "sensor_b": sensor_b}).json()


@tool
def get_impact_analysis(node_id: str) -> dict:
    """
    Analyze cascade failure impact if a pipeline node fails.
    node_id: e.g. PS001, W001, CS001, PJ001, ST001, REF001.
    Returns directly_affected, transitively_affected nodes, data_lost, is_critical_path.
    Use when the user asks what happens if a node fails or about downstream impact.
    """
    return req.get(f"{BASE_URL}/impact/{node_id}").json()


@tool
def get_anomaly_analysis(node_id: str, event_type: str = None, severity: str = None) -> dict:
    """
    Run anomaly detection and risk scoring for a pipeline node.
    node_id: e.g. PS001, W001, CS001, ST001.
    event_type (optional): hurricane, earthquake, winter_storm, extreme_heat,
                            flash_flood, power_grid_failure, wildfire, cyber_attack.
    severity (optional): low, medium, or high.
    Returns anomaly_score (0-100), risk_level, time_to_critical, per-metric analysis,
    downstream affected nodes, and recommendations.
    Use when the user asks about anomalies, risk levels, or what-if disaster scenarios.
    """
    params = {}
    if event_type:
        params["event_type"] = event_type
    if severity:
        params["severity"] = severity
    return req.get(f"{BASE_URL}/anomaly/{node_id}", params=params).json()


@tool
def get_event_impact(event_type: str, severity: str = "high") -> dict:
    """
    Simulate impact of a disaster event across the entire 100-node pipeline network.
    event_type: hurricane, earthquake, winter_storm, extreme_heat,
                flash_flood, power_grid_failure, wildfire, cyber_attack.
    severity: low, medium, or high (default: high).
    Returns impact scores per node, counts by risk level, and recommendations.
    Use when the user asks to simulate a disaster or network-wide event.
    """
    return req.get(f"{BASE_URL}/event-impact", params={"event_type": event_type, "severity": severity}).json()


@tool
def get_live_hazards() -> dict:
    """
    Fetch real-time hazard data: USGS earthquakes (M3.0+, past 14 days) and
    NOAA weather alerts for Texas and Oklahoma.
    Use when the user asks about current hazards, live threats, or real-world risks.
    """
    return req.get(f"{BASE_URL}/live-hazards").json()


tools = [
    get_all_sensors,
    get_sensor_data,
    get_sensor_stats,
    get_combined_data,
    get_pipeline_graph,
    get_shared_data,
    get_impact_analysis,
    get_anomaly_analysis,
    get_event_impact,
    get_live_hazards,
]

# ── LLM ───────────────────────────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools)

SYSTEM_PROMPT = """You are a Pipeline Operations Assistant for a petrol IoT dashboard.

Before calling any tool, you MUST ask 2-3 clarifying questions if the user's request is vague or missing details.

Examples of when to ask:
- User says "check a sensor" → ask WHICH sensor (S001-S005)
- User says "analyze a node" → ask WHICH node ID (e.g. PS001, W001, CS001, ST001)
- User says "simulate a disaster" → ask WHICH event type AND severity (low/medium/high)
- User says "show me impact" → ask WHICH node and what kind of impact
- User says "compare sensors" → ask WHICH two sensors to compare

Only call a tool when you have all required parameters confirmed by the user.
Be concise and highlight critical alerts prominently.
"""


# ── Graph ─────────────────────────────────────────────────────────────────────
def tool_calling_llm(state: State):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    return {"messages": [llm_with_tools.invoke(messages)]}


memory = MemorySaver()
graph_builder = StateGraph(State)
graph_builder.add_node("tool_calling_llm", tool_calling_llm)
graph_builder.add_node("tools", ToolNode(tools))
graph_builder.add_edge(START, "tool_calling_llm")
graph_builder.add_conditional_edges("tool_calling_llm", tools_condition)
graph_builder.add_edge("tools", "tool_calling_llm")
graph = graph_builder.compile(checkpointer=memory)


# ── Public API ────────────────────────────────────────────────────────────────
def chat(message: str, thread_id: str = "default") -> str:
    """Send a message and return the assistant's reply. Thread ID preserves history."""
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke({"messages": [HumanMessage(content=message)]}, config=config)
    return result["messages"][-1].content
