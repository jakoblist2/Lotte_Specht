import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const name = data.name || "";
  const index = Number(data.index);
  const history = (await getDoc(env.DB, "history:" + name, [])) || [];
  if (!Number.isInteger(index) || index < 0 || index >= history.length) return json({ error: "Version fehlt." }, 400);
  await putDoc(env.DB, "draft:" + name, history[index]);
  return json({ ok: true });
}
