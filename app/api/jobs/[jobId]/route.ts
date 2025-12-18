import { getJob } from "@/lib/jobs/store.pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWorkspaceId(req: Request): string {
  return req.headers.get("x-workspace-id") ?? "local";
}

export async function GET(req: Request, ctx: { params: { jobId: string } }) {
  const jobId = ctx?.params?.jobId;
  if (!jobId) return Response.json({ error: "missing jobId" }, { status: 400 });

  const job = await getJob(getWorkspaceId(req), jobId);
  if (!job) return Response.json({ error: "not_found", jobId }, { status: 404 });

  return Response.json({ jobId, job }, { status: 200 });
}