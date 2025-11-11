import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const allowed = new Set<string>(JSON.parse(fs.readFileSync(path.join(repo, "analytics", "events.json"), "utf8")).allowed);

export function emitAnalytics(event: string, payload: Record<string, unknown>) {
  if (!allowed.has(event)) {
    // Throw in CI; at runtime, log but continue
    if (process.env.CI) throw new Error(`Unknown analytics event: ${event}`);
    console.warn("[analytics] unknown event:", event);
  }
  const line = JSON.stringify({ event, payload, ts: new Date().toISOString() });
  console.log(line);
}