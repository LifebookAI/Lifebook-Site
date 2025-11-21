import { build } from "esbuild";
import { mkdirSync, createWriteStream } from "node:fs";
import archiver from "archiver";

/**
 * Build script for lifebook-orchestrator-worker Lambda
 *
 * - Bundles src/index.ts -> dist/index.js
 * - Output is CommonJS (format: "cjs") for Node 20
 * - Packaged as orchestrator_lambda.zip with index.js as handler file
 *
 * Lambda config:
 *   Runtime: nodejs20.x
 *   Handler: index.handler
 */

console.log("Bundling Lambda handler as CommonJS for Node 20...");

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
});

console.log("Packaging zip...");
mkdirSync("dist", { recursive: true });

const output = createWriteStream("dist/orchestrator_lambda.zip");
const archive = archiver("zip", { zlib: { level: 9 } });

archive.pipe(output);

// Expose the CommonJS bundle as index.js (Lambda handler file)
archive.file("dist/index.js", { name: "index.js" });

await archive.finalize();

console.log("Lambda artifact at dist/orchestrator_lambda.zip");