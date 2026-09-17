import { json } from "../_lib/store.js";

// Open mode: no real login yet, matches LOTTE_CMS_OPEN=1 locally. Every request counts as
// authenticated. Swap this out for real sessions (see moviadesign.studio's _lib/auth.js)
// before going live for real.
export async function onRequestGet() {
  return json({ authenticated: true, setup: false, csrf: "open-mode" });
}
