import { json } from "../_lib/store.js";
import { renderPage } from "../_lib/render.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const name = url.searchParams.get("page") || "index.html";
  try {
    const html = (await renderPage(env, request.url, name, true)).replace("<head>", '<head><base href="/">', 1);
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch {
    return json({ error: "Seite nicht gefunden." }, 404);
  }
}
