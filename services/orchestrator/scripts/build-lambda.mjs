import { build } from "esbuild";
import { mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import archiver from "node:archiver"; // Node 20 doesn't have archiver; but we can zip via archiver? fallback to PowerShell pack.

console.log("Bundling Lambda handler...");
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: []
});
console.log("Packaging zip...");
const { createWriteStream: cws } = await import("node:fs");
const fs = await import("node:fs");
const path = await import("node:path");
mkdirSync("dist", { recursive: true });
const output = cws("dist/orchestrator_lambda.zip");
const archive = archiver("zip", { zlib: { level: 9 }});
archive.pipe(output);
archive.file("dist/index.mjs", { name: "index.mjs" });
await archive.finalize();
console.log("Lambda artifact at dist/orchestrator_lambda.zip");