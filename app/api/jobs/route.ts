import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs/store";

export function GET() {
  const jobs = listJobs();
  return NextResponse.json(jobs);
}