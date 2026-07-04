/**
 * Data-report verifier (M1: structural checks).
 * M2 upgrades this to provenance verification: the deliverable must cite an
 * on-chain DataOracle purchase receipt, and the buyer checks the receipt's
 * value matches the reported number.
 */
import type { JobSpec, Deliverable, Verdict } from "../../types.js";

export function verifyData(job: JobSpec, deliverable: Deliverable): Verdict {
  const text = deliverable.content ?? "";
  const base = { jobId: job.id, sellerId: deliverable.sellerId };

  const checks: { label: string; ok: boolean }[] = [
    { label: "contains a price number", ok: /\$?\s?\d[\d,]*(\.\d+)?/.test(text) },
    { label: "mentions the topic", ok: /btc|bitcoin/i.test(text) },
    { label: "has a summary line", ok: text.trim().split("\n").length >= 2 },
    { label: "cites a source", ok: /source|oracle|receipt/i.test(text) },
  ];
  if (job.dataContext?.mustCite) {
    // must cite a real tx hash — the async provenance check then verifies it on-chain
    checks.push({ label: "cites an on-chain purchase receipt", ok: /Receipt:\s*0x[0-9a-fA-F]{64}/.test(text) });
  }
  const failed = checks.filter((c) => !c.ok);
  const score = Math.round(((checks.length - failed.length) / checks.length) * 10);
  return {
    ...base,
    pass: failed.length === 0,
    score,
    notes: failed.length === 0 ? "Report complete: price, topic, summary, source." : `Missing: ${failed.map((c) => c.label).join(", ")}.`,
  };
}
