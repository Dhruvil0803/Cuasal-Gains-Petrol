# Petrol IoT Sensor Monitoring System

MVP dashboard for monitoring 5 petrol pipeline IoT sensors with AI-powered impact analysis.

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

## Features

| Tab        | Description |
|-----------|-------------|
| Overview  | Live sensor cards + individual time-series charts + combined view |
| Graph     | Interactive pipeline network graph — click a node to see impact |
| Analysis  | Multi-sensor comparison + shared data correlation |

## Sensor Network

```
S001 (Pump Station Alpha)  ──┐
                              ├──▶ S003 (Pipeline Junction 1) ──▶ S005 (Refinery Inlet)
S002 (Pump Station Beta)   ──┘
S004 (Storage Tank West)                                       ──▶ S005
```

## API Endpoints

| Method | Path                          | Description |
|--------|-------------------------------|-------------|
| GET    | /api/sensors                  | All sensors + latest readings |
| GET    | /api/sensors/{id}             | Time-series data for one sensor |
| GET    | /api/sensors/{id}/stats       | Aggregate stats |
| GET    | /api/combined                 | All sensors combined |
| GET    | /api/graph                    | Node-edge graph data |
| GET    | /api/shared-data?sensor_a=&sensor_b= | Correlation between two sensors |
| GET    | /api/impact/{id}              | Impact analysis for removing a sensor |

## Data

CSV files are in `backend/data/sensors/`:
- `sensor_1.csv` — Pump Station Alpha
- `sensor_2.csv` — Pump Station Beta
- `sensor_3.csv` — Pipeline Junction 1
- `sensor_4.csv` — Storage Tank West
- `sensor_5.csv` — Refinery Inlet
- `combined.csv` — All sensors merged

Each file has 200 records (30-minute intervals from 2024-01-01).

