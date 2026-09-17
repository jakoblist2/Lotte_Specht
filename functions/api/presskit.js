import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";
import { assetExists } from "../_lib/render.js";
import { DEFAULT_PRESSKIT } from "../_lib/defaults.js";

const KEY = "/api/presskit";

export async function onRequestGet({ env, request }) {
  return json(await getDoc(env.DB, KEY, DEFAULT_PRESSKIT));
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const items = data.items;
  if (!Array.isArray(items) || items.length > 200) return json({ error: "Ungültige Einträge." }, 400);
  const clean = [];
  for (const item of items) {
    if (item.category !== "logo" && item.category !== "foto") return json({ error: "Bitte Logo oder Foto wählen." }, 400);
    if (!String(item.title || "").trim()) return json({ error: "Bitte einen Titel eingeben." }, 400);
    const src = String(item.src || "");
    if (!/^assets\/[\w/.-]+$/.test(src) || src.includes("..")) return json({ error: "Bitte eine Datei aus der Mediathek wählen." }, 400);
    if (!(await assetExists(env, request.url, src))) return json({ error: "Datei nicht gefunden." }, 400);
    clean.push({
      id: String(item.id || "").slice(0, 200),
      category: item.category,
      title: String(item.title || "").slice(0, 200),
      src,
      credit: String(item.credit || "").slice(0, 500),
    });
  }
  await putDoc(env.DB, KEY, clean);
  return json({ ok: true });
}
