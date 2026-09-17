import { json } from "../_lib/store.js";
import { pageDoc } from "../_lib/render.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const name = url.searchParams.get("page") || "index.html";
  try {
    return json(await pageDoc(env, request.url, name, true));
  } catch {
    return json({ error: "Seite nicht gefunden." }, 404);
  }
}
