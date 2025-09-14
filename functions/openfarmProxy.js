// functions/openfarmProxy.js
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize once
try { admin.app(); } catch { admin.initializeApp(); }

// CORS helper (simple & permissive; tighten if you want)
function withCors(handler) {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.status(204).end();
    return handler(req, res);
  };
}

// Read token from secret at runtime
const TREFLE_TOKEN = process.env.TREFLE_TOKEN;

// Map Trefle plant object to a small OpenFarm-like shape
function mapPlant(p) {
  return {
    id: p.id,
    slug: String(p.id),                     // use ID as slug surrogate
    name: p.common_name || p.scientific_name,
    binomial_name: p.scientific_name,
    description: p.family_common_name || "",
    main_image_path: p.image_url || null,
  };
}

// GET /cropsSearch?filter=tomato&page=1  (OpenFarm-like)
export const cropsSearch = functions.https.onRequest(
  withCors(async (req, res) => {
    try {
      const q = String(req.query.filter || "").trim();
      const page = Number(req.query.page || 1);
      if (!TREFLE_TOKEN) return res.status(500).json({ error: "Missing TREFLE_TOKEN" });
      if (!q) return res.status(400).json({ error: "Missing ?filter" });

      const url = new URL("https://trefle.io/api/v1/plants/search");
      url.searchParams.set("token", TREFLE_TOKEN);
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));

      const r = await fetch(url);
      if (!r.ok) throw new Error(`Trefle search failed: ${r.status}`);
      const data = await r.json();

      res.json({
        data: (data.data || []).map(mapPlant),
        meta: { total: data.meta?.total || 0, page },
      });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  })
);

// GET /cropShow/:id  -> returns a single plant, enriched with species growth if available
export const cropShow = functions.https.onRequest(
  withCors(async (req, res) => {
    try {
      if (!TREFLE_TOKEN) return res.status(500).json({ error: "Missing TREFLE_TOKEN" });
      const pathParts = req.path.split("/").filter(Boolean);
      const id = pathParts[pathParts.length - 1];
      if (!id) return res.status(400).json({ error: "Missing plant id" });

      const plantUrl = new URL(`https://trefle.io/api/v1/plants/${id}`);
      plantUrl.searchParams.set("token", TREFLE_TOKEN);

      const plantResp = await fetch(plantUrl);
      if (!plantResp.ok) throw new Error(`Trefle plant failed: ${plantResp.status}`);
      const plantJson = await plantResp.json();
      const base = mapPlant(plantJson.data);

      // OPTIONAL: Hit species endpoint for growth data (watering, shade, duration, etc.)
      let growth = {};
      try {
        // For many entries, species ID equals plant ID; if not, this still often works.
        const speciesUrl = new URL(`https://trefle.io/api/v1/species/${id}`);
        speciesUrl.searchParams.set("token", TREFLE_TOKEN);
        const speciesResp = await fetch(speciesUrl);
        if (speciesResp.ok) {
          const speciesJson = await speciesResp.json();
          const s = speciesJson.data || {};
          growth = {
            growth_habit: s.growth_habit ?? null,
            duration: s.duration ?? null,
            edible_part: s.edible_part ?? null,
            growth: s.growth ?? null, // contains min/max temp, shade, etc. (if present)
          };
        }
      } catch {
        // silently ignore enrichment failure
      }

      res.json({ data: { ...base, ...growth } });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  })
);
