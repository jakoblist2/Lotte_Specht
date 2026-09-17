import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";

const KEY = "/api/matches";

// Public read: the "Wo läuft's?" page fetches this without a session.
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
    if (item.gender !== "frauen" && item.gender !== "maenner") return json({ error: "Bitte Frauen- oder Männer-Bundesliga wählen." }, 400);
    if (!String(item.team_home || "").trim() || !String(item.team_away || "").trim()) return json({ error: "Bitte beide Teams eintragen." }, 400);
    if (!String(item.date || "").trim()) return json({ error: "Bitte Datum und Uhrzeit angeben." }, 400);
    const entry = {};
    for (const key of ["id", "gender", "competition", "team_home", "team_away", "date", "broadcaster", "notes"]) entry[key] = String(item[key] || "").slice(0, 200);
    clean.push(entry);
  }
  await putDoc(env.DB, KEY, clean);
  return json({ ok: true });
}
