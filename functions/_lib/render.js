import { getDoc } from "./store.js";

export const PUBLIC = ["index.html", "lotte-specht.html", "wir.html", "was-wir-tun.html", "efc.html", "wo-laeuft.html", "presse.html", "kontakt.html"];

const FIELD = /<(h[1-3]|p|figcaption)\b([^>]*)>(.*?)<\/\1>/gis;
const IMG = /<img\b[^>]*>/gi;
const HAS_OTHER_TAG = /<(?!br\s*\/?>)/i;

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function unescapeHtml(value) {
  return String(value)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w-]+)=["']([^"']*)["']/g)) result[match[1]] = match[2];
  return result;
}

export async function basePage(env, requestUrl, name) {
  if (PUBLIC.includes(name)) {
    const assetUrl = new URL("/" + name, requestUrl);
    const response = await env.ASSETS.fetch(assetUrl.toString());
    if (!response.ok) return null;
    return await response.text();
  }
  return await getDoc(env.DB, "template:" + name, null);
}

// Cloudflare Pages serves index.html (status 200) for any unmatched path by default, so a plain
// ASSETS.fetch().ok check can't tell "exists" from "doesn't" — check the baked-in manifest and
// R2 (for uploads) explicitly instead.
export async function assetExists(env, requestUrl, path) {
  if (path.startsWith("assets/uploads/")) {
    if (!env.UPLOADS) return false;
    const key = "uploads/" + path.slice("assets/uploads/".length);
    return Boolean(await env.UPLOADS.head(key));
  }
  const manifestUrl = new URL("/media-manifest.json", requestUrl);
  const response = await env.ASSETS.fetch(manifestUrl.toString());
  if (!response.ok) return false;
  const manifest = await response.json();
  return manifest.some((item) => item.src === path);
}

export async function staticPageNames(env, requestUrl) {
  const manifestUrl = new URL("/pages-manifest.json", requestUrl);
  const response = await env.ASSETS.fetch(manifestUrl.toString());
  if (!response.ok) return [];
  return await response.json();
}

export function model(name, source) {
  if (source === null || source === undefined) throw new Error("Seite nicht gefunden.");
  const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(source);
  const main = mainMatch ? mainMatch[1] : "";
  const fields = [];
  let index = -1;
  for (const m of main.matchAll(FIELD)) {
    index += 1;
    if (HAS_OTHER_TAG.test(m[3])) continue;
    const text = unescapeHtml(m[3].replace(/<br\s*\/?>/gi, "\n")).trim();
    if (!text) continue;
    fields.push({ id: `t${index}`, kind: "text", label: m[1].toUpperCase(), value: text });
  }
  index = -1;
  for (const m of main.matchAll(IMG)) {
    index += 1;
    const a = attrs(m[0]);
    if (a.id === "sequence-frame" || a.id === "intro-frame") continue;
    fields.push({ id: `i${index}`, kind: "image", label: a.alt || "Bild", value: a.src || "", alt: a.alt || "" });
  }
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(source);
  const title = titleMatch ? unescapeHtml(titleMatch[1]) : "";
  return { name, title, fields };
}

export async function pageModel(env, requestUrl, name) {
  const source = await basePage(env, requestUrl, name);
  return model(name, source);
}

export async function pageDoc(env, requestUrl, name, draft) {
  const draftDoc = draft ? await getDoc(env.DB, "draft:" + name, null) : null;
  if (draftDoc) return draftDoc;
  const published = await getDoc(env.DB, "published:" + name, null);
  if (published) return published;
  return await pageModel(env, requestUrl, name);
}

export async function renderPage(env, requestUrl, name, draft = false) {
  const source = await basePage(env, requestUrl, name);
  if (source === null) throw new Error("Seite nicht gefunden.");
  const data = await pageDoc(env, requestUrl, name, draft);
  const fields = {};
  for (const f of data.fields) fields[f.id] = f;

  let out = source.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(data.title) + "</title>");
  const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(out);
  if (!mainMatch) return out;
  let text = mainMatch[1];

  let count = -1;
  text = text.replace(FIELD, (whole, tag, attrPart, inner) => {
    count += 1;
    const f = fields["t" + count];
    if (!f) return whole;
    return "<" + tag + attrPart + ">" + escapeHtml(f.value).replace(/\n/g, "<br />") + "</" + tag + ">";
  });

  count = -1;
  text = text.replace(IMG, (whole) => {
    count += 1;
    const f = fields["i" + count];
    if (!f) return whole;
    let tag = whole;
    for (const [key, value] of [["src", f.value], ["alt", f.alt || ""]]) {
      const safe = escapeHtml(value);
      const attrPattern = new RegExp("\\b" + key + "=[\"'][^\"']*[\"']");
      if (attrPattern.test(tag)) tag = tag.replace(attrPattern, key + '="' + safe + '"');
      else tag = tag.slice(0, -1) + " " + key + '="' + safe + '">';
    }
    return tag;
  });

  const innerStart = mainMatch.index + mainMatch[0].indexOf(mainMatch[1]);
  const innerEnd = innerStart + mainMatch[1].length;
  out = out.slice(0, innerStart) + text + out.slice(innerEnd);

  const pages = (await getDoc(env.DB, "pages", [])) || [];
  const linkParts = [];
  for (const n of pages) {
    const published = await getDoc(env.DB, "published:" + n, null);
    if (!published) continue;
    linkParts.push('<a href="' + n + '">' + escapeHtml(published.title.split(" — ")[0]) + "</a>");
  }
  out = out.replace('<div class="menu-internal">', linkParts.join("") + '<div class="menu-internal">');
  return out;
}

export async function validDoc(env, requestUrl, name, data) {
  const original = await pageModel(env, requestUrl, name);
  if (typeof data.title !== "string" || data.title.trim().length < 1 || data.title.trim().length > 180) {
    throw new Error("Bitte einen Seitentitel eingeben (max. 180 Zeichen).");
  }
  const incoming = {};
  for (const f of data.fields || []) incoming[f.id] = f;
  for (const f of original.fields) {
    const value = incoming[f.id] ? incoming[f.id].value : undefined;
    if (typeof value !== "string" || value.length > 20000) throw new Error("Ungültiger Inhalt.");
    if (f.kind === "image") {
      if (!/^assets\/[\w/.-]+$/.test(value) || value.includes("..")) throw new Error("Bitte ein Bild aus der Mediathek wählen.");
      if (!(await assetExists(env, requestUrl, value))) throw new Error("Bild nicht gefunden.");
      f.alt = String(incoming[f.id].alt || "").slice(0, 500);
      if (!f.alt.trim()) throw new Error("Bitte eine Bildbeschreibung ergänzen.");
    }
    f.value = value;
  }
  original.title = data.title.trim();
  original.updated = new Date().toISOString().slice(0, 16).replace("T", " ");
  return original;
}
