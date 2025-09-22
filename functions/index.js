// functions/index.js
// CommonJS + Firebase Functions v2
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

try { admin.initializeApp(); } catch {}
const db = admin.firestore();

function sendJson(res, status, obj) {
  res
    .set("content-type", "application/json")
    .status(status)
    .send(JSON.stringify(obj));
}

/* =========================
   Legacy endpoints you had
   ========================= */

// GET /plantsSearch?filter=term  (your private per-user "plants" collection)
exports.plantsSearch = onRequest({ region: "us-east1" }, async (req, res) => {
  try {
    const q = String(req.query.filter || "").trim().toLowerCase();
    if (!q) return sendJson(res, 400, { error: "Missing ?filter" });

    const snap = await db
      .collection("plants")
      .orderBy("name_lower")
      .startAt(q)
      .endAt(q + "\uf8ff")
      .limit(25)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

/* =========================
   Shared public catalog
   ========================= */

// Build simple n-grams for prefix search
function buildNgrams(s) {
  const base = String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim();
  const tokens = base.split(/\s+/).filter(Boolean);
  const grams = new Set();
  for (const t of tokens) {
    for (let i = 2; i <= Math.min(t.length, 15); i++) grams.add(t.slice(0, i));
  }
  return Array.from(grams).slice(0, 300);
}

// GET /publicPlantsSearch?prefix=tom
exports.publicPlantsSearch = onRequest({ region: "us-east1" }, async (req, res) => {
  try {
    const prefix = String(req.query.prefix || "").trim().toLowerCase();
    if (!prefix) return sendJson(res, 400, { error: "Missing ?prefix" });

    const q = db
      .collection("publicPlants")
      .where("search.ngrams", "array-contains", prefix)
      .orderBy("commonName")
      .limit(25);

    const snap = await q.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return sendJson(res, 200, { data, total: data.length });
  } catch (e) {
    logger.error(e);
    return sendJson(res, 500, { error: String(e?.message || e) });
  }
});

// GET /publicPlantShow/:id
exports.publicPlantShow = onRequest({ region: "us-east1" }, async (req, res) => {
  try {
    const id = (req.path.split("/").pop() || "").trim();
    if (!id) return sendJson(res, 400, { error: "Missing id" });

    const ref = db.collection("publicPlants").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return sendJson(res, 404, { error: "Not found" });

    return sendJson(res, 200, { data: { id, ...snap.data() } });
  } catch (e) {
    logger.error(e);
    return sendJson(res, 500, { error: String(e?.message || e) });
  }
});

// Autopublish low-risk proposal updates
const LOW_RISK_FIELDS = new Set([
  "tags",
  "daysToMaturity",
  "sowing",
  "water",
  "sun",
  "soilNotes",
  "sourceRefs",
]);

exports.onPlantProposalCreate = onDocumentCreated(
  { region: "us-east1", document: "plantProposals/{proposalId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const p = snap.data();

    const diff = { ...(p.diff || {}) };
    if (typeof diff.commonName === "string") diff.commonName = diff.commonName.trim();
    if (typeof diff.scientificName === "string")
      diff.scientificName = diff.scientificName.trim();

    const grams = buildNgrams(`${diff.commonName || ""} ${diff.scientificName || ""}`);

    const isUpdate =
      p.type === "update" && typeof p.targetId === "string" && p.targetId.length > 0;
    const autoPublishable =
      isUpdate && Object.keys(diff).every((k) => LOW_RISK_FIELDS.has(k));

    // Always stamp createdAt
    await snap.ref.set(
      { createdAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (!isUpdate || !autoPublishable) {
      await snap.ref.set({ status: "pending" }, { merge: true });
      return;
    }

    // Autopublish low-risk update to /publicPlants and write a version snapshot
    const plantRef = db.collection("publicPlants").doc(p.targetId);
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(plantRef);
      if (!cur.exists) throw new Error("Target public plant does not exist");

      const merged = {
        ...cur.data(),
        ...diff,
        search: { ngrams: grams.length ? grams : cur.get("search.ngrams") || [] },
        meta: {
          ...(cur.get("meta") || {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: p.createdBy || null,
        },
      };

      tx.set(plantRef, merged, { merge: true });

      const versionRef = db.collection("plantVersions").doc();
      tx.set(versionRef, {
        plantId: plantRef.id,
        snapshot: merged,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedBy: p.createdBy || null,
        proposalId: snap.id,
      });

      tx.update(snap.ref, {
        status: "autopublished",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: p.createdBy || null,
      });
    });
  }
);
