/**
 * Temporary in-memory DB stub for the Library store.
 * Satisfies `import("../db/server")` in lib/library/server.ts for Next 15 CI.
 * Replace with the real database client during MVP wiring.
 */

export type DbClient = {
  // Match the shape the library store expects (at least a query method).
  query: (...args: any[]) => Promise<any>;
};

const db: DbClient = {
  async query(..._args: any[]): Promise<any> {
    // No-op stub: return an empty result set.
    return { rows: [], rowCount: 0 };
  },
};

export { db };
export default db;
