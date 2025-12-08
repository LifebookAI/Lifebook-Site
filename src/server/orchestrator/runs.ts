import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';

export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RunSummary {
  id: string;
  label: string;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
  status: RunStatus;
}

export interface RunDetail extends RunSummary {
  workflowSlug: string;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string | null;
}

async function loadFixture(): Promise<RunDetail[]> {
  const filePath = path.join(
    process.cwd(),
    'infra',
    'orchestrator',
    'fixtures',
    'runs.json',
  );

  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as RunDetail[];
}

export async function listRuns(): Promise<RunSummary[]> {
  const runs = await loadFixture();

  return runs
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, label, createdAt, updatedAt, status }) => ({
      id,
      label,
      createdAt,
      updatedAt,
      status,
    }));
}

export async function getRunDetail(id: string): Promise<RunDetail | null> {
  const runs = await loadFixture();
  const run = runs.find((r) => r.id === id);
  return run ?? null;
}
