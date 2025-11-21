#!/usr/bin/env node
// Status & concurrency test harness for orchestrator jobs.
// Pure logic: no AWS calls. Keep in sync with services/orchestrator/job-status.ts.

import assert from "node:assert";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function canTransition(from, to) {
  switch (from) {
    case "queued":
      return to === "running" || to === "cancelled";
    case "running":
      return to === "succeeded" || to === "failed";
    default:
      return false;
  }
}

function classifyPreconditionFailure({ expected, found }) {
  if (!found) return "missing";

  if (expected === "queued" && found === "running")   return "concurrent-claim";
  if (expected === "queued" && found === "succeeded") return "already-completed";
  if (expected === "running" && found === "succeeded") return "already-completed";

  if (TERMINAL.has(found)) return "unexpected-terminal";
  return "unexpected-nonterminal";
}

async function simulateTwoWorkersRace() {
  let status = "queued";

  async function workerA() {
    if (!canTransition(status, "running")) {
      throw new Error("workerA: queued -> running not allowed");
    }
    status = "running";

    await new Promise((resolve) => setTimeout(resolve, 15));

    if (!canTransition(status, "succeeded")) {
      throw new Error("workerA: running -> succeeded not allowed");
    }
    status = "succeeded";
  }

  async function workerB() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const attempt1 = classifyPreconditionFailure({ expected: "queued", found: status });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const attempt2 = classifyPreconditionFailure({ expected: "running", found: status });

    return { attempt1, attempt2, finalStatus: status };
  }

  const [, bResult] = await Promise.all([workerA(), workerB()]);
  return bResult;
}

async function main() {
  const tests = [];

  function t(name, fn) {
    tests.push(
      Promise.resolve()
        .then(fn)
        .then(() => ({ name, ok: true }))
        .catch((err) => ({ name, ok: false, err }))
    );
  }

  // Transition rules
  t("queued → running is allowed", () => {
    assert.strictEqual(canTransition("queued", "running"), true);
  });

  t("queued → cancelled is allowed", () => {
    assert.strictEqual(canTransition("queued", "cancelled"), true);
  });

  t("running → succeeded is allowed", () => {
    assert.strictEqual(canTransition("running", "succeeded"), true);
  });

  t("running → failed is allowed", () => {
    assert.strictEqual(canTransition("running", "failed"), true);
  });

  t("queued → succeeded is NOT allowed directly", () => {
    assert.strictEqual(canTransition("queued", "succeeded"), false);
  });

  t("succeeded → running is NOT allowed", () => {
    assert.strictEqual(canTransition("succeeded", "running"), false);
  });

  // Classification
  t("second worker expecting queued but sees running = concurrent-claim", () => {
    const cls = classifyPreconditionFailure({ expected: "queued", found: "running" });
    assert.strictEqual(cls, "concurrent-claim");
  });

  t("second worker expecting queued but sees succeeded = already-completed", () => {
    const cls = classifyPreconditionFailure({ expected: "queued", found: "succeeded" });
    assert.strictEqual(cls, "already-completed");
  });

  t("second worker expecting running but sees succeeded = already-completed", () => {
    const cls = classifyPreconditionFailure({ expected: "running", found: "succeeded" });
    assert.strictEqual(cls, "already-completed");
  });

  t("unexpected terminal mismatch is flagged", () => {
    const cls = classifyPreconditionFailure({ expected: "queued", found: "failed" });
    assert.strictEqual(cls, "unexpected-terminal");
  });

  // Two-worker race
  t("two-worker race: B sees concurrent-claim then already-completed, final succeeded", async () => {
    const { attempt1, attempt2, finalStatus } = await simulateTwoWorkersRace();
    assert.strictEqual(finalStatus, "succeeded");
    assert.strictEqual(attempt1, "concurrent-claim");
    assert.strictEqual(attempt2, "already-completed");
  });

  const settled = await Promise.all(tests);
  let passed = 0;

  for (const r of settled) {
    if (r.ok) {
      console.log(`✓ ${r.name}`);
      passed++;
    } else {
      console.error(`✗ ${r.name}`);
      console.error(r.err);
    }
  }

  const total = settled.length;
  if (passed === total) {
    console.log(`\nAll ${total} status/concurrency tests passed ✅`);
    process.exit(0);
  } else {
    console.error(`\n${passed}/${total} tests passed ❌`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error in test harness", err);
  process.exit(1);
});
