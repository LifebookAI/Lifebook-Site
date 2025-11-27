import { pgQuery } from "./j1-db";

export type J1JoinedLabSession = {
  job_id: string;
  job_kind: string;
  job_status: string | null;
  job_track: string;
  job_lab: string;
  job_created_at: string;

  session_id: string;
  session_title: string;
  session_status: string | null;
  session_created_at: string;
};

export async function getLatestJ1LabSessions(limit = 10): Promise<J1JoinedLabSession[]> {
  const result = await pgQuery<J1JoinedLabSession>(
    `SELECT
       j.id         AS job_id,
       j.kind       AS job_kind,
       j.status     AS job_status,
       j.track_slug AS job_track,
       j.lab_slug   AS job_lab,
       j.created_at AS job_created_at,
       l.id         AS session_id,
       l.title      AS session_title,
       l.status     AS session_status,
       l.created_at AS session_created_at
     FROM lab_sessions l
     JOIN jobs j ON j.id = l.job_id
     WHERE j.track_slug = 'aws-foundations-j1'
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
