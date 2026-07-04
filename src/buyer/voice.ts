/**
 * Competency 5 — Voice. Turns the manager's numeric decisions into a natural
 * sentence for the demo feed. Always has a templated fallback, so it reads fine
 * even with AI off.
 */
import type { JobSpec } from "../types.js";
import type { RoundLog } from "./negotiate.js";
import { generate } from "../llm.js";

export async function managerLine(
  job: JobSpec,
  rl: RoundLog,
  opts?: { scripted?: boolean },
): Promise<{ text: string; usedAI: boolean }> {
  const leader = rl.scored[0];
  const rest = rl.scored.slice(1);
  const standings = rl.scored
    .map((s) => `${s.offer.sellerId}: $${s.offer.price}, ${s.offer.deliveryEst}h, score ${s.score.toFixed(0)}`)
    .join("; ");

  const fallback = rest.length
    ? `${leader.offer.sellerId} leads at $${leader.offer.price}/${leader.offer.deliveryEst}h. ` +
      `${rest.map((r) => r.offer.sellerId).join(" and ")} — sharpen your offer to compete.`
    : `${leader.offer.sellerId} wins on value.`;

  return generate({
    disabled: opts?.scripted,
    system:
      "You are a sharp, terse procurement manager running a live bidding war. " +
      "Reply in ONE or two sentences, cite the specific numbers, and push the losing sellers to improve. No fluff, no preamble.",
    user:
      `Job: ${job.task}\n` +
      `Priorities: quality ${job.priorities.quality} / speed ${job.priorities.speed} / price ${job.priorities.price}.\n` +
      `Round ${rl.round} standings: ${standings}.\n` +
      `Write the manager's message to the sellers.`,
    fallback,
    maxTokens: 120,
  });
}
