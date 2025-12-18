import { runJob } from "@/lib/jobs/store.pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWorkspaceId(req: Request): string {
  return req.headers.get("x-workspace-id") ?? "local";
}

export async function POST(req: Request, ctx: { params: { jobId: string } }) {
  const jobId = ctx?.params?.jobId;
  if (!jobId) return Response.json({ error: "missing jobId" }, { status: 400 });

  try {
    const job = await runJob(getWorkspaceId(req), jobId);
    return Response.json({ jobId: job.id, job }, { status: 200 });
  } catch (e: any) {
    if (String(e?.message) === "JOB_NOT_FOUND") return Response.json({ error: "not_found", jobId }, { status: 404 });
    return Response.json({ error: "run_failed", jobId }, { status: 500 });
  }
}