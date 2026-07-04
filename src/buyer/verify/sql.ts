/**
 * SQL verifier — the credibility ace. The manager does NOT trust the seller's
 * word that the query is right; it actually RUNS it against a throwaway database
 * and compares the result to the answer key (the job's reference solution).
 *
 * This is objective: a wrong query fails, no AI opinion involved. (Principle 8.)
 */
import { DatabaseSync } from "node:sqlite";
import type { JobSpec, Deliverable, Verdict } from "../../types.js";

type Row = Record<string, unknown>;

/** Run a query against a fresh in-memory db seeded with the job's schema + rows. */
function runQuery(schema: string, seed: string, query: string): Row[] {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(schema);
    db.exec(seed);
    return db.prepare(query).all() as Row[];
  } finally {
    db.close();
  }
}

/** Order-sensitive, value-based comparison of two result sets. */
function sameResult(a: Row[], b: Row[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    const keys = Object.keys(row);
    if (keys.length !== Object.keys(other).length) return false;
    // compare by value, tolerant of number/string formatting
    return keys.every((k) => String(row[k]) === String(other[k]));
  });
}

export function verifySql(job: JobSpec, deliverable: Deliverable): Verdict {
  const ctx = job.sqlContext;
  const base = { jobId: job.id, sellerId: deliverable.sellerId };

  if (!ctx) {
    return { ...base, pass: false, score: 0, notes: "Job has no SQL context to verify against." };
  }

  // 1. the answer key
  let expected: Row[];
  try {
    expected = runQuery(ctx.schema, ctx.seedRows, ctx.solution);
  } catch (e) {
    return { ...base, pass: false, score: 0, notes: `Reference solution failed to run: ${(e as Error).message}` };
  }

  // 2. the seller's submission — a broken query fails outright
  let got: Row[];
  try {
    got = runQuery(ctx.schema, ctx.seedRows, deliverable.content);
  } catch (e) {
    return { ...base, pass: false, score: 0, notes: `Query errored: ${(e as Error).message}` };
  }

  // 3. grade
  if (sameResult(got, expected)) {
    return { ...base, pass: true, score: 10, notes: `Query returned the correct ${got.length} rows.` };
  }

  // partial credit: right shape, wrong data still fails but scores > 0 for the demo feed
  const rightRowCount = got.length === expected.length;
  const score = rightRowCount ? 4 : 1;
  return {
    ...base,
    pass: false,
    score,
    notes: `Result did not match the answer key. Expected ${expected.length} rows, got ${got.length}.`,
  };
}
