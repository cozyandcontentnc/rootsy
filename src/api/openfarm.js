// src/api/openfarm.js — Firestore-backed wrapper

// update these URLs to your deployed Functions
const CROPS_SEARCH_URL = "https://us-east1-<your-project>.cloudfunctions.net/plantsSearch";
const CROP_SHOW_URL    = "https://us-east1-<your-project>.cloudfunctions.net/plantShow";

function toPreviewShape(p = {}) {
  return {
    id: String(p.slug || p.id || ""),
    type: "plants",
    attributes: {
      slug: p.slug || "",
      name: p.variety ? `${p.name} — ${p.variety}` : p.name || "Unknown",
      binomial_name: p.scientificName || null,
      main_image_path: p.imageUrl || null,
      thumb_image_url: p.imageUrl || null,
      description: p.description || "",
    },
    links: {},
  };
}

export async function searchCrops(query, page = 1) {
  const url = `${CROPS_SEARCH_URL}?filter=${encodeURIComponent(query)}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();
  const arr = Array.isArray(json?.data) ? json.data : [];
  return { data: arr.map(toPreviewShape), meta: json?.meta ?? {}, _source: "firestore" };
}

export async function getCropBySlug(slug) {
  const url = `${CROP_SHOW_URL}/${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Detail failed (${res.status})`);
  const json = await res.json();
  return { data: toPreviewShape(json?.data || {}), _source: "firestore" };
}

export function toCropPreview(node) {
  const a = node?.attributes ?? {};
  return {
    slug: a.slug,
    name: a.name || "Unknown",
    binomialName: a.binomial_name || "",
    image: a.main_image_path || null,
    attributes: a,
  };
}
