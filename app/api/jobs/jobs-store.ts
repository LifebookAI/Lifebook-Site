// lifebook:compat-jobs-store
// Legacy routes may import "jobs-store" from relative paths under /app/api/jobs.
// This shim forces every import to point at the single canonical store.
export * from '@/lib/jobs/store';
