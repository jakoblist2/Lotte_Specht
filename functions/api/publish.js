import { getDoc, putDoc, deleteDocs, json, sameOrigin } from "../_lib/store.js";
import { validDoc, pageDoc } from "../_lib/render.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const name = data.name || "";
  try {
    const draft = await getDoc(env.DB, "draft:" + name, null);
    if (!draft) throw new Error("Bitte zuerst einen Entwurf speichern.");
    const history = (await getDoc(env.DB, "history:" + name, [])) || [];
    history.unshift(await pageDoc(env, request.url, name, false));
    await putDoc(env.DB, "history:" + name, history.slice(0, 20));
    await putDoc(env.DB, "published:" + name, await validDoc(env, request.url, name, draft));
    await deleteDocs(env.DB, ["draft:" + name]);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "Eingabe prüfen." }, 400);
  }
}
