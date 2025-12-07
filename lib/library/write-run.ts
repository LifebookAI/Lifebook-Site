import { pgQuery } from "@/lib/j1-db";
import type {
  LibraryArtifactType,
  LibraryRunStatus,
} from "@/lib/library/runs";

export type NewLibraryRunInput = {
  id: string;
  workspaceId: string;
  label: string;
  status: LibraryRunStatus;
  startedAt: Date | string;
  completedAt?: Date | string | null;
  sourceJobId?: string | null;
  sourceKind?: string;
};

export type NewLibraryArtifactInput = {
  id: string;
  label: string;
  type: LibraryArtifactType;
  createdAt: Date | string;
  storageUri?: string | null;
  metadata?: unknown;
};

/**
 * Minimal helper to upsert a Library run + its artifacts into Postgres.
 *
 * This is intended to be called from the orchestrator/job pipeline once a
 * workflow run completes. It prefers idempotency: the run is upserted on id,
 * and artifacts are upserted on id as well.
 */
export async function upsertLibraryRunWithArtifacts(
  run: NewLibraryRunInput,
  artifacts: NewLibraryArtifactInput[],
): Promise<void> {
  const sourceKind = run.sourceKind ?? "workflow";

  await pgQuery(
    `
      INSERT INTO library_runs (
        id,
        workspace_id,
        label,
        status,
        started_at,
        completed_at,
        source_job_id,
        source_kind
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      ON CONFLICT (id) DO UPDATE
      SET
        workspace_id = EXCLUDED.workspace_id,
        label        = EXCLUDED.label,
        status       = EXCLUDED.status,
        started_at   = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        source_job_id = EXCLUDED.source_job_id,
        source_kind   = EXCLUDED.source_kind,
        updated_at    = now()
    `,
    [
      run.id,
      run.workspaceId,
      run.label,
      run.status,
      run.startedAt,
      run.completedAt ?? null,
      run.sourceJobId ?? null,
      sourceKind,
    ],
  );

  if (artifacts.length === 0) {
    return;
  }

  for (const art of artifacts) {
    await pgQuery(
      `
        INSERT INTO library_artifacts (
          id,
          run_id,
          label,
          type,
          storage_uri,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb
        )
        ON CONFLICT (id) DO UPDATE
        SET
          run_id     = EXCLUDED.run_id,
          label      = EXCLUDED.label,
          type       = EXCLUDED.type,
          storage_uri = EXCLUDED.storage_uri,
          metadata    = EXCLUDED.metadata,
          updated_at  = now()
      `,
      [
        art.id,
        run.id,
        art.label,
        art.type,
        art.storageUri ?? null,
        JSON.stringify(art.metadata ?? {}),
      ],
    );
  }
}