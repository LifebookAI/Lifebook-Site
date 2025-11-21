import { randomUUID } from 'node:crypto';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'dead_lettered']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createTestContext() {
  const jobs = new Map();

  async function reset() {
    jobs.clear();
  }

  async function insertJob(input) {
    const jobId = input.job_id ?? randomUUID();
    const job = {
      job_id: jobId,
      status: input.status,
      version: 1,
      locked_by: null,
      locked_at: null,
    };
    jobs.set(jobId, job);
    return { ...job };
  }

  async function getJob(jobId) {
    const job = jobs.get(jobId);
    return job ? { ...job } : null;
  }

  async function processMessage(jobId, opts = {}) {
    const simulateWorkDelayMs = opts.simulateWorkDelayMs ?? 0;
    const workerId = opts.workerId ?? randomUUID();

    const current = jobs.get(jobId);
    if (!current) {
      throw new Error('Job not found: ' + jobId);
    }

    // Terminal: pure no-op.
    if (TERMINAL_STATUSES.has(current.status)) {
      return {
        outcome: 'no-op-terminal',
        job: { ...current },
      };
    }

    // Already claimed by someone else: no-op for this worker.
    if (current.locked_by && current.locked_by !== workerId) {
      return {
        outcome: 'already-claimed',
        job: { ...current },
      };
    }

    // Claim the job (non-terminal + not claimed by another worker).
    const claimed = {
      ...current,
      status: 'claimed',
      version: current.version + 1,
      locked_by: workerId,
      locked_at: Date.now(),
    };
    jobs.set(jobId, claimed);

    // Simulate doing work.
    if (simulateWorkDelayMs > 0) {
      await sleep(simulateWorkDelayMs);
    }

    // If still claimed by this worker, mark as succeeded (terminal).
    const afterDelay = jobs.get(jobId);
    if (
      afterDelay &&
      afterDelay.locked_by === workerId &&
      afterDelay.status === 'claimed'
    ) {
      const completed = {
        ...afterDelay,
        status: 'succeeded',
        version: afterDelay.version + 1,
      };
      jobs.set(jobId, completed);
      return {
        outcome: 'claimed',
        job: { ...completed },
      };
    }

    // Someone else changed it while we were "working".
    const final = jobs.get(jobId) ?? current;

    if (TERMINAL_STATUSES.has(final.status)) {
      return {
        outcome: 'no-op-terminal',
        job: { ...final },
      };
    }

    return {
      outcome: 'already-claimed',
      job: { ...final },
    };
  }

  return {
    reset,
    insertJob,
    getJob,
    processMessage,
  };
}
