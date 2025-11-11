import { fetch } from "undici";
export async function httpGet(url: string): Promise<string> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return await r.text();
}