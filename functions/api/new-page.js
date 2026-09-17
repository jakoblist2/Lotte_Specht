import { getDoc, putDoc, json, sameOrigin } from "../_lib/store.js";
import { basePage, model, staticPageNames } from "../_lib/render.js";

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: "JSON erforderlich." }, 415); }
  const slug = data.slug || "";
  if (!/^[a-z][a-z0-9-]{1,60}$/.test(slug)) return json({ error: "Adresse: 2–61 Zeichen, Kleinbuchstaben, Zahlen und Bindestriche." }, 400);
  const name = slug + ".html";
  const staticNames = await staticPageNames(env, request.url);
  const customPages = (await getDoc(env.DB, "pages", [])) || [];
  if (staticNames.includes(name) || customPages.includes(name)) {
    return json({ error: "Diese Adresse existiert bereits." }, 400);
  }
  const title = String(data.title || "").trim();
  if (!title || title.length > 180) return json({ error: "Bitte einen Titel eingeben." }, 400);

  let source = await basePage(env, request.url, "wir.html");
  source = source.replace(/<main\b[\s\S]*?<\/main>/i,
    '<main class="page-main"><section class="page-hero"><div class="page-hero-copy"><p class="page-kicker">Lotte Specht e.V.</p><h1>' +
    escapeHtml(title) +
    '</h1><p>Hier entsteht eine neue Seite.</p></div><div class="page-hero-media"><img src="assets/logo.png" alt="Lotte Specht e.V." /></div></section><section class="guide-section"><h2>Mehr erfahren</h2><p>Ergänze hier die Inhalte.</p></section></main>');
  source = source.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
  source = source.replace(/ aria-current="page"/g, "");

  await putDoc(env.DB, "template:" + name, source);
  await putDoc(env.DB, "pages", [...customPages, name]);
  await putDoc(env.DB, "draft:" + name, model(name, source));
  return json({ name });
}
