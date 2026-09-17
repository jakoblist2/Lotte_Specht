import { getDoc, putDoc, deleteDocs, json, sameOrigin } from "../_lib/store.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const name = data.name || "";
  const pages = (await getDoc(env.DB, "pages", [])) || [];
  if (!pages.includes(name)) return json({ error: "Diese Seite kann nicht gelöscht werden." }, 400);
  await putDoc(env.DB, "pages", pages.filter((n) => n !== name));
  await deleteDocs(env.DB, ["template:" + name, "draft:" + name, "published:" + name, "history:" + name]);
  return json({ ok: true });
}
