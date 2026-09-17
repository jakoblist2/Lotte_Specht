import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";

const KEY = "/api/venues";

export async function onRequestGet({ env }) {
  return json(await getDoc(env.DB, KEY, []));
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const items = data.items;
  if (!Array.isArray(items) || items.length > 500) return json({ error: "Ungültige Einträge." }, 400);
  const clean = [];
  for (const item of items) {
    if (!String(item.name || "").trim()) return json({ error: "Bitte einen Namen eintragen." }, 400);
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "Bitte gültige Koordinaten eintragen." }, 400);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return json({ error: "Koordinaten außerhalb des gültigen Bereichs." }, 400);
    clean.push({
      id: String(item.id || "").slice(0, 200),
      name: String(item.name || "").slice(0, 200),
      address: String(item.address || "").slice(0, 300),
      lat, lng,
      womensFootball: Boolean(item.womensFootball),
      notes: String(item.notes || "").slice(0, 2000),
      url: String(item.url || "").slice(0, 500),
    });
  }
  await putDoc(env.DB, KEY, clean);
  return json({ ok: true });
}
