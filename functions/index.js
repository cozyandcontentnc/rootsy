// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

try { admin.initializeApp(); } catch {}
const db = admin.firestore();

function sendJson(res, status, obj) {
  res.set("content-type", "application/json").status(status).send(JSON.stringify(obj));
}

// GET /plantsSearch?filter=term
exports.plantsSearch = onRequest({ region: "us-east1" }, async (req, res) => {
  try {
    const q = String(req.query.filter || "").trim().toLowerCase();
    if (!q) return sendJson(res, 400, { error: "Missing ?filter" });

    const snap = await db.collection("plants")
      .orderBy("name_lower")
      .startAt(q)
      .endAt(q + "\uf8ff")
      .limit(25)
      .get();

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return sendJson(res, 200, { data, total: data.length });
  } catch (e) {
    return sendJson(res, 500, { error: String(e?.message || e) });
  }
});

// GET /plantShow/:slug
exports.plantShow = onRequest({ region: "us-east1" }, async (req, res) => {
  try {
    const slug = (req.path.split("/").pop() || "").trim();
    if (!slug) return sendJson(res, 400, { error: "Missing slug" });

    const docRef = db.collection("plants").doc(slug);
    const snap = await docRef.get();
    if (!snap.exists) return sendJson(res, 404, { error: "Not found" });

    return sendJson(res, 200, { data: snap.data() });
  } catch (e) {
    return sendJson(res, 500, { error: String(e?.message || e) });
  }
});
