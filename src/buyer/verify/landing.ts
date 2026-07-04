/**
 * Landing-page verifier — deterministic placeholder.
 *
 * Judging whether a page "looks good" is genuinely fuzzy, so this is where the AI
 * judge takes over in Competency 5. For now we do cheap structural checks so the
 * pipeline works end-to-end with no AI. Each requirement contributes to the score.
 */
import type { JobSpec, Deliverable, Verdict } from "../../types.js";
import { generate } from "../../llm.js";

interface Check {
  label: string;
  test: (html: string) => boolean;
}

const CHECKS: Check[] = [
  { label: "single HTML file (no external stylesheet)", test: (h) => /<html|<!doctype/i.test(h) && !/<link[^>]+stylesheet/i.test(h) },
  { label: "dark theme", test: (h) => /dark/i.test(h) || /background(-color)?\s*:\s*#(0|1|2)/i.test(h) || /background(-color)?\s*:\s*(black|#000)/i.test(h) },
  { label: "hero section", test: (h) => /<h1[\s>]/i.test(h) },
  { label: "3 feature cards", test: (h) => (h.match(/feature/gi)?.length ?? 0) >= 3 || (h.match(/<(section|div|article)[^>]*card/gi)?.length ?? 0) >= 3 },
  { label: "email signup", test: (h) => /type\s*=\s*["']?email/i.test(h) || /placeholder\s*=\s*["'][^"']*email/i.test(h) },
];

export function verifyLanding(job: JobSpec, deliverable: Deliverable): Verdict {
  const html = deliverable.content ?? "";
  const passed = CHECKS.filter((c) => c.test(html));
  const failed = CHECKS.filter((c) => !c.test(html));
  const score = Math.round((passed.length / CHECKS.length) * 10);
  const pass = failed.length === 0;
  const notes = pass
    ? `All ${CHECKS.length} requirements met.`
    : `Missing: ${failed.map((c) => c.label).join(", ")}.`;
  return { jobId: job.id, sellerId: deliverable.sellerId, pass, score, notes };
}

/**
 * AI-judge upgrade. Asks the model to grade the page against the requirements,
 * forced into strict JSON. Falls back to the deterministic verdict above if AI is
 * off or returns anything unparseable — so it's never less reliable than the base.
 */
export async function aiJudgeLanding(job: JobSpec, deliverable: Deliverable): Promise<Verdict> {
  const base = verifyLanding(job, deliverable); // deterministic fallback + safety net
  const { text, usedAI } = await generate({
    system:
      "You are a strict QA reviewer. Judge whether the HTML meets EVERY requirement. " +
      'Reply with ONLY compact JSON: {"pass":boolean,"score":0-10,"notes":"one short sentence"}.',
    user: `Requirements:\n- ${job.requirements.join("\n- ")}\n\nHTML:\n${deliverable.content}`,
    fallback: JSON.stringify({ pass: base.pass, score: base.score, notes: base.notes }),
    maxTokens: 200,
  });
  if (!usedAI) return base;
  try {
    const j = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      jobId: job.id,
      sellerId: deliverable.sellerId,
      pass: !!j.pass,
      score: Math.max(0, Math.min(10, Number(j.score) || 0)),
      notes: String(j.notes ?? base.notes),
    };
  } catch {
    return base;
  }
}
