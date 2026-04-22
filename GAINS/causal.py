from neo4j import GraphDatabase
import json
from datetime import date, datetime

# --- Connection details ---
uri = "neo4j://107.21.198.63:7687"  # or "neo4j+s://" if SSL needed
user = "neo4j"
password = "Ascentt-GraphDB"

driver = GraphDatabase.driver(uri, auth=(user, password))

# --- Custom JSON Encoder for Neo4j date/time objects ---
class Neo4jJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        try:
            # Fallback to string for any unknown Neo4j types
            return str(obj)
        except Exception:
            return super().default(obj)

def export_data():
    with driver.session() as session:
        print("✅ Connected to Neo4j successfully!")

        # Fetch all nodes
        print("📦 Fetching all nodes...")
        node_query = "MATCH (n) RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props"
        nodes = [record.data() for record in session.run(node_query)]

        # Fetch all relationships
        print("🔗 Fetching all relationships...")
        rel_query = """
        MATCH (a)-[r]->(b)
        RETURN 
            elementId(a) AS start_id,
            elementId(b) AS end_id,
            type(r) AS type,
            properties(r) AS props
        """
        relationships = [record.data() for record in session.run(rel_query)]

        # Combine and save
        graph_data = {
            "nodes": nodes,
            "relationships": relationships
        }

        with open("neo4j_full_export.json", "w") as f:
            json.dump(graph_data, f, indent=2, cls=Neo4jJSONEncoder)

        print("✅ Export complete! Data saved as neo4j_full_export.json")

if __name__ == "__main__":
    export_data()
    driver.close()
