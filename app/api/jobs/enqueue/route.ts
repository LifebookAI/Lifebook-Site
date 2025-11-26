import { NextRequest, NextResponse } from "next/server";

type EnqueueBody = {
  templateId?: string;
  workflowTemplateId?: string;
  journeyKey?: string;
  metadata?: Record<string, unknown>;
  input?: unknown;
};

type ErrorLike = {
  error?: unknown;
};

type JobsResponse = {
  response: Response;
  body: unknown;
  rawText: string | null;
};

async function postToJobs(
  url: string,
  payload: Record<string, unknown>,
): Promise<JobsResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  return { response: res, body: parsed, rawText: text || null };
}

function getErrorMessage(body: unknown, rawText: string | null): string | null {
  // If the body is already a string, just return it.
  if (typeof body === "string") {
    return body;
  }

  if (!body || typeof body !== "object") {
    return rawText;
  }

  const maybe = body as ErrorLike;
  if (typeof maybe.error === "string") {
    return maybe.error;
  }

  // Fallback: stringify JSON body if present
  try {
    return JSON.stringify(body as Record<string, unknown>, null, 2);
  } catch {
    return rawText;
  }
}

export async function POST(req: NextRequest) {
  let body: EnqueueBody;

  try {
    body = (await req.json()) as EnqueueBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const templateId = body.templateId ?? body.workflowTemplateId;

  if (!templateId) {
    return NextResponse.json(
      { error: "Missing templateId/workflowTemplateId" },
      { status: 400 },
    );
  }

  const targetUrl = new URL("/api/jobs", req.url).toString();

  // Try a couple of candidate shapes that /api/jobs might accept.
  const candidates: Record<string, unknown>[] = [
    {
      templateId,
      journeyKey: body.journeyKey,
      metadata: body.metadata,
      input: body.input,
    },
    {
      workflowTemplateId: templateId,
      journeyKey: body.journeyKey,
      metadata: body.metadata,
      input: body.input,
    },
  ];

  let lastStatus = 500;
  let lastBody: unknown = null;
  let lastRawText: string | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const { response, body: jobsBody, rawText } = await postToJobs(
      targetUrl,
      candidate,
    );

    lastStatus = response.status;
    lastBody = jobsBody;
    lastRawText = rawText;

    if (response.ok) {
      // Pass through whatever /api/jobs returned on success
      return NextResponse.json(jobsBody, { status: response.status });
    }

    const message = getErrorMessage(jobsBody, rawText);

    // If it's clearly the "Invalid body" validation case and we have more
    // candidates to try, fall through to the next shape.
    if (
      response.status === 400 &&
      message === "Invalid body" &&
      i < candidates.length - 1
    ) {
      continue;
    }

    // For any other error, bubble up the detailed message immediately.
    return NextResponse.json(
      {
        error: `Jobs API error (${response.status}): ${message ?? "Unknown error"}`,
      },
      { status: response.status },
    );
  }

  // All candidate shapes were rejected as "Invalid body" (or similar).
  const finalMessage = getErrorMessage(lastBody, lastRawText);

  return NextResponse.json(
    {
      error: `Failed to enqueue job (${lastStatus}): ${finalMessage ?? "all payload shapes were rejected"}`,
    },
    { status: lastStatus },
  );
}
