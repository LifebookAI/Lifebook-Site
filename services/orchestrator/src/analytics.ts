import fs from "node:fs";
import path from "node:path";

type Spec = { allowed: string[] };
const repo = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(repo, "analytics", "events.json"), "utf8")) as Spec;
const allowed = new Set<string>(spec.allowed);

export function emitAnalytics(event: string, payload: Record<string, unknown>): void {
  if (!allowed.has(event)) {
    if (process.env.CI) throw new Error(`Unknown analytics event: ${event}`);
    console.warn("[analytics] unknown event:", event);
  }
  const line = JSON.stringify({ event, payload, ts: new Date().toISOString() });
  console.log(line);
}