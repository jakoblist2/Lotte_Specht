import { getDoc, json } from "../_lib/store.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const name = url.searchParams.get("page") || "index.html";
  return json(await getDoc(env.DB, "history:" + name, []));
}
