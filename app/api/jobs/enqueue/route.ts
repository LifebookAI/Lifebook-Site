import { enqueueJob } from "@/lib/jobs/store.pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWorkspaceId(req: Request): string {
  // MVP-safe: wire to real auth/workspace claims next; allow override for tests.
  return req.headers.get("x-workspace-id") ?? "local";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const kind = typeof body?.kind === "string" && body.kind ? body.kind : "noop";
  const payload = Object.prototype.hasOwnProperty.call(body ?? {}, "payload") ? body.payload : body;

  const idempotencyKey =
    req.headers.get("idempotency-key") ??
    req.headers.get("x-idempotency-key") ??
    (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null);

  const job = await enqueueJob({
    workspaceId: getWorkspaceId(req),
    kind,
    payload,
    triggerType: "manual",
    idempotencyKey: idempotencyKey ?? null,
  });

  return Response.json({ jobId: job.id, job }, { status: 201 });
}