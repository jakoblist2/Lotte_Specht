import { PUBLIC, renderPage } from "./_lib/render.js";

// Every visit to a public page is rendered fresh with whatever is currently published in D1 —
// same principle as server/cms.py's render_page(), just running on Cloudflare instead of locally.
// Anything else (internal pages, CSS/JS, images) falls through to normal static asset serving.
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  let name = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  if (!PUBLIC.includes(name)) return next();
  try {
    const html = await renderPage(env, request.url, name, false);
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return next();
  }
}
