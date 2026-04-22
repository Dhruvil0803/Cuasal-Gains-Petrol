// server/geocodeProxy.js
import express from "express";

const router = express.Router();

router.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const zip = String(req.query.zip || "").trim();

  if (!q && !zip) {
    return res.status(400).json({ error: "q or zip required" });
  }

  try {
    let url;
    if (q) {
      // generic US address search
      url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(q)}` +
        `&countrycodes=us&format=json&addressdetails=1&limit=5`;
    } else {
      // legacy ZIP-only lookup (kept for compatibility)
      url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
        zip
      )}&countrycodes=us&format=json&limit=1`;
    }

    const r = await fetch(url, {
      headers: { "User-Agent": "GraphBloomZipOverlay/1.0" },
    });

    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: "geocoder failed", status: r.status });
    }

    const arr = await r.json();
    if (!arr?.length) return res.status(404).json({ error: "not found" });

    if (q) {
      const suggestions = arr.map((p) => ({
        label: p.display_name,
        lat: Number(p.lat),
        lon: Number(p.lon),
      }));
      return res.json({ ok: true, suggestions });
    }

    // ZIP mode: preserve original shape { lat, lon }
    const { lat, lon } = arr[0];
    res.json({ lat: Number(lat), lon: Number(lon) });
  } catch (e) {
    res.status(500).json({ error: "proxy error" });
  }
});

// Simple routing proxy using OSRM demo server (driving)
router.get("/api/route", async (req, res) => {
  const fromLat = Number(req.query.fromLat);
  const fromLon = Number(req.query.fromLon);
  const toLat = Number(req.query.toLat);
  const toLon = Number(req.query.toLon);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLon) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLon)
  ) {
    return res.status(400).json({ ok: false, error: "fromLat/fromLon/toLat/toLon are required" });
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: "routing service failed" });
    }
    const data = await r.json();
    const route = data.routes?.[0];
    if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
      return res.status(404).json({ ok: false, error: "no route found" });
    }

    // OSRM returns [lon, lat]; normalize to { lat, lon }
    const coordinates = route.geometry.coordinates.map(([lon, lat]) => ({
      lat: Number(lat),
      lon: Number(lon),
    }));

    res.json({
      ok: true,
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "route proxy error" });
  }
});

export default router;
