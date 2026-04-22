// server/routes-snowflake.js
import { Router } from "express";
import snowflake from "snowflake-sdk";
import fs from "fs";

const router = Router();

/** Read PKCS#8 (PEM) private key from disk or throw a clear error */
function readPrivateKeyPemOrThrow() {
  const p = process.env.SNOW_PRIVATE_KEY_PATH;
  if (!p) throw new Error("SNOW_PRIVATE_KEY_PATH is not set");
  if (!fs.existsSync(p)) throw new Error(`Private key file not found at ${p}`);
  const pem = fs.readFileSync(p, "utf8");
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Private key is not a PKCS#8 PEM (missing BEGIN PRIVATE KEY header)");
  }
  return pem; // PKCS#8 PEM string
}

/** Build a Snowflake connection using key-pair (JWT) auth only */
function makeConnectionWithKeyOnly() {
  const privateKey = readPrivateKeyPemOrThrow(); // PEM string
  const base = {
    account: process.env.SNOW_ACCOUNT,
    username: process.env.SNOW_USER,
    role: process.env.SNOW_ROLE,
    warehouse: process.env.SNOW_WAREHOUSE, // optional default
  };
  console.log("[snowflake] auth mode: KEY-PAIR (JWT)");
  return snowflake.createConnection({
    ...base,
    authenticator: "SNOWFLAKE_JWT", // IMPORTANT for key-pair auth
    privateKey,                     // PKCS#8 PEM string
  });
}

/** POST /api/snowflake/test — sanity check / safe connect */
router.post("/test", (_req, res) => {
  for (const k of ["SNOW_ACCOUNT", "SNOW_USER", "SNOW_ROLE", "SNOW_WAREHOUSE"]) {
    if (!process.env[k]) {
      return res.status(500).json({ ok: false, error: `Missing env: ${k}` });
    }
  }

  let conn;
  try {
    conn = makeConnectionWithKeyOnly(); // no password fallback
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
      seen: { SNOW_PRIVATE_KEY_PATH: process.env.SNOW_PRIVATE_KEY_PATH || null },
    });
  }

  conn.connect((err) => {
    if (err) return res.status(500).json({ ok: false, error: `Connect failed: ${err.message}` });

    const exec = (sqlText) =>
      new Promise((resolve, reject) =>
        conn.execute({ sqlText, complete: (e, _stmt, rows) => (e ? reject(e) : resolve(rows)) })
      );

    (async () => {
      try {
        const rows = await exec("SELECT CURRENT_VERSION() AS VER");
        res.json({ ok: true, version: rows?.[0]?.VER || rows?.[0]?.CURRENT_VERSION || null });
      } catch (e) {
        res.status(500).json({ ok: false, error: e.message || String(e) });
      } finally {
        try { conn.destroy(() => {}); } catch {}
      }
    })();
  });
});

/** GET /api/snowflake/tables — list tables visible to current role */
// server/routes-snowflake.js  (only the /tables handler below needs replacing)
router.get("/tables", (_req, res) => {
  let conn;
  try {
    conn = makeConnectionWithKeyOnly();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  const exec = (sqlText) =>
    new Promise((resolve, reject) => {
      conn.execute({
        sqlText,
        complete: (e, _stmt, rows) => (e ? reject(e) : resolve(rows)),
      });
    });

  const execSafe = async (sql) => {
    try { return await exec(sql); } catch { return null; }
  };

  conn.connect(async (err) => {
    if (err) return res.status(500).json({ ok: false, error: `Connect failed: ${err.message}` });

    try {
      // If you configured a specific DB+schema in env, use the fast path via INFORMATION_SCHEMA
      const db = process.env.SNOW_DATABASE?.trim();
      const schema = process.env.SNOW_SCHEMA?.trim();

      if (db && schema) {
        // Make sure a warehouse is selected for SELECT queries; ignore if not granted
        if (process.env.SNOW_WAREHOUSE) await execSafe(`USE WAREHOUSE ${process.env.SNOW_WAREHOUSE}`);

        const sql = `
          SELECT
            table_catalog   AS "database",
            table_schema    AS "schema",
            table_name      AS "name",
            table_type      AS "type",
            row_count       AS "rows",
            bytes           AS "bytes",
            created,
            last_altered
          FROM ${db}.INFORMATION_SCHEMA.TABLES
          WHERE table_schema = '${schema}'
          ORDER BY table_catalog, table_schema, table_name;
        `;
        const rows = (await exec(sql)) || [];
        return res.json({ ok: true, tables: rows });
      }

      // Otherwise, enumerate everything your role can see with SHOW commands.
      // SHOW commands generally don't require a warehouse.
      const tables = [];

      // 1) Databases visible to this role
      const dbRows = (await execSafe("SHOW DATABASES")) || [];
      const dbNames = dbRows
        .map(r => r.name ?? r.NAME)
        .filter(Boolean);

      for (const dbName of dbNames) {
        // 2) Schemas in each database
        const schemas = (await execSafe(`SHOW SCHEMAS IN DATABASE "${dbName}"`)) || [];
        const schemaNames = schemas.map(r => r.name ?? r.NAME).filter(Boolean);

        for (const sch of schemaNames) {
          // 3) Tables in each schema (skip if not permitted)
          const trows = await execSafe(`SHOW TABLES IN SCHEMA "${dbName}"."${sch}"`);
          if (!trows) continue;

          for (const r of trows) {
            tables.push({
              database: r.database_name ?? r.DATABASE_NAME ?? dbName,
              schema:   r.schema_name   ?? r.SCHEMA_NAME   ?? sch,
              name:     r.name          ?? r.NAME,
              type:     r.kind          ?? r.KIND,
              rows:     r.rows          ?? r.ROWS,
              bytes:    r.bytes         ?? r.BYTES,
              created:  r.created       ?? r.CREATED,
              owner:    r.owner         ?? r.OWNER,
              comment:  r.comment       ?? r.COMMENT,
            });
          }
        }
      }

      // Sort for stable UI
      tables.sort((a, b) =>
        `${a.database}.${a.schema}.${a.name}`.localeCompare(`${b.database}.${b.schema}.${b.name}`)
      );

      res.json({ ok: true, tables });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  });
});

// GET /api/snowflake/table-details?db=&schema=&table=
router.get("/table-details", (req, res) => {
  const db = (req.query.db || "").trim();
  const schema = (req.query.schema || "").trim();
  const table = (req.query.table || "").trim();
  if (!db || !schema || !table) {
    return res.status(400).json({ ok: false, error: "Missing db/schema/table query params" });
  }

  let conn;
  try {
    conn = makeConnectionWithKeyOnly();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  const exec = (sqlText) =>
    new Promise((resolve, reject) => {
      conn.execute({
        sqlText,
        complete: (e, _stmt, rows) => (e ? reject(e) : resolve(rows)),
      });
    });

  const qIdent = (s) => `"${String(s).replaceAll('"', '""')}"`;

  conn.connect(async (err) => {
    if (err) return res.status(500).json({ ok: false, error: `Connect failed: ${err.message}` });

    try {
      // Get table meta (rows, bytes, owner, comment) via SHOW (no warehouse required)
      const metaRows = await exec(
        `SHOW TABLES LIKE '${table}' IN SCHEMA ${qIdent(db)}.${qIdent(schema)}`
      );
      const meta = metaRows?.[0] || {};
      const info = {
        database: db,
        schema,
        name: table,
        type: meta.KIND ?? meta.kind,
        rows: meta.ROWS ?? meta.rows,
        bytes: meta.BYTES ?? meta.bytes,
        owner: meta.OWNER ?? meta.owner,
        comment: meta.COMMENT ?? meta.comment,
        created: meta.CREATED ?? meta.created,
        cluster_by: meta.CLUSTER_BY ?? meta.cluster_by,
      };

      // Get column definitions (no warehouse required)
      const cols = await exec(
        `SHOW COLUMNS IN TABLE ${qIdent(db)}.${qIdent(schema)}.${qIdent(table)}`
      );
      const columns = (cols || []).map((r) => ({
        name: r.COLUMN_NAME ?? r.column_name,
        type: r.DATA_TYPE ?? r.data_type,
        nullable: (r.NULLABLE ?? r.nullable) === "Y",
        default: r.COLUMN_DEFAULT ?? r.column_default,
        comment: r.COMMENT ?? r.comment,
        kind: r.KIND ?? r.kind,
        autoincrement: r.AUTOINCREMENT ?? r.autoincrement,
      }));

      res.json({ ok: true, info, columns });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  });
});

// GET /api/snowflake/geo?layer=customers|roads|orders|warehouses&limit=5000
// GET /api/snowflake/geo?layer=customers|roads|orders|warehouses&limit=1000
// GET /api/snowflake/geo?layer=customers|roads|orders|warehouses&limit=1000
// GET /api/snowflake/geo?layer=customers|roads|orders|warehouses&limit=1000
// GET /api/snowflake/geo?layer=customers|roads|orders|warehouses|toyota_dealers&limit=1000
router.get("/geo", (req, res) => {
  const layer = String(req.query.layer || "").toLowerCase();
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || "1000", 10) || 1000, 5000));

  const DB = process.env.SNOW_DATABASE || "SEDONA_TEST";
  const SC = process.env.SNOW_SCHEMA || "VEHICLE_TRACKING";

  // 👇 Add your new layer here (change DB/SC for TOYOTA_DEALERS if it lives elsewhere)
  const LAYERS = {
    customers:       { table: `${DB}.${SC}.CUSTOMERS` },
    orders:          { table: `${DB}.${SC}.ORDERS` },
    roads:           { table: `${DB}.${SC}.PRIMARY_ROADS` },
    warehouses:      { table: `${DB}.${SC}.WAREHOUSES` },
    toyota_dealers:  { table: `${DB}.${SC}.TOYOTA_DEALERS` },   // ← NEW
  };

  if (!LAYERS[layer]) {
    return res.status(400).json({
      ok: false,
      error: `Unknown layer '${layer}'. Use one of: ${Object.keys(LAYERS).join(", ")}`
    });
  }

  let conn;
  try { conn = makeConnectionWithKeyOnly(); }
  catch (e) { return res.status(500).json({ ok: false, error: e.message }); }

  const exec = (sqlText) => new Promise((resolve, reject) => {
    conn.execute({ sqlText, complete: (e, _stmt, rows) => (e ? reject(e) : resolve(rows)) });
  });

  const q = (s) => `"${String(s).replaceAll(`"`, `""`) }"`;

  const [db, sc, tbl] = LAYERS[layer].table.split(".");
  const fq = `${q(db)}.${q(sc)}.${q(tbl)}`;

  conn.connect(async (err) => {
    if (err) return res.status(500).json({ ok: false, error: `Connect failed: ${err.message}` });

    try {
      if (!process.env.SNOW_WAREHOUSE) {
        throw new Error("SNOW_WAREHOUSE is not set; a warehouse is required for SELECT.");
      }
      await exec(`USE WAREHOUSE ${process.env.SNOW_WAREHOUSE}`);

      // 1) Inspect columns
      const cols = await exec(`SHOW COLUMNS IN TABLE ${fq}`);
      const allCols = (cols || []).map(r => ({
        name: r.COLUMN_NAME ?? r.column_name ?? r.NAME ?? r.name,
        type: String(r.DATA_TYPE ?? r.data_type ?? "").toUpperCase()
      }));

      // 2) Choose geometry: prefer native GEOGRAPHY; else LAT/LON (supports GEO_CD_LAT/GEO_CD_LON)
      let geomCol =
        allCols.find(c => c.type === "GEOGRAPHY")?.name ||
        ["GEOM","GEOGRAPHY","GEOMETRY","SHAPE"].find(n =>
          allCols.some(c => (c.name || "").toUpperCase() === n)
        );

      let geoExpr = null;
      if (geomCol) {
        geoExpr = `${q(geomCol)}`;
      } else {
        const findByName = (re) => (allCols.find(c => re.test(c.name || ""))?.name || null);
        const latCol = findByName(/^(GEO_CD_LAT|LAT|LATITUDE)$/i);
        const lonCol = findByName(/^(GEO_CD_LON|LON|LNG|LONGITUDE)$/i);
        if (latCol && lonCol) {
          // POINT(lon lat) -> GEOGRAPHY
          geoExpr = `TRY_TO_GEOGRAPHY('POINT(' || ${q(lonCol)} || ' ' || ${q(latCol)} || ')')`;
        }
      }

      if (!geoExpr) {
        return res.status(400).json({
          ok:false,
          error:`No geometry found in ${fq}. Expected a GEOGRAPHY column or LAT/LON columns (e.g., GEO_CD_LAT/GEO_CD_LON).`
        });
      }

      // 3) Build PROPS without GEOGRAPHY columns (OBJECT_CONSTRUCT can't take GEOGRAPHY)
// --- 3) Decide how to build PROPS and final SQL ---

// Detect the common "GEOM + PROPS" pattern (like your ROADS table)
const hasGeomCol = !!allCols.find(
  c => (c.name || "").toUpperCase() === "GEOM" && /GEOGRAPHY/i.test(c.type || "")
);
const hasPropsObj = !!allCols.find(
  c => (c.name || "").toUpperCase() === "PROPS" && /OBJECT/i.test(c.type || "")
);

let sql;

// Fast path: if table has GEOM (GEOGRAPHY) and PROPS (OBJECT), just pass them through.
if (hasGeomCol && hasPropsObj) {
  sql = `
    WITH flt AS (
      SELECT TRY_TO_GEOGRAPHY(${q('GEOM')}) AS __geo, ${q('PROPS')} AS __props
      FROM ${fq}
      WHERE TRY_TO_GEOGRAPHY(${q('GEOM')}) IS NOT NULL
      LIMIT ${limit}
    )
    SELECT
      TO_VARCHAR(ST_ASGEOJSON(__geo)) AS GEOJSON,
      __props AS PROPS
    FROM flt
  `;
} else {
  // Generic path: exclude any GEOGRAPHY-typed columns from props and cast remaining values to text

  // columns whose type contains 'GEOGRAPHY'
  const geoTypeCols = allCols
    .filter(c => /GEOGRAPHY/i.test(String(c.type || "")))
    .map(c => c.name)
    .filter(Boolean);

  // exclude our temp __geo plus real GEOGRAPHY columns
  const excludeCols = new Set(["__geo", ...geoTypeCols.map(n => String(n))]);

  // columns to keep in PROPS
  const nonGeoCols = allCols
    .map(c => c.name)
    .filter(Boolean)
    .filter(n => !excludeCols.has(n));

  // OBJECT_CONSTRUCT of non-GEOGRAPHY cols, coerce to VARCHAR to avoid type issues
  const propPairs = nonGeoCols.length
    ? nonGeoCols.map(n => `'${n}', TO_VARCHAR(${q(n)})`).join(",\n      ")
    : `'__placeholder', NULL`;

  // IMPORTANT: __geo stays unquoted; quote real column names we’re excluding.
  const excludeList = ["__geo", ...geoTypeCols.map(n => q(n))].join(", ");

  sql = `
    WITH src AS (
      SELECT ${geoExpr} AS __geo, * FROM ${fq}
    ),
    flt AS (
      SELECT __geo, * EXCLUDE ${excludeList}
      FROM src
      WHERE __geo IS NOT NULL
      LIMIT ${limit}
    )
    SELECT
      TO_VARCHAR(ST_ASGEOJSON(__geo)) AS GEOJSON,
      OBJECT_CONSTRUCT(
        ${propPairs}
      ) AS PROPS
    FROM flt
  `;
}

const rows = await exec(sql);


      // 5) Convert to FeatureCollection
      const features = [];
      for (const r of rows || []) {
        const gj = r.GEOJSON ?? r.geojson;
        if (!gj) continue;

        let geometry = null;
        if (typeof gj === "string") {
          try { geometry = JSON.parse(gj); } catch { /* ignore */ }
        } else if (gj && typeof gj === "object" && gj.type) {
          geometry = gj;
        }
        if (!geometry) continue;

        const props = r.PROPS || r.props || {};
        features.push({ type: "Feature", geometry, properties: props });
      }

      res.json({ ok: true, type: "FeatureCollection", features, meta: { table: fq } });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  });
});

// GET /api/snowflake/table-data?db=&schema=&table=&limit=100
// GET /api/snowflake/table-data?db=&schema=&table=&limit=100
router.get("/table-data", (req, res) => {
  const db = (req.query.db || "").trim();
  const schema = (req.query.schema || "").trim();
  const table = (req.query.table || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit || "100", 10) || 100, 1), 1000);

  if (!db || !schema || !table) {
    return res.status(400).json({ ok: false, error: "Missing db/schema/table" });
  }

  let conn;
  try { conn = makeConnectionWithKeyOnly(); }
  catch (e) { return res.status(500).json({ ok: false, error: e.message }); }

  const exec = (sqlText) =>
    new Promise((resolve, reject) => {
      conn.execute({ sqlText, complete: (e, _stmt, rows) => (e ? reject(e) : resolve(rows)) });
    });

  const q = (s) => `"${String(s).replaceAll(`"`, `""`)}"`;
  const fqn = `${q(db)}.${q(schema)}.${q(table)}`;

  conn.connect(async (err) => {
    if (err) return res.status(500).json({ ok: false, error: `Connect failed: ${err.message}` });

    const ctx = {};
    const safeCtx = async () => {
      try {
        const rows = await exec(`SELECT CURRENT_ROLE() AS ROLE, CURRENT_WAREHOUSE() AS WH, CURRENT_DATABASE() AS DB, CURRENT_SCHEMA() AS SCH`);
        Object.assign(ctx, rows?.[0] || {});
      } catch {}
    };

    try {
      if (!process.env.SNOW_WAREHOUSE) throw new Error("SNOW_WAREHOUSE is not set; a warehouse is required for SELECT.");
      try { await exec(`USE WAREHOUSE ${process.env.SNOW_WAREHOUSE}`); }
      catch (e) { await safeCtx(); throw new Error(`Could not USE WAREHOUSE ${process.env.SNOW_WAREHOUSE}. Ensure your role has USAGE on it. (${e.message})`); }

      // Discover columns and which ones are GEOGRAPHY
      const cols = await exec(`SHOW COLUMNS IN TABLE ${fqn}`);
      const allCols = (cols || []).map(r => ({
        name: r.COLUMN_NAME ?? r.column_name ?? r.NAME ?? r.name,
        type: String(r.DATA_TYPE ?? r.data_type ?? "").toUpperCase()
      }));

      // Build a projection that stringifies geographies as GeoJSON
      const selectList = allCols.map(c => {
        const cn = q(c.name);
        if (c.type === "GEOGRAPHY") {
          // Return GeoJSON text under the *same* column name
          return `ST_ASGEOJSON(TRY_TO_GEOGRAPHY(${cn})) AS ${cn}`;
        }
        return cn;
      }).join(", ");

      const sql = `SELECT ${selectList} FROM ${fqn} LIMIT ${limit}`;
      const rows = await exec(sql);
      res.json({ ok: true, rows });
    } catch (e) {
      await safeCtx();
      const msg = String(e.message || e);
      let hint = "";
      if (/does not exist|cannot be performed/i.test(msg)) {
        hint =
          `\nHints:\n` +
          `• Role needs USAGE on database ${q(db)} and schema ${q(schema)}\n` +
          `• Role needs SELECT on table ${fqn}\n` +
          `• Role needs USAGE on warehouse ${process.env.SNOW_WAREHOUSE}`;
      }
      res.status(500).json({
        ok: false,
        error: `SQL error: ${msg}${hint}`,
        context: { role: ctx.ROLE || null, warehouse: ctx.WH || null, database: ctx.DB || null, schema: ctx.SCH || null, table: fqn },
      });
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  });
});

export default router;
