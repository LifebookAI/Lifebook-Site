import { NextResponse } from "next/server";
import type { LibraryItemSummary } from "../../../lib/library/types";

/**
 * GET /api/library
 *
 * MVP stub for Personal Library (19B).
 * Later: wire to a real LibraryStore + workspace-scoped auth.
 */
export async function GET() {
  // TODO: derive workspaceId from auth/session once available.
  const workspaceId = "demo-workspace";

  const items: LibraryItemSummary[] = [
    {
      id: "example-1",
      title: "Sample workflow run output",
      kind: "workflow_output",
      sourceType: "workflow",
      project: "demo",
      tags: ["sample", "hello-world"],
      isPinned: true,
      createdAt: new Date().toISOString(),
      lastViewedAt: null,
    },
    {
      id: "example-2",
      title: "Capture: S3 lab notes",
      kind: "capture",
      sourceType: "capture",
      project: "aws-foundations",
      tags: ["aws", "study-track"],
      isPinned: false,
      createdAt: new Date().toISOString(),
      lastViewedAt: null,
    },
  ];

  return NextResponse.json({ workspaceId, items });
}
