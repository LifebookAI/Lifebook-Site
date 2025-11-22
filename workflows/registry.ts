import type { WorkflowKey, WorkflowTemplate } from "./types";

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "sample_hello_world",
    name: "Sample: Hello Workflow",
    description:
      "Tiny sample workflow to verify that the orchestrator wiring, credits, and logging all behave as expected.",
    defaultTrigger: "manual",
    tags: ["internal", "smoke-test"],
  },
  {
    key: "aws_foundations_daily_digest",
    name: "AWS Foundations – Daily Digest",
    description:
      "Pull together your latest AWS study artifacts (labs, notes, flashcards) into a single daily digest saved to your Library and Notion.",
    defaultTrigger: "schedule",
    tags: ["AWS", "Study Track"],
  },
  {
    key: "devops_essentials_daily_digest",
    name: "DevOps Essentials – Daily Digest",
    description:
      "Summarize your most recent DevOps learning (pipelines, IaC changes, incidents) into a lightweight brief.",
    defaultTrigger: "schedule",
    tags: ["DevOps", "Study Track"],
  },
  {
    key: "creator_brief_pack",
    name: "Creator Brief Pack",
    description:
      "Turn a long-form video or audio into a structured brief with sections you can reuse across platforms. (Carried forward from Creator Pack.)",
    defaultTrigger: "manual",
    tags: ["Creator", "Media"],
  },
];

export function getWorkflowTemplate(
  key: WorkflowKey
): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((w) => w.key === key);
}
