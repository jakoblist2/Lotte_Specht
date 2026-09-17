const CREATE_DOCS = `CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`;

export async function ensureSchema(db) {
  await db.prepare(CREATE_DOCS).run();
}

export async function getDoc(db, key, fallback = null) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT value FROM docs WHERE key = ?").bind(key).first();
  return row ? JSON.parse(row.value) : fallback;
}

export async function putDoc(db, key, value) {
  await ensureSchema(db);
  await db.prepare("INSERT OR REPLACE INTO docs (key, value) VALUES (?, ?)").bind(key, JSON.stringify(value)).run();
}

export async function deleteDocs(db, keys) {
  await ensureSchema(db);
  const stmt = db.prepare("DELETE FROM docs WHERE key = ?");
  await db.batch(keys.map((key) => stmt.bind(key)));
}

export const json = (body, status = 200, extraHeaders = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders },
});

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
