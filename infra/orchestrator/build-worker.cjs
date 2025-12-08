const path = require("node:path");
const { build } = require("esbuild");

(async () => {
  try {
    const projectRoot = path.resolve(__dirname, "..", "..");
    const entryPoint = path.join(projectRoot, "infra", "orchestrator", "worker-handler.ts");
    const outFile = path.join(projectRoot, "infra", "orchestrator", "dist", "worker", "index.js");

    console.log("[build-worker] entry:", entryPoint);
    console.log("[build-worker] outfile:", outFile);

    await build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      outfile: outFile,
      sourcemap: "inline",
      logLevel: "info",
      tsconfig: path.join(projectRoot, "tsconfig.json"),
    });

    console.log("[build-worker] build complete");
  } catch (err) {
    console.error("[build-worker] build failed:", err);
    process.exitCode = 1;
  }
})();