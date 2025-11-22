export type TriggerType = "manual" | "schedule" | "webhook";

export type WorkflowKey =
  | "sample_hello_world"
  | "creator_brief_pack"
  | "aws_foundations_daily_digest"
  | "devops_essentials_daily_digest";

/**
 * Core description of a workflow template.
 * Implementation details (steps, orchestrator wiring) live in backend modules.
 */
export interface WorkflowTemplate<Input = unknown> {
  key: WorkflowKey;
  name: string;
  description: string;
  /**
   * Default trigger for this template.
   * MVP supports manual; schedule/webhook follow.
   */
  defaultTrigger: TriggerType;
  /**
   * Optional example of the input payload shape for docs/UX.
   */
  inputExample?: Input;
  /**
   * Tags to group workflows in the UI (e.g. "AWS", "DevOps", "Creator").
   */
  tags?: string[];
}
