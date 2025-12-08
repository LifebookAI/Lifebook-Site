import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
// Use a RELATIVE import here to avoid any path-alias issues
import { getRunDetail } from "../../../../../lib/orchestrator/runDetail";

// Ensure this runs in the Node.js runtime (fs, aws-sdk ok)
export const runtime = "nodejs";

const USE_FIXTURE = process.env.ORCH_RUN_DETAIL_USE_FIXTURE === "true";

async function tryLoadFixture(jobId: string) {
  const fixturePath = path.join(
    process.cwd(),
    "infra",
    "ops",
    "orchestrator",
    "fixtures",
    `run-detail-${jobId}.json`
  );

  try {
    const json = await fs.readFile(fixturePath, "utf8");
    console.log("[RunDetailAPI] Loaded fixture:", fixturePath);
    return JSON.parse(json);
  } catch (err) {
    console.warn("[RunDetailAPI] No fixture or failed to load:", fixturePath, err);
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { jobId: string } }
) {
  const jobId = ctx.params?.jobId;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  console.log("[RunDetailAPI] Incoming GET for jobId:", jobId, "USE_FIXTURE:", USE_FIXTURE);

  try {
    // 1) Dev helper: serve fixture if flag is on and file exists
    if (USE_FIXTURE) {
      const fixture = await tryLoadFixture(jobId);
      if (fixture) {
        return NextResponse.json(fixture, { status: 200 });
      }
    }

    // 2) Live AWS path via DynamoDB
    const runDetail = await getRunDetail(jobId);

    if (!runDetail) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(runDetail, { status: 200 });
  } catch (err) {
    console.error("[RunDetailAPI] Internal error for jobId", jobId, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}