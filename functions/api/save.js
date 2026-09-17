import { putDoc, json, sameOrigin } from "../_lib/store.js";
import { validDoc } from "../_lib/render.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const name = data.name || "";
  try {
    const doc = await validDoc(env, request.url, name, data);
    await putDoc(env.DB, "draft:" + name, doc);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "Eingabe prüfen." }, 400);
  }
}
