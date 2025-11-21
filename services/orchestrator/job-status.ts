/**
 * JobStatus: canonical state machine for orchestrator jobs.
 *
 * Legal transitions (single-worker, happy path):
 *   queued   -> running | cancelled
 *   running  -> succeeded | failed
 *   terminal -> (no further transitions)
 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set([
  'succeeded',
  'failed',
  'cancelled',
]);

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * canTransition: pure rules engine for valid state changes.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  switch (from) {
    case 'queued':
      return to === 'running' || to === 'cancelled';
    case 'running':
      return to === 'succeeded' || to === 'failed';
    default:
      // Terminal states are not expected to transition further.
      return false;
  }
}

/**
 * How we interpret a failed conditional update when trying to change status.
 *
 * - concurrent-claim   => another worker beat us to "running" (safe no-op, at-least-once noise)
 * - already-completed  => job already finished (safe no-op)
 * - missing            => item not found; treat via retention/error policy
 * - unexpected-*       => suspicious; log as error and investigate
 */
export type PreconditionClassification =
  | 'missing'
  | 'concurrent-claim'
  | 'already-completed'
  | 'unexpected-terminal'
  | 'unexpected-nonterminal';

export function classifyPreconditionFailure(
  expected: JobStatus,
  found?: JobStatus | null,
): PreconditionClassification {
  if (!found) return 'missing';

  // Typical at-least-once races:
  if (expected === 'queued' && found === 'running') return 'concurrent-claim';
  if (expected === 'queued' && found === 'succeeded') return 'already-completed';
  if (expected === 'running' && found === 'succeeded') return 'already-completed';

  if (TERMINAL_STATUSES.has(found)) return 'unexpected-terminal';
  return 'unexpected-nonterminal';
}

/**
 * Wraps a ConditionalCheckFailedException with semantic info for the worker.
 */
export class StatusPreconditionFailedError extends Error {
  public readonly name = 'StatusPreconditionFailedError';

  constructor(
    message: string,
    public readonly expected: JobStatus,
    public readonly found?: JobStatus,
    public readonly classification?: PreconditionClassification,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * True when this error is just an at-least-once replay / race between
   * workers and does NOT indicate data corruption or a broken state machine.
   */
  get isSecondWorkerNoise(): boolean {
    return (
      this.classification === 'concurrent-claim' ||
      this.classification === 'already-completed'
    );
  }
}
