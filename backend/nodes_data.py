"""
100-node US oil & gas pipeline network.
Covers: Permian Basin (TX) → Cushing Hub (OK) and Eagle Ford (TX) → Houston Ship Channel (TX).
Coordinates based on real US oil infrastructure locations.
"""
import random
random.seed(42)

def _r(lo, hi):
    return round(random.uniform(lo, hi), 2)

def _status():
    return random.choices(['normal', 'warning', 'critical'], weights=[70, 20, 10])[0]

NODE_TYPE_CONFIG = {
    'well':                {'color': '#6366f1', 'pr': (20,  80),  'te': (40,  90),  'fr': (10,  50),  'fl': (60, 100)},
    'pump_station':        {'color': '#3b82f6', 'pr': (40, 120),  'te': (30,  70),  'fr': (30, 100),  'fl': (40,  80)},
    'compressor_station':  {'color': '#8b5cf6', 'pr': (80, 200),  'te': (60, 110),  'fr': (50, 150),  'fl': (50,  80)},
    'pipeline_junction':   {'color': '#f59e0b', 'pr': (30,  90),  'te': (25,  55),  'fr': (50, 200),  'fl': (50,  80)},
    'metering_station':    {'color': '#06b6d4', 'pr': (20,  60),  'te': (20,  50),  'fr': (20,  80),  'fl': (65,  95)},
    'storage_tank':        {'color': '#10b981', 'pr': (5,   30),  'te': (18,  42),  'fr': (5,   40),  'fl': (20,  95)},
    'refinery':            {'color': '#ef4444', 'pr': (60, 140),  'te': (80, 150),  'fr': (100, 300),  'fl': (70,  95)},
    'terminal':            {'color': '#f97316', 'pr': (15,  50),  'te': (18,  38),  'fr': (150, 400),  'fl': (40,  90)},
    'distribution_center': {'color': '#84cc16', 'pr': (8,   25),  'te': (18,  35),  'fr': (30, 100),  'fl': (30,  80)},
    'field_office':        {'color': '#94a3b8', 'pr': (1,    5),  'te': (18,  32),  'fr': (1,    5),  'fl': (85, 100)},
}

def make_metrics(ntype):
    c = NODE_TYPE_CONFIG.get(ntype, NODE_TYPE_CONFIG['well'])
    return {
        'pressure':    _r(*c['pr']),
        'temperature': _r(*c['te']),
        'flow_rate':   _r(*c['fr']),
        'fuel_level':  _r(*c['fl']),
    }

ALL_NODES = {
    # ── PERMIAN BASIN, WEST TEXAS  (20 nodes) ─────────────────────────────────
    'W001':  {'name': 'Wolfcamp A Well 1',       'type': 'well',               'lat': 31.982, 'lng': -102.082},
    'W002':  {'name': 'Wolfcamp A Well 2',       'type': 'well',               'lat': 31.845, 'lng': -102.325},
    'W003':  {'name': 'Spraberry Well 1',        'type': 'well',               'lat': 32.012, 'lng': -102.412},
    'W004':  {'name': 'Spraberry Well 2',        'type': 'well',               'lat': 31.756, 'lng': -102.198},
    'W005':  {'name': 'Delaware Basin W-1',      'type': 'well',               'lat': 31.892, 'lng': -101.982},
    'W006':  {'name': 'Delaware Basin W-2',      'type': 'well',               'lat': 32.145, 'lng': -102.289},
    'W007':  {'name': 'Bone Spring Well 1',      'type': 'well',               'lat': 31.698, 'lng': -102.445},
    'W008':  {'name': 'Bone Spring Well 2',      'type': 'well',               'lat': 31.925, 'lng': -102.532},
    'W009':  {'name': 'Midland Basin W-1',       'type': 'well',               'lat': 32.056, 'lng': -101.825},
    'W010':  {'name': 'Midland Basin W-2',       'type': 'well',               'lat': 31.812, 'lng': -102.098},
    'W011':  {'name': 'Permian Deep W-1',        'type': 'well',               'lat': 31.645, 'lng': -102.312},
    'W012':  {'name': 'Permian Deep W-2',        'type': 'well',               'lat': 32.089, 'lng': -102.178},
    'W013':  {'name': 'West Texas Well Alpha',   'type': 'well',               'lat': 31.952, 'lng': -102.245},
    'W014':  {'name': 'West Texas Well Beta',    'type': 'well',               'lat': 31.878, 'lng': -101.912},
    'W015':  {'name': 'West Texas Well Gamma',   'type': 'well',               'lat': 32.112, 'lng': -102.098},
    'W016':  {'name': 'Odessa Basin W-1',        'type': 'well',               'lat': 31.725, 'lng': -102.178},
    'W017':  {'name': 'Odessa Basin W-2',        'type': 'well',               'lat': 31.998, 'lng': -102.365},
    'W018':  {'name': 'Reeves County Well',      'type': 'well',               'lat': 32.025, 'lng': -101.945},
    'W019':  {'name': 'Ward County Well',        'type': 'well',               'lat': 31.862, 'lng': -102.425},
    'W020':  {'name': 'Martin County Well',      'type': 'well',               'lat': 32.145, 'lng': -102.145},
    'PS001': {'name': 'Midland PS Alpha',        'type': 'pump_station',       'lat': 31.892, 'lng': -102.215},
    'PS002': {'name': 'Midland PS Beta',         'type': 'pump_station',       'lat': 31.982, 'lng': -102.345},
    'PS003': {'name': 'Permian PS South',        'type': 'pump_station',       'lat': 31.745, 'lng': -102.265},
    'PS004': {'name': 'Permian PS North',        'type': 'pump_station',       'lat': 32.045, 'lng': -102.125},
    'PS005': {'name': 'Spraberry PS',            'type': 'pump_station',       'lat': 31.925, 'lng': -102.178},
    'PS006': {'name': 'Delaware Basin PS',       'type': 'pump_station',       'lat': 31.812, 'lng': -102.312},
    'PS007': {'name': 'Wolfcamp PS',             'type': 'pump_station',       'lat': 32.012, 'lng': -102.245},
    'MS001': {'name': 'Permian Meter Station 1', 'type': 'metering_station',   'lat': 31.912, 'lng': -102.232},
    'MS002': {'name': 'Permian Meter Station 2', 'type': 'metering_station',   'lat': 31.978, 'lng': -102.298},
    'MS003': {'name': 'Permian Meter Station 3', 'type': 'metering_station',   'lat': 31.856, 'lng': -102.245},
    'MS004': {'name': 'Permian Meter Station 4', 'type': 'metering_station',   'lat': 32.045, 'lng': -102.198},
    'PJ001': {'name': 'Permian Junction Alpha',  'type': 'pipeline_junction',  'lat': 31.945, 'lng': -102.198},
    'PJ002': {'name': 'Permian Junction Beta',   'type': 'pipeline_junction',  'lat': 31.912, 'lng': -102.265},
    'PJ003': {'name': 'Permian Junction Gamma',  'type': 'pipeline_junction',  'lat': 32.012, 'lng': -102.198},
    'PJ004': {'name': 'Permian Junction Delta',  'type': 'pipeline_junction',  'lat': 31.878, 'lng': -102.285},
    'PJ005': {'name': 'Midland Trunk Junction',  'type': 'pipeline_junction',  'lat': 31.956, 'lng': -102.312},
    'PJ006': {'name': 'East Permian Junction',   'type': 'pipeline_junction',  'lat': 32.025, 'lng': -102.145},

    # ── EAGLE FORD SHALE, SOUTH TEXAS  (15 nodes) ─────────────────────────────
    'W021':  {'name': 'Eagle Ford Well 1',       'type': 'well',               'lat': 28.425, 'lng': -99.245},
    'W022':  {'name': 'Eagle Ford Well 2',       'type': 'well',               'lat': 28.198, 'lng': -98.945},
    'W023':  {'name': 'Eagle Ford Well 3',       'type': 'well',               'lat': 28.612, 'lng': -99.512},
    'W024':  {'name': 'Webb County Well',        'type': 'well',               'lat': 27.985, 'lng': -98.712},
    'W025':  {'name': 'Karnes County Well 1',    'type': 'well',               'lat': 28.345, 'lng': -99.125},
    'W026':  {'name': 'Karnes County Well 2',    'type': 'well',               'lat': 28.512, 'lng': -99.345},
    'W027':  {'name': 'La Salle County Well',    'type': 'well',               'lat': 27.892, 'lng': -98.845},
    'W028':  {'name': 'Dimmit County Well',      'type': 'well',               'lat': 28.145, 'lng': -99.012},
    'W029':  {'name': 'Frio County Well',        'type': 'well',               'lat': 28.456, 'lng': -99.289},
    'W030':  {'name': 'McMullen County Well',    'type': 'well',               'lat': 27.932, 'lng': -98.778},
    'PS008': {'name': 'Eagle Ford PS 1',         'type': 'pump_station',       'lat': 28.312, 'lng': -99.198},
    'PS009': {'name': 'Eagle Ford PS 2',         'type': 'pump_station',       'lat': 28.145, 'lng': -98.925},
    'PS010': {'name': 'Eagle Ford PS 3',         'type': 'pump_station',       'lat': 28.512, 'lng': -99.425},
    'PS011': {'name': 'South Texas PS',          'type': 'pump_station',       'lat': 27.945, 'lng': -98.778},
    'MS005': {'name': 'Eagle Ford Meter 1',      'type': 'metering_station',   'lat': 28.265, 'lng': -99.165},
    'MS006': {'name': 'Eagle Ford Meter 2',      'type': 'metering_station',   'lat': 28.178, 'lng': -98.965},
    'MS007': {'name': 'Eagle Ford Meter 3',      'type': 'metering_station',   'lat': 28.445, 'lng': -99.312},
    'PJ007': {'name': 'Eagle Ford Junction 1',   'type': 'pipeline_junction',  'lat': 28.345, 'lng': -99.245},
    'PJ008': {'name': 'Eagle Ford Junction 2',   'type': 'pipeline_junction',  'lat': 28.198, 'lng': -98.985},
    'PJ009': {'name': 'Eagle Ford Junction 3',   'type': 'pipeline_junction',  'lat': 28.525, 'lng': -99.378},
    'PJ010': {'name': 'South Texas Junction',    'type': 'pipeline_junction',  'lat': 28.012, 'lng': -98.812},

    # ── CUSHING HUB, OKLAHOMA  (6 storage tanks) ──────────────────────────────
    'ST001': {'name': 'Cushing Tank Farm 1',     'type': 'storage_tank',       'lat': 35.991, 'lng': -96.778},
    'ST002': {'name': 'Cushing Tank Farm 2',     'type': 'storage_tank',       'lat': 35.982, 'lng': -96.745},
    'ST003': {'name': 'Cushing Tank Farm 3',     'type': 'storage_tank',       'lat': 36.005, 'lng': -96.812},
    'ST004': {'name': 'Cushing Tank Farm 4',     'type': 'storage_tank',       'lat': 35.975, 'lng': -96.762},
    'ST005': {'name': 'Cushing Tank Farm 5',     'type': 'storage_tank',       'lat': 36.012, 'lng': -96.725},
    'ST006': {'name': 'Cushing Tank Farm 6',     'type': 'storage_tank',       'lat': 35.965, 'lng': -96.798},

    # ── HOUSTON / GULF COAST  (20 nodes) ──────────────────────────────────────
    'RF001': {'name': 'ExxonMobil Baytown Ref.', 'type': 'refinery',           'lat': 29.728, 'lng': -94.982},
    'RF002': {'name': 'Shell Deer Park Ref.',    'type': 'refinery',           'lat': 29.712, 'lng': -95.125},
    'RF003': {'name': 'Motiva Port Arthur Ref.', 'type': 'refinery',           'lat': 29.855, 'lng': -93.942},
    'ST007': {'name': 'Baytown Storage Tank',    'type': 'storage_tank',       'lat': 29.745, 'lng': -95.012},
    'ST008': {'name': 'Deer Park Storage Tank',  'type': 'storage_tank',       'lat': 29.698, 'lng': -95.145},
    'ST009': {'name': 'Port Arthur Tank',        'type': 'storage_tank',       'lat': 29.868, 'lng': -93.965},
    'TR001': {'name': 'Port of Houston Term.',   'type': 'terminal',           'lat': 29.728, 'lng': -95.212},
    'TR002': {'name': 'Houston Ship Channel',    'type': 'terminal',           'lat': 29.745, 'lng': -95.198},
    'TR003': {'name': 'Nederland Terminal',      'type': 'terminal',           'lat': 29.968, 'lng': -93.998},
    'DC001': {'name': 'Houston Dist. Center 1',  'type': 'distribution_center','lat': 29.762, 'lng': -95.398},
    'DC002': {'name': 'Houston Dist. Center 2',  'type': 'distribution_center','lat': 29.698, 'lng': -95.325},
    'DC003': {'name': 'Beaumont Dist. Center',   'type': 'distribution_center','lat': 30.012, 'lng': -94.152},
    'DC004': {'name': 'SE Texas Dist. Center',   'type': 'distribution_center','lat': 29.878, 'lng': -94.012},
    'PS012': {'name': 'Houston PS 1',            'type': 'pump_station',       'lat': 29.745, 'lng': -95.125},
    'PS013': {'name': 'Houston PS 2',            'type': 'pump_station',       'lat': 29.712, 'lng': -95.045},
    'MS008': {'name': 'Houston Meter 1',         'type': 'metering_station',   'lat': 29.732, 'lng': -95.085},
    'MS009': {'name': 'Houston Meter 2',         'type': 'metering_station',   'lat': 29.698, 'lng': -95.152},
    'PJ011': {'name': 'Houston Junction 1',      'type': 'pipeline_junction',  'lat': 29.745, 'lng': -95.098},
    'PJ012': {'name': 'Houston Junction 2',      'type': 'pipeline_junction',  'lat': 29.712, 'lng': -95.168},
    'PJ013': {'name': 'Port Arthur Junction',    'type': 'pipeline_junction',  'lat': 29.878, 'lng': -93.985},

    # ── PIPELINE CORRIDORS  (13 nodes) ────────────────────────────────────────
    # Permian → Cushing corridor
    'CS001': {'name': 'Abilene Compressor',      'type': 'compressor_station', 'lat': 32.452, 'lng': -99.728},
    'CS002': {'name': 'Breckenridge CS',         'type': 'compressor_station', 'lat': 32.758, 'lng': -98.902},
    'CS003': {'name': 'Wichita Falls CS',        'type': 'compressor_station', 'lat': 33.912, 'lng': -98.492},
    'CS004': {'name': 'Chickasha CS',            'type': 'compressor_station', 'lat': 34.842, 'lng': -97.895},
    'CS005': {'name': 'Guthrie CS (OK)',         'type': 'compressor_station', 'lat': 35.462, 'lng': -97.518},
    # Eagle Ford → Houston corridor
    'CS006': {'name': 'San Antonio CS',          'type': 'compressor_station', 'lat': 29.425, 'lng': -98.492},
    'CS007': {'name': 'Luling CS',               'type': 'compressor_station', 'lat': 29.612, 'lng': -97.145},
    'CS008': {'name': 'Columbus CS',             'type': 'compressor_station', 'lat': 29.685, 'lng': -96.025},
    # Intercity junctions
    'PJ014': {'name': 'Abilene Junction',        'type': 'pipeline_junction',  'lat': 32.425, 'lng': -99.745},
    'PJ015': {'name': 'Wichita Falls Junction',  'type': 'pipeline_junction',  'lat': 33.895, 'lng': -98.512},
    'PJ016': {'name': 'S. Oklahoma Junction',    'type': 'pipeline_junction',  'lat': 34.812, 'lng': -97.325},
    'PJ017': {'name': 'Cushing Junction',        'type': 'pipeline_junction',  'lat': 35.988, 'lng': -96.752},
    'PJ018': {'name': 'San Antonio Junction',    'type': 'pipeline_junction',  'lat': 29.412, 'lng': -98.502},
    'PJ019': {'name': 'Bay City Junction',       'type': 'pipeline_junction',  'lat': 29.012, 'lng': -96.025},

    # ── FIELD OFFICES  (2 nodes) ──────────────────────────────────────────────
    'FO001': {'name': 'Midland Field HQ',        'type': 'field_office',       'lat': 31.998, 'lng': -102.075},
    'FO002': {'name': 'Houston Operations HQ',   'type': 'field_office',       'lat': 29.762, 'lng': -95.378},
}

# ── Pipeline edges ────────────────────────────────────────────────────────────
ALL_EDGES = [
    # Permian wells → pump stations
    {'source': 'W001',  'target': 'PS001', 'label': 'feeds'},
    {'source': 'W002',  'target': 'PS001', 'label': 'feeds'},
    {'source': 'W003',  'target': 'PS002', 'label': 'feeds'},
    {'source': 'W004',  'target': 'PS002', 'label': 'feeds'},
    {'source': 'W005',  'target': 'PS003', 'label': 'feeds'},
    {'source': 'W006',  'target': 'PS002', 'label': 'feeds'},
    {'source': 'W007',  'target': 'PS003', 'label': 'feeds'},
    {'source': 'W008',  'target': 'PS003', 'label': 'feeds'},
    {'source': 'W009',  'target': 'PS004', 'label': 'feeds'},
    {'source': 'W010',  'target': 'PS004', 'label': 'feeds'},
    {'source': 'W011',  'target': 'PS005', 'label': 'feeds'},
    {'source': 'W012',  'target': 'PS005', 'label': 'feeds'},
    {'source': 'W013',  'target': 'PS005', 'label': 'feeds'},
    {'source': 'W014',  'target': 'PS006', 'label': 'feeds'},
    {'source': 'W015',  'target': 'PS006', 'label': 'feeds'},
    {'source': 'W016',  'target': 'PS001', 'label': 'feeds'},
    {'source': 'W017',  'target': 'PS007', 'label': 'feeds'},
    {'source': 'W018',  'target': 'PS007', 'label': 'feeds'},
    {'source': 'W019',  'target': 'PS004', 'label': 'feeds'},
    {'source': 'W020',  'target': 'PS006', 'label': 'feeds'},
    # Permian pump stations → metering
    {'source': 'PS001', 'target': 'MS001', 'label': 'metered'},
    {'source': 'PS002', 'target': 'MS002', 'label': 'metered'},
    {'source': 'PS003', 'target': 'MS001', 'label': 'metered'},
    {'source': 'PS004', 'target': 'MS003', 'label': 'metered'},
    {'source': 'PS005', 'target': 'MS002', 'label': 'metered'},
    {'source': 'PS006', 'target': 'MS004', 'label': 'metered'},
    {'source': 'PS007', 'target': 'MS003', 'label': 'metered'},
    # Permian metering → junctions
    {'source': 'MS001', 'target': 'PJ001', 'label': 'flows to'},
    {'source': 'MS002', 'target': 'PJ002', 'label': 'flows to'},
    {'source': 'MS003', 'target': 'PJ003', 'label': 'flows to'},
    {'source': 'MS004', 'target': 'PJ004', 'label': 'flows to'},
    {'source': 'PJ001', 'target': 'PJ002', 'label': 'flows to'},
    {'source': 'PJ003', 'target': 'PJ004', 'label': 'flows to'},
    {'source': 'PJ002', 'target': 'PJ005', 'label': 'flows to'},
    {'source': 'PJ004', 'target': 'PJ006', 'label': 'flows to'},
    {'source': 'PJ005', 'target': 'PJ006', 'label': 'flows to'},

    # ── PERMIAN → CUSHING TRUNK (Longhorn / Permian Express pipelines) ──
    {'source': 'PJ006', 'target': 'FO001',  'label': 'monitored'},
    {'source': 'PJ006', 'target': 'PJ014',  'label': 'trunk pipeline'},
    {'source': 'PJ014', 'target': 'CS001',  'label': 'compressed'},
    {'source': 'CS001', 'target': 'CS002',  'label': 'pipeline'},
    {'source': 'CS002', 'target': 'CS003',  'label': 'pipeline'},
    {'source': 'CS003', 'target': 'PJ015',  'label': 'flows to'},
    {'source': 'PJ015', 'target': 'CS004',  'label': 'compressed'},
    {'source': 'CS004', 'target': 'CS005',  'label': 'pipeline'},
    {'source': 'CS005', 'target': 'PJ016',  'label': 'flows to'},
    {'source': 'PJ016', 'target': 'PJ017',  'label': 'flows to'},
    {'source': 'PJ017', 'target': 'ST001',  'label': 'into Cushing'},
    {'source': 'PJ017', 'target': 'ST002',  'label': 'into Cushing'},
    {'source': 'PJ017', 'target': 'ST003',  'label': 'into Cushing'},
    {'source': 'PJ017', 'target': 'ST004',  'label': 'into Cushing'},
    {'source': 'PJ017', 'target': 'ST005',  'label': 'into Cushing'},
    {'source': 'PJ017', 'target': 'ST006',  'label': 'into Cushing'},

    # Cushing → Houston (Seaway Pipeline)
    {'source': 'ST001', 'target': 'PJ011',  'label': 'Seaway pipeline'},
    {'source': 'ST002', 'target': 'PJ011',  'label': 'Seaway pipeline'},
    {'source': 'ST003', 'target': 'PJ012',  'label': 'pipeline'},

    # ── EAGLE FORD LOCAL ──
    {'source': 'W021', 'target': 'PS008', 'label': 'feeds'},
    {'source': 'W022', 'target': 'PS008', 'label': 'feeds'},
    {'source': 'W023', 'target': 'PS010', 'label': 'feeds'},
    {'source': 'W024', 'target': 'PS009', 'label': 'feeds'},
    {'source': 'W025', 'target': 'PS009', 'label': 'feeds'},
    {'source': 'W026', 'target': 'PS010', 'label': 'feeds'},
    {'source': 'W027', 'target': 'PS011', 'label': 'feeds'},
    {'source': 'W028', 'target': 'PS009', 'label': 'feeds'},
    {'source': 'W029', 'target': 'PS011', 'label': 'feeds'},
    {'source': 'W030', 'target': 'PS008', 'label': 'feeds'},
    {'source': 'PS008', 'target': 'MS005', 'label': 'metered'},
    {'source': 'PS009', 'target': 'MS006', 'label': 'metered'},
    {'source': 'PS010', 'target': 'MS007', 'label': 'metered'},
    {'source': 'PS011', 'target': 'MS005', 'label': 'metered'},
    {'source': 'MS005', 'target': 'PJ007', 'label': 'flows to'},
    {'source': 'MS006', 'target': 'PJ008', 'label': 'flows to'},
    {'source': 'MS007', 'target': 'PJ009', 'label': 'flows to'},
    {'source': 'PJ007', 'target': 'PJ008', 'label': 'flows to'},
    {'source': 'PJ008', 'target': 'PJ009', 'label': 'flows to'},
    {'source': 'PJ009', 'target': 'PJ010', 'label': 'flows to'},

    # ── EAGLE FORD → HOUSTON (Enterprise / Kinder Morgan) ──
    {'source': 'PJ010', 'target': 'PJ018',  'label': 'pipeline'},
    {'source': 'PJ018', 'target': 'CS006',  'label': 'compressed'},
    {'source': 'CS006', 'target': 'CS007',  'label': 'pipeline'},
    {'source': 'CS007', 'target': 'CS008',  'label': 'pipeline'},
    {'source': 'CS008', 'target': 'PJ019',  'label': 'flows to'},
    {'source': 'PJ019', 'target': 'PJ013',  'label': 'flows to'},

    # ── HOUSTON HUB ──
    {'source': 'PJ011', 'target': 'PJ012',  'label': 'distribution'},
    {'source': 'PJ012', 'target': 'PJ013',  'label': 'distribution'},
    {'source': 'PS012', 'target': 'MS008',  'label': 'metered'},
    {'source': 'PS013', 'target': 'MS009',  'label': 'metered'},
    {'source': 'MS008', 'target': 'PJ011',  'label': 'flows to'},
    {'source': 'MS009', 'target': 'PJ012',  'label': 'flows to'},
    {'source': 'PJ011', 'target': 'RF001',  'label': 'feeds refinery'},
    {'source': 'PJ012', 'target': 'RF002',  'label': 'feeds refinery'},
    {'source': 'PJ013', 'target': 'RF003',  'label': 'feeds refinery'},
    {'source': 'RF001', 'target': 'ST007',  'label': 'stores'},
    {'source': 'RF002', 'target': 'ST008',  'label': 'stores'},
    {'source': 'RF003', 'target': 'ST009',  'label': 'stores'},
    {'source': 'ST007', 'target': 'TR001',  'label': 'exports'},
    {'source': 'ST008', 'target': 'TR002',  'label': 'exports'},
    {'source': 'ST009', 'target': 'TR003',  'label': 'exports'},
    {'source': 'TR001', 'target': 'DC001',  'label': 'distributes'},
    {'source': 'TR001', 'target': 'DC002',  'label': 'distributes'},
    {'source': 'TR002', 'target': 'DC002',  'label': 'distributes'},
    {'source': 'TR003', 'target': 'DC003',  'label': 'distributes'},
    {'source': 'TR003', 'target': 'DC004',  'label': 'distributes'},
    {'source': 'FO002', 'target': 'PJ012',  'label': 'monitors'},
]

def build_downstream():
    adj = {}
    for e in ALL_EDGES:
        adj.setdefault(e['source'], []).append(e['target'])
    return adj

DOWNSTREAM = build_downstream()
