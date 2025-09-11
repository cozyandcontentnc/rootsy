// src/api/openfarm.js
const BASE = 'https://openfarm.cc/api/v1';

export async function searchCrops(query, page = 1) {
  const url = `${BASE}/crops/?filter=${encodeURIComponent(query)}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenFarm search failed (${res.status})`);
  const json = await res.json();
  // results in json.data[] with { id, type, attributes: {...}, links }
  return json;
}

export async function getCropBySlug(slug) {
  const url = `${BASE}/crops/${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenFarm crop fetch failed (${res.status})`);
  const json = await res.json();
  return json; // { data: { id, attributes: {...} } }
}

// small normalizer you can tweak
export function toCropPreview(node) {
  const a = node?.attributes ?? {};
  return {
    slug: a.slug || node?.id,
    name: a.name || a.common_names?.[0] || 'Unknown',
    binomialName: a.binomial_name || '',
    image: a.main_image_path || a.thumb_image_url || null,
    attributes: a,
  };
}
