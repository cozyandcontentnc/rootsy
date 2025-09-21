// functions/openfarmProxy.js
// Firestore-backed replacement (no Trefle, no secrets)

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

// --- CORS (same as before; tighten if you want) ---
function withCors(handler) {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.status(204).end();
    return handler(req, res);
  };
}

// Map your Firestore plant doc to a small OpenFarm-like preview
function mapPreview(d) {
  const x = d.data() || {};
  return {
    id: x.slug || d.id,
    slug: x.slug || d.id,
    name: x.name || x.variety ? `${x.name || ""}${x.variety ? " — " + x.variety : ""}` : (x.name || "Unknown"),
    binomial_name: x.scientificName || null,
    description: x.description || "",
    main_image_path: x.imageUrl || null,
  };
}

// GET /cropsSearch?filter=term&page=1   (kept name for compatibility)
// - Prefix search on name_lower
// - If not enough, OR if multi-token, also tries keywords array
export const cropsSearch = functions.https.onRequest(withCors(async (req, res) => {
  try {
    const q = String(req.query.filter || "").trim().toLowerCase();
    if (!q) return res.status(400).json({ error: "Missing ?filter" });

    const tokens = q.split(/[^a-z0-9]+/g).filter(Boolean).slice(0, 10);
    const out = [];
    const seen = new Set();

    // 1) prefix search on name_lower
    const start = q;
    const end = q + "\uf8ff";
    const snap1 = await db.collection("plants")
      .orderBy("name_lower")
      .startAt(start)
      .endAt(end)
      .limit(25)
      .get();

    snap1.forEach(d => {
      const m = mapPreview(d);
      if (!seen.has(m.slug)) { seen.add(m.slug); out.push(m); }
    });

    // 2) keywords search (broad), if needed
    if (out.length < 25 && tokens.length) {
      const snap2 = await db.collection("plants")
        .where("keywords", "array-contains-any", tokens)
        .limit(25)
        .get();

      snap2.forEach(d => {
        const m = mapPreview(d);
        if (!seen.has(m.slug)) { seen.add(m.slug); out.push(m); }
      });
    }

    return res.json({
      data: out,
      meta: { total: out.length, upstream: "firestore" },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}));

// GET /cropShow/:slug  (kept name for compatibility)
// Returns the full plant doc (mapped)
export const cropShow = functions.https.onRequest(withCors(async (req, res) => {
  try {
    const parts = req.path.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    if (!slug) return res.status(400).json({ error: "Missing plant slug" });

    const snap = await db.collection("plants").doc(slug).get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });

    return res.json({ data: mapPreview(snap) });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}));
