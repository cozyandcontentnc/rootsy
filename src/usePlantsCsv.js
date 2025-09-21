// src/usePlantsCsv.js
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { Asset } from "expo-asset";

export default function usePlantsCsv() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // ⬇️ move the require INSIDE the effect
        const CSV_MODULE = require("../assets/data/plants.csv");

        // Resolve bundled asset to a local URI
        const asset = Asset.fromModule(CSV_MODULE);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        const uri = asset.localUri || asset.uri;

        const res = await fetch(uri);
        if (!res.ok) throw new Error(`Failed to load CSV (${res.status})`);
        const text = await res.text();

        const parsed = Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        const rows = (parsed.data || []).map((r) => normalizeRow(r));

        if (!cancelled) {
          setPlants(rows);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const fuse = useMemo(() => {
    if (!plants.length) return null;
    return new Fuse(plants, {
      keys: [
        { name: "name", weight: 0.5 },
        { name: "variety", weight: 0.3 },
        { name: "aliases", weight: 0.2 },
        { name: "tags", weight: 0.2 },
        { name: "scientificName", weight: 0.2 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [plants]);

  function search(query) {
    const q = (query || "").trim();
    if (!q) return plants;
    if (!fuse) return [];

    const fuzzy = fuse.search(q).map((r) => r.item);

    const lower = q.toLowerCase();
    const prefixBoost = plants.filter(
      (p) =>
        (p.name || "").toLowerCase().startsWith(lower) ||
        (p.variety || "").toLowerCase().startsWith(lower)
    );

    const seen = new Set();
    return [...prefixBoost, ...fuzzy].filter((p) => {
      if (seen.has(p.slug)) return false;
      seen.add(p.slug);
      return true;
    });
  }

  return { plants, loading, error: err, search };
}

function normalizeRow(r) {
  const csvToArray = (val) =>
    typeof val === "string"
      ? val.split(",").map((s) => s.trim()).filter(Boolean)
      : Array.isArray(val)
      ? val
      : [];

  return {
    name: r.name || "",
    slug: r.slug || "",
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
  };
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
