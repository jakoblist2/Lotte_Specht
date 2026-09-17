import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";

const KEY = "/api/calendar";

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
    if (!String(item.title || "").trim()) return json({ error: "Ein Titel fehlt." }, 400);
    const entry = {};
    for (const key of ["id", "title", "date", "notes", "url"]) entry[key] = String(item[key] || "").slice(0, 10000);
    clean.push(entry);
  }
  await putDoc(env.DB, KEY, clean);
  return json({ ok: true });
}
