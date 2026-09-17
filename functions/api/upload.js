import { json, sameOrigin } from "../_lib/store.js";

// No Pillow-equivalent image library is available in Workers, so unlike the local server this
// does not resize or recompress uploads — it stores the file as-is after a basic type check.
function sniffType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { ext: "webp", mime: "image/webp" };
  return null;
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  if (!env.UPLOADS) return json({ error: "Bildupload ist auf dieser Umgebung nicht verfügbar." }, 503);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  let raw;
  try { raw = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0)); } catch { return json({ error: "Ungültige Bilddaten." }, 400); }
  if (raw.length > 8 * 1024 * 1024) return json({ error: "Bild zu groß. Maximal 8 MB." }, 400);
  const type = sniffType(raw);
  if (!type) return json({ error: "Nur JPG, PNG oder WebP." }, 400);
  const idBytes = crypto.getRandomValues(new Uint8Array(12));
  const filename = toHex(idBytes) + "." + type.ext;
  await env.UPLOADS.put("uploads/" + filename, raw, { httpMetadata: { contentType: type.mime } });
  return json({ src: "assets/uploads/" + filename });
}
