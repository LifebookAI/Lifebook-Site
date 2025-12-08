import { NextRequest, NextResponse } from "next/server";
import { getRunDetail } from "@/lib/orchestrator/runDetail";

export const runtime = "nodejs";

type RunSummary = {
  jobId: string;
  workflowSlug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
};

type RunsListResponse = {
  items: RunSummary[];
  error?: string;
};

export async function GET(_req: NextRequest): Promise<NextResponse<RunsListResponse>> {
  const raw = process.env.ORCH_RUN_INDEX_JOB_IDS;

  if (!raw) {
    console.warn(
      "[orchestrator/runs] ORCH_RUN_INDEX_JOB_IDS is not set; returning empty list."
    );
    return NextResponse.json(
      {
        items: [],
        error:
          "ORCH_RUN_INDEX_JOB_IDS is not configured; set it in .env.local for local dev.",
      },
      { status: 200 }
    );
  }

  const jobIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const items: RunSummary[] = [];

  for (const jobId of jobIds) {
    try {
      const detail: any = await getRunDetail(jobId);

      if (!detail) {
        console.warn(
          "[orchestrator/runs] getRunDetail returned null/undefined for jobId=%s",
          jobId
        );
        continue;
      }

      items.push({
        jobId: detail.jobId ?? jobId,
        workflowSlug: detail.workflowSlug ?? "(unknown)",
        status: detail.status ?? "unknown",
        createdAt: detail.createdAt ?? "",
        updatedAt: detail.updatedAt ?? "",
        lastError:
          typeof detail.lastError === "string" || detail.lastError === null
            ? detail.lastError
            : null,
      });
    } catch (err) {
      console.error(
        "[orchestrator/runs] getRunDetail failed for jobId=%s: %o",
        jobId,
        err
      );
    }
  }

  return NextResponse.json(
    {
      items,
    },
    { status: 200 }
  );
}