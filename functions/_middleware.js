// Simple shared-password gate for the Cloudflare client preview. Independent of the editorial
// login (still open mode, see api/session.js) — this just keeps the preview link from being
// stumbled upon before launch. Remove once the site goes live for real.
const COOKIE_NAME = "cp_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function gatePage(error) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vorschau — Lotte Specht e.V.</title>
<style>
:root{--red:#e3062c;--ink:#111;--paper:#f3f2ee}
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font-family:"Helvetica Neue",Arial,sans-serif;padding:24px}
form{width:100%;max-width:360px;background:white;border:1px solid var(--ink);padding:32px}
h1{font-size:1.4rem;letter-spacing:-0.02em;margin:0 0 8px}
p{margin:0 0 24px;color:#63615d;font-size:0.9rem;line-height:1.5}
label{display:block;font-size:0.8rem;font-weight:700;margin-bottom:8px}
input{width:100%;padding:12px;border:1px solid #c9c8c2;font-size:1rem;margin-bottom:16px}
button{width:100%;padding:12px;border:1px solid var(--red);background:var(--red);color:white;font-weight:700;cursor:pointer;font-size:1rem}
button:hover{filter:brightness(.9)}
.error{color:var(--red);font-size:0.85rem;margin:-8px 0 16px}
</style></head><body>
<form method="post">
<h1>Lotte Specht e.V.</h1>
<p>Diese Vorschau ist noch nicht öffentlich. Bitte das Passwort eingeben.</p>
${error ? '<p class="error">Falsches Passwort. Bitte erneut versuchen.</p>' : ""}
<label for="password">Passwort</label>
<input type="password" name="password" id="password" autofocus required>
<button type="submit">Weiter →</button>
</form>
</body></html>`;
}

export async function onRequest({ request, env, next }) {
  const password = env.CLIENT_PASSWORD;
  if (!password) return next(); // Gate not configured — fall through unprotected.

  const expected = await sha256Hex(password);
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
  if (match && match[1] === expected) return next();

  if (request.method === "POST") {
    const form = await request.formData();
    if (form.get("password") === password) {
      return new Response(null, {
        status: 303,
        headers: {
          location: "/",
          "set-cookie": `${COOKIE_NAME}=${expected}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return new Response(gatePage(true), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  return new Response(gatePage(false), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
}
