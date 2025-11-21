import { describe, it, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestContext } from '../src/testing/createTestContext.js';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'dead_lettered']);

function expectTerminal(job) {
  expect(job).not.toBeNull();
  expect(TERMINAL_STATUSES.has(job.status)).toBe(true);
}

describe('idempotency', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestContext();
    await ctx.reset();
  });

  it('re-processing the same SQS message is idempotent for a non-terminal job', async () => {
    const jobId = randomUUID();
    const workerId = randomUUID();

    const seeded = await ctx.insertJob({ job_id: jobId, status: 'queued' });
    expect(seeded.job_id).toBe(jobId);
    expect(seeded.status).toBe('queued');

    const first = await ctx.processMessage(jobId, { workerId });
    const afterFirst = await ctx.getJob(jobId);
    expect(afterFirst).not.toBeNull();

    const second = await ctx.processMessage(jobId, { workerId });
    const afterSecond = await ctx.getJob(jobId);
    expect(afterSecond).not.toBeNull();

    // Invariants:
    // - No regression back to "queued".
    // - Duplicate is seeing either in-progress or terminal state.
    expect(afterSecond.status).not.toBe('queued');

    const allowedOutcomes = new Set(['claimed', 'already-claimed', 'no-op-terminal']);
    expect(allowedOutcomes.has(first.outcome)).toBe(true);
    expect(allowedOutcomes.has(second.outcome)).toBe(true);

    const validStatuses = new Set([
      'claimed',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'dead_lettered',
    ]);
    expect(validStatuses.has(afterSecond.status)).toBe(true);
  });

  it('late or out-of-order deliveries are pure no-ops once the job is terminal', async () => {
    const jobId = randomUUID();

    const seeded = await ctx.insertJob({ job_id: jobId, status: 'succeeded' });
    expectTerminal(seeded);

    const before = await ctx.getJob(jobId);
    const result = await ctx.processMessage(jobId);
    const after = await ctx.getJob(jobId);

    expect(result.outcome).toBe('no-op-terminal');
    expect(after.job_id).toBe(before.job_id);
    expect(after.status).toBe(before.status);
    expectTerminal(after);
  });

  it('multiple workers racing on the same job yield a single winner and safe losers', async () => {
    const jobId = randomUUID();

    const seeded = await ctx.insertJob({ job_id: jobId, status: 'queued' });
    expect(seeded.job_id).toBe(jobId);
    expect(seeded.status).toBe('queued');

    const [resultA, resultB] = await Promise.all([
      ctx.processMessage(jobId, { simulateWorkDelayMs: 25 }),
      ctx.processMessage(jobId, { simulateWorkDelayMs: 25 }),
    ]);

    const finalJob = await ctx.getJob(jobId);
    expect(finalJob).not.toBeNull();

    const outcomes = [resultA.outcome, resultB.outcome];
    const claimedCount = outcomes.filter((o) => o === 'claimed').length;
    expect(claimedCount).toBe(1);

    const loserOutcome = outcomes.find((o) => o !== 'claimed');
    const allowedLoserOutcomes = new Set(['already-claimed', 'no-op-terminal']);
    expect(allowedLoserOutcomes.has(loserOutcome)).toBe(true);

    expect(finalJob.status).not.toBe('queued');

    const validStatuses = new Set([
      'claimed',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'dead_lettered',
    ]);
    expect(validStatuses.has(finalJob.status)).toBe(true);
  });
});
