// scripts/importPlantsFromCsv.cjs  (CommonJS)
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");
const slugify = require("slugify");

// Adjust if you moved the CSV
const CSV_FILE = path.resolve("assets/data/plants.csv");

// --- Firebase Admin init with your service account JSON ---
// Make sure serviceAccountKey.json is in your project root (one folder up from /scripts)
admin.initializeApp({
  credential: admin.credential.cert(require("../serviceAccountKey.json")),
});
const db = admin.firestore();

// --- helpers ---
function toSlug(s) { return slugify(s || "", { lower: true, strict: true }); }
function csvToArray(val) {
  return typeof val === "string"
    ? val.split(",").map((s) => s.trim()).filter(Boolean)
    : Array.isArray(val) ? val : [];
}
function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function buildKeywords(r) {
  const base = [
    r.name, r.variety, r.scientificName,
    ...csvToArray(r.aliases), ...csvToArray(r.tags),
  ].join(" ").toLowerCase();
  return Array.from(new Set(base.split(/[^a-z0-9]+/).filter(Boolean)));
}

// --- CSV load ---
if (!fs.existsSync(CSV_FILE)) {
  console.error(`CSV not found at: ${CSV_FILE}
→ Put your CSV at assets/data/plants.csv or update CSV_FILE above.`);
  process.exit(1);
}
const text = fs.readFileSync(CSV_FILE, "utf8");
const rows = parse(text, { columns: true, skip_empty_lines: true });

// --- import ---
(async () => {
  let count = 0;
  for (const r of rows) {
    const slug = (r.slug && String(r.slug).trim()) || toSlug(`${r.name}-${r.scientificName}`);

    const doc = {
      name: r.name || "",
      slug,
      scientificName: r.scientificName || "",
      family: r.family || "",
      type: r.type || "",
      variety: r.variety || "",
      tags: csvToArray(r.tags),
      aliases: csvToArray(r.aliases),
      description: r.description || "",
      sun: r.sun || "",
      water: r.water || "",
      soil: r.soil || "",
      phMin: numOrNull(r.phMin),
      phMax: numOrNull(r.phMax),

      sowingIndoorFrom: r.sowingIndoorFrom || "",
      sowingIndoorTo: r.sowingIndoorTo || "",
      sowingOutdoorFrom: r.sowingOutdoorFrom || "",
      sowingOutdoorTo: r.sowingOutdoorTo || "",
      transplantFrom: r.transplantFrom || "",
      transplantTo: r.transplantTo || "",
      harvestFrom: r.harvestFrom || "",
      harvestTo: r.harvestTo || "",

      daysToGerminateMin: numOrNull(r.daysToGerminateMin),
      daysToGerminateMax: numOrNull(r.daysToGerminateMax),
      daysToMaturityMin: numOrNull(r.daysToMaturityMin),
      daysToMaturityMax: numOrNull(r.daysToMaturityMax),
      spacingInRowIn: numOrNull(r.spacingInRowIn),
      spacingBetweenRowsIn: numOrNull(r.spacingBetweenRowsIn),
      plantingDepthIn: numOrNull(r.plantingDepthIn),
      frostHardiness: r.frostHardiness || "",
      heightIn: numOrNull(r.heightIn),
      spreadIn: numOrNull(r.spreadIn),
      companionPlants: csvToArray(r.companionPlants),
      avoidPlants: csvToArray(r.avoidPlants),
      pests: csvToArray(r.pests),
      diseases: csvToArray(r.diseases),
      notes: r.notes || "",
      imageUrl: r.imageUrl || "",
      sourceUrl: r.sourceUrl || "",

      name_lower: `${(r.name||"").toLowerCase()} ${(r.variety||"").toLowerCase()}`.trim(),
      keywords: buildKeywords(r),

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("plants").doc(slug).set(doc, { merge: true });
    count++;
    if (count % 25 === 0) console.log(`Imported ${count}…`);
  }
  console.log(`Done. Imported ${count} plants.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
