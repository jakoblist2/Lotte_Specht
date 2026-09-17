export async function onRequestGet({ params, env }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path;
  if (!env.UPLOADS || !path) return new Response("Nicht gefunden", { status: 404 });
  const object = await env.UPLOADS.get("uploads/" + path);
  if (!object) return new Response("Nicht gefunden", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
