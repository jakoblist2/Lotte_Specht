import { getDoc, json } from "../_lib/store.js";
import { PUBLIC, pageDoc } from "../_lib/render.js";

export async function onRequestGet({ request, env }) {
  const customPages = (await getDoc(env.DB, "pages", [])) || [];
  const names = [...PUBLIC, ...customPages];
  const result = [];
  for (const name of names) {
    const doc = await pageDoc(env, request.url, name, true);
    result.push({
      name,
      title: doc.title,
      draft: Boolean(await getDoc(env.DB, "draft:" + name, null)),
      published: PUBLIC.includes(name) || Boolean(await getDoc(env.DB, "published:" + name, null)),
      core: PUBLIC.includes(name),
    });
  }
  return json(result);
}
