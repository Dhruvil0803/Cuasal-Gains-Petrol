import React, { useMemo, useState } from "react";

/** -------- Providers & form schemas -------- */
const PROVIDERS = [
  { id: "postgres", label: "PostgreSQL - PostGIS", group: "Databases" },
  { id: "oracle", label: "Oracle Spatial", group: "Databases" },
  { id: "snowflake", label: "Snowflake", group: "Warehouses" },
  { id: "databricks", label: "Databricks", group: "Warehouses" },
  { id: "athena", label: "AWS Athena", group: "Warehouses" },
  { id: "duckdb", label: "DuckDB", group: "Databases" },
  { id: "iceberg", label: "Apache Iceberg", group: "Tables/Lakes" },
  { id: "sedona", label: "Apache Sedona", group: "GIS/Spark" },

  { id: "shapefile", label: "ESRI Shapefile", group: "Files" },
  { id: "filegdb", label: "ESRI File GDB", group: "Files" },
  { id: "arcgis_rest", label: "ArcGIS REST Services", group: "Services" },
];

/** Schema for each provider: fields to collect */
const SCHEMAS = {
  postgres: [
    { name: "host", label: "Host", required: true },
    { name: "port", label: "Port", type: "number", placeholder: "5432", required: true },
    { name: "database", label: "Database", required: true },
    { name: "user", label: "User", required: true },
    { name: "password", label: "Password", type: "password", required: true },
    { name: "ssl", label: "Use SSL", type: "checkbox" },
  ],
  oracle: [
    { name: "host", label: "Host", required: true },
    { name: "port", label: "Port", type: "number", placeholder: "1521", required: true },
    { name: "service_name", label: "Service name / SID", required: true },
    { name: "user", label: "User", required: true },
    { name: "password", label: "Password", type: "password", required: true },
  ],
  snowflake: [
    { name: "account", label: "Account (e.g. abcd-xy123)", required: true },
    { name: "user", label: "User", required: true },
    { name: "password", label: "Password", type: "password", required: true },
    { name: "role", label: "Role" },
    { name: "warehouse", label: "Warehouse", required: true },
    { name: "database", label: "Database", required: true },
    { name: "schema", label: "Schema", required: true },
    { name: "authenticator", label: "Authenticator (optional)" },
  ],
  databricks: [
    { name: "workspace_url", label: "Workspace URL", placeholder: "https://adb-******.azuredatabricks.net", required: true },
    { name: "http_path", label: "SQL Warehouse HTTP Path", required: true },
    { name: "access_token", label: "Personal Access Token", type: "password", required: true },
    { name: "catalog", label: "Catalog (optional)" },
    { name: "schema", label: "Schema (optional)" },
  ],
  athena: [
    { name: "region", label: "AWS Region", placeholder: "us-east-1", required: true },
    { name: "database", label: "Database", required: true },
    { name: "workgroup", label: "Workgroup", placeholder: "primary", required: true },
    { name: "s3_staging_dir", label: "S3 Staging Dir", placeholder: "s3://bucket/prefix/", required: true },
    { name: "access_key_id", label: "Access Key ID", required: true },
    { name: "secret_access_key", label: "Secret Access Key", type: "password", required: true },
    { name: "session_token", label: "Session Token (optional)" },
  ],
  duckdb: [
    { name: "file", label: "DuckDB File (.duckdb)", type: "file", accept: ".duckdb", required: true },
    { name: "read_only", label: "Open read-only", type: "checkbox" },
  ],
  iceberg: [
    { name: "catalog_type", label: "Catalog Type", type: "select", options: ["glue", "hive", "rest"], required: true },
    { name: "catalog_name", label: "Catalog Name", required: true },
    { name: "warehouse_path", label: "Warehouse Path / URI", required: true },
    { name: "rest_uri", label: "REST URI (if using rest)", placeholder: "https://...", },
  ],
  sedona: [
    { name: "spark_endpoint", label: "Spark Endpoint / Master", placeholder: "local[*] or spark://...", required: true },
    { name: "packages", label: "Maven Packages (comma-separated)", placeholder: "org.apache.sedona:sedona-sql-3.5_2.12:1.5.1, ..." },
    { name: "conf", label: "Extra Spark Conf (key=value lines)", type: "textarea", placeholder: "spark.executor.memory=4g\n..." },
  ],
  shapefile: [
    { name: "zip", label: "Upload Shapefile (.zip with .shp/.shx/.dbf/.prj)", type: "file", accept: ".zip", required: true },
    { name: "layer_name", label: "Layer Name (optional)" },
  ],
  filegdb: [
    { name: "zip", label: "Upload FileGDB (.gdb or .zip)", type: "file", accept: ".zip,.gdb", required: true },
    { name: "layer_name", label: "Feature Class (optional)" },
  ],
  arcgis_rest: [
    { name: "service_url", label: "Service URL", placeholder: "https://.../ArcGIS/rest/services/...", required: true },
    { name: "username", label: "Username (optional)" },
    { name: "password", label: "Password (optional)", type: "password" },
  ],
};

const styles = {
  wrap: { display: "grid", gridTemplateRows: "auto 1fr", height: "100%", background: "#0b0e14", color: "#e5e7eb" },
  head: { padding: "12px 16px", borderBottom: "1px solid #1f2937", display: "flex", gap: 12, alignItems: "center" },
  select: { background: "#0b1220", border: "1px solid #334155", color: "#e5e7eb", borderRadius: 8, padding: "8px 10px" },
  card: { margin: 16, padding: 16, background: "#0f1116", border: "1px solid #2c313c", borderRadius: 10 },
  grid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 8 },
  input: { width: "100%", background: "#0b0f16", border: "1px solid #243042", color: "#e5e7eb", borderRadius: 8, padding: "8px 10px" },
  textarea: { width: "100%", minHeight: 120, background: "#0b0f16", border: "1px solid #243042", color: "#e5e7eb", borderRadius: 8, padding: "8px 10px" },
  file: { display: "block", padding: "8px 10px", background: "#0b0f16", border: "1px dashed #243042", borderRadius: 8, color: "#cbd5e1" },
  actions: { marginTop: 16, display: "flex", gap: 8 },
  btn: { background: "#1f2937", border: "1px solid #334155", color: "#e5e7eb", padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700 },
  hint: { marginTop: 8, color: "#94a3b8", fontSize: 12 },
};

export default function ConnectPage({ onSubmit }) {
  const [provider, setProvider] = useState("");
  const schema = useMemo(() => (provider ? SCHEMAS[provider] || [] : []), [provider]);
  const [values, setValues] = useState({});

  const grouped = useMemo(() => {
    const g = {};
    for (const p of PROVIDERS) {
      g[p.group] = g[p.group] || [];
      g[p.group].push(p);
    }
    return g;
  }, []);

  function reset() {
    setValues({});
  }

  function handleChange(field, value) {
    setValues(v => ({ ...v, [field]: value }));
  }

  function submit() {
    // Build a clean payload. File inputs will be File objects if chosen.
    const payload = { provider, params: values };
    // You can wire this to your backend; for now hand to parent or log.
    onSubmit?.(payload);
    // eslint-disable-next-line no-console
    if (!onSubmit) console.log("Connect payload:", payload);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Connect a Data Source</div>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); reset(); }}
          style={styles.select}
        >
          <option value="">Select a source…</option>
          {Object.entries(grouped).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={styles.card}>
        {!provider && <div style={{ color: "#94a3b8" }}>Choose a source from the dropdown to see its connection form.</div>}

        {provider && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              {PROVIDERS.find(p => p.id === provider)?.label}
            </div>
            <div style={styles.grid}>
              {schema.map(f => {
                const commonProps = {
                  key: f.name,
                  id: f.name,
                  required: !!f.required,
                  placeholder: f.placeholder || "",
                  value: values[f.name] ?? "",
                  onChange: e => handleChange(f.name, e.target.value),
                  style: styles.input,
                };

                if (f.type === "checkbox") {
                  return (
                    <label key={f.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!values[f.name]}
                        onChange={e => handleChange(f.name, e.target.checked)}
                      />
                      {f.label}
                    </label>
                  );
                }

                if (f.type === "select") {
                  return (
                    <label key={f.name}>
                      <div style={{ marginBottom: 6, color: "#cbd5e1" }}>{f.label}{f.required ? " *" : ""}</div>
                      <select
                        value={values[f.name] ?? ""}
                        onChange={e => handleChange(f.name, e.target.value)}
                        style={styles.input}
                      >
                        <option value="">Select…</option>
                        {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  );
                }

                if (f.type === "textarea") {
                  return (
                    <label key={f.name} style={{ gridColumn: "1 / -1" }}>
                      <div style={{ marginBottom: 6, color: "#cbd5e1" }}>{f.label}{f.required ? " *" : ""}</div>
                      <textarea
                        value={values[f.name] ?? ""}
                        onChange={e => handleChange(f.name, e.target.value)}
                        placeholder={f.placeholder || ""}
                        style={styles.textarea}
                      />
                    </label>
                  );
                }

                if (f.type === "file") {
                  return (
                    <label key={f.name}>
                      <div style={{ marginBottom: 6, color: "#cbd5e1" }}>{f.label}{f.required ? " *" : ""}</div>
                      <input
                        type="file"
                        onChange={e => handleChange(f.name, e.target.files?.[0] || null)}
                        accept={f.accept}
                        style={styles.file}
                      />
                    </label>
                  );
                }

                return (
                  <label key={f.name}>
                    <div style={{ marginBottom: 6, color: "#cbd5e1" }}>{f.label}{f.required ? " *" : ""}</div>
                    <input
                      type={f.type || "text"}
                      {...commonProps}
                    />
                  </label>
                );
              })}
            </div>

            {/* Hints per provider */}
            <div style={styles.hint}>
              {provider === "shapefile" && "Upload a .zip containing .shp, .shx, .dbf, and .prj."}
              {provider === "filegdb" && "Upload a zipped .gdb folder or a .gdb file."}
              {provider === "databricks" && "Get HTTP Path from your SQL Warehouse details; use a PAT token."}
              {provider === "snowflake" && "Account is typically like org-account or abcd-xy123."}
              {provider === "athena" && "Ensure your S3 staging bucket is writable and in the same region."}
              {provider === "arcgis_rest" && "Paste a REST service or layer URL; credentials are optional for public services."}
            </div>

            <div style={styles.actions}>
              <button style={styles.btn} onClick={submit}>Connect</button>
              <button style={{ ...styles.btn, background: "#0b1220" }} onClick={reset}>Reset</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
