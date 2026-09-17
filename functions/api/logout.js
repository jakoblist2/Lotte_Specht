import { json } from "../_lib/store.js";

// Open mode has no real session to end. Kept so the editor's "Abmelden" button doesn't error.
export async function onRequestPost() {
  return json({ ok: true });
}
