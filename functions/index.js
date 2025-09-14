// functions/index.js (CommonJS, Node 20)
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Secrets
const TREFLE_TOKEN = defineSecret("TREFLE_TOKEN");

// CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function sendJson(res, status, obj, extraHeaders = {}) {
  res
    .set({
      "content-type": "application/json",
      "cache-control":
        "public, max-age=0, s-maxage=43200, stale-while-revalidate=86400",
      ...corsHeaders(),
      ...extraHeaders,
    })
    .status(status)
    .send(JSON.stringify(obj));
}

function mapPlant(p) {
  return {
    id: p.id,
    slug: String(p.id), // use ID as slug surrogate
    name: p.common_name || p.scientific_name,
    binomial_name: p.scientific_name,
    description: p.family_common_name || "",
    main_image_path: p.image_url || null,
  };
}

// GET /cropsSearch?filter=tomato&page=1
exports.cropsSearch = onRequest(
  { region: "us-east1", cors: false, secrets: [TREFLE_TOKEN] },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders()).status(204).send("");
      return;
    }

    try {
      const token = TREFLE_TOKEN.value();
      if (!token) return sendJson(res, 500, { error: "Missing TREFLE_TOKEN" });

      const q = String(req.query.filter || "").trim();
      const page = Number(req.query.page || 1);
      if (!q) return sendJson(res, 400, { error: "Missing ?filter" });

      const url = new URL("https://trefle.io/api/v1/plants/search");
      url.searchParams.set("token", token);
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));

      const upstream = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        return sendJson(res, upstream.status, {
          error: `Trefle search failed: ${upstream.status}`,
          body: text,
        });
      }

      const data = await upstream.json();
      const payload = {
        data: Array.isArray(data?.data) ? data.data.map(mapPlant) : [],
        meta: { total: data?.meta?.total || 0, page },
      };

      sendJson(res, 200, payload);
    } catch (e) {
      sendJson(res, 500, { error: String(e?.message || e) });
    }
  }
);

// GET /cropShow/:id  -> returns mapped plant + optional species growth fields
exports.cropShow = onRequest(
  { region: "us-east1", cors: false, secrets: [TREFLE_TOKEN] },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(corsHeaders()).status(204).send("");
      return;
    }

    try {
      const token = TREFLE_TOKEN.value();
      if (!token) return sendJson(res, 500, { error: "Missing TREFLE_TOKEN" });

      const segments = String(req.path || "")
        .split("/")
        .filter(Boolean);
      const id = segments[segments.length - 1];
      if (!id) return sendJson(res, 400, { error: "Missing plant id" });

      // Fetch plant
      const plantUrl = new URL(`https://trefle.io/api/v1/plants/${id}`);
      plantUrl.searchParams.set("token", token);

      const plantResp = await fetch(plantUrl.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!plantResp.ok) {
        const text = await plantResp.text().catch(() => "");
        return sendJson(res, plantResp.status, {
          error: `Trefle plant failed: ${plantResp.status}`,
          body: text,
        });
      }

      const plantJson = await plantResp.json();
      const base = mapPlant(plantJson?.data || {});

      // Optional enrichment from species endpoint (best-effort)
      let growth = {};
      try {
        const speciesUrl = new URL(`https://trefle.io/api/v1/species/${id}`);
        speciesUrl.searchParams.set("token", token);
        const speciesResp = await fetch(speciesUrl.toString(), {
          headers: { Accept: "application/json" },
        });
        if (speciesResp.ok) {
          const speciesJson = await speciesResp.json();
          const s = speciesJson?.data || {};
          growth = {
            growth_habit: s.growth_habit ?? null,
            duration: s.duration ?? null,
            edible_part: s.edible_part ?? null,
            growth: s.growth ?? null,
          };
        }
      } catch {
        // ignore enrichment failures silently
      }

      sendJson(res, 200, { data: { ...base, ...growth } });
    } catch (e) {
      sendJson(res, 500, { error: String(e?.message || e) });
    }
  }
);
