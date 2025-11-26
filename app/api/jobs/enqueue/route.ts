import { NextRequest, NextResponse } from "next/server";
import { enqueueJob } from "@/lib/jobs/store";

type EnqueueBody = {
  trackId: string;
  trackTitle: string;
  stepId: string;
  stepTitle: string;
  templateId: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const data = (await req.json()) as Partial<EnqueueBody>;

  const { trackId, trackTitle, stepId, stepTitle, templateId } = data;

  if (
    !isNonEmptyString(trackId) ||
    !isNonEmptyString(trackTitle) ||
    !isNonEmptyString(stepId) ||
    !isNonEmptyString(stepTitle) ||
    !isNonEmptyString(templateId)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields in request body." },
      { status: 400 },
    );
  }

  const job = enqueueJob({
    trackId,
    trackTitle,
    stepId,
    stepTitle,
    templateId,
  });

  return NextResponse.json(job, { status: 201 });
}