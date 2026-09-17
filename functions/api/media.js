import { json } from "../_lib/store.js";

export async function onRequestGet({ request, env }) {
  const manifestUrl = new URL("/media-manifest.json", request.url);
  let baked = [];
  try {
    const response = await env.ASSETS.fetch(manifestUrl.toString());
    if (response.ok) baked = await response.json();
  } catch {}

  let uploaded = [];
  if (env.UPLOADS) {
    try {
      const listed = await env.UPLOADS.list({ prefix: "uploads/" });
      uploaded = listed.objects.map((o) => ({ src: "assets/" + o.key, name: o.key.split("/").pop() }));
    } catch {}
  }
  return json([...baked, ...uploaded]);
}
