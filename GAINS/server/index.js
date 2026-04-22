// server/index.js
// import "dotenv/config";
// --- ENV LOADING (server) ---
// --- ENV LOADING (server) ---
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env (Snowflake secrets live here)
dotenv.config({ path: path.join(__dirname, ".env") });

// Optionally also load project-root .env.local (if you ever add overrides there)
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// TEMP: visibility check (remove later)
console.log("ENV check (server):", {
  SNOW_ACCOUNT: process.env.SNOW_ACCOUNT,
  SNOW_USER: process.env.SNOW_USER,
  SNOW_ROLE: process.env.SNOW_ROLE,
  SNOW_WAREHOUSE: process.env.SNOW_WAREHOUSE,
});


import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import geocodeProxy from "./geocodeProxy.js";
import llmRoutes from "./routes-llm.js";
import snowflakeRoutes from "./routes-snowflake.js";
import authRouter, { configureAuth } from "./auth.js";

const app = express();

// If deploying behind a proxy in production, consider enabling:
// app.set("trust proxy", 1);

// JSON body parsing (2 MB cap is usually enough)
// CORS for dev/proxy; allows credentials cookies
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Session cookies (dev: MemoryStore)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // enable when serving over HTTPS
    },
  })
);

// Passport auth
app.use(passport.initialize());
app.use(passport.session());

// Initialize Google OAuth strategy after env + session are ready
try {
  configureAuth();
  console.log("[auth] Google OAuth configured");
} catch (e) {
  console.warn("[auth] Google OAuth not configured:", e.message);
}

// Require login for protected API routes
function requireAuth(req, res, next) {
  if (typeof req.isAuthenticated === "function") {
    if (req.isAuthenticated()) return next();
  } else if (req.user) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Protect all /api/* and /llm/* endpoints
app.use("/api", requireAuth);
app.use("/llm", requireAuth);

// READ
app.post("/api/neo4j/query", async (req, res) => {
  const { cypher, params } = req.body || {};
  if (!cypher) return res.status(400).json({ error: "cypher required" });

  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params || {});
    res.json({ records: result.records.map(r => r.toObject()) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

// WRITE (optional)
// app.post("/api/neo4j/write", async (req, res) => {
//   const { cypher, params } = req.body || {};
//   if (!cypher) return res.status(400).json({ error: "cypher required" });

//   const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
//   try {
//     const result = await session.run(cypher, params || {});
//     res.json({ records: result.records.map(r => r.toObject()) });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   } finally {
//     await session.close();
//   }
// });

// graceful shutdown
process.on("SIGINT", async () => { await driver.close(); process.exit(0); });

// === Neo4j over HTTP (additive & safe) ===
// === Neo4j via HTTP (additive + reversible) ===

// NEW: LLM routes under /llm/*
app.use("/llm", llmRoutes);

//SNOWFLAKE
app.use("/api/snowflake", snowflakeRoutes);

// Auth routes
app.use("/auth", authRouter);


// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Your existing geo proxy// keeps its own internal paths
app.use(geocodeProxy); 
// 404 catch-all
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
