/**
 * Guarded LLM client — the ONLY place we call OpenAI. Every guardrail lives here:
 *
 *   • AI OFF by default        → dev/testing costs $0. Turn on with  USE_AI=1
 *   • max_tokens cap per call  → no single call can balloon
 *   • hard per-process ceiling → no runaway loop can spam the API
 *   • model pinned via .env    → can't accidentally hit an expensive model
 *   • fallback on ANY failure  → a slow/failed API never breaks the flow
 *
 * Callers always pass a `fallback` string; if AI is off, capped, or errors, they
 * transparently get the fallback and the app carries on. (Principle 12.)
 */
import "dotenv/config";
import process from "node:process";
import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const AI_ENABLED = process.env.USE_AI === "1" && !!process.env.OPENAI_API_KEY;
// Rolling hourly budget — guards against runaway loops without permanently
// degrading a long-running server to canned fallbacks. One full "open all
// markets" uses ~40 calls; 150/hour ≈ three full market opens + floor runs.
const MAX_CALLS_PER_HOUR = Number(process.env.AI_MAX_CALLS ?? 150);
const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_TOKENS = 250;

let callCount = 0;
let windowStart = Date.now();
let totalTokens = 0;

function budgetLeft(): boolean {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    callCount = 0;
  }
  return callCount < MAX_CALLS_PER_HOUR;
}
let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export const aiEnabled = () => AI_ENABLED;
export const aiStats = () => ({ enabled: AI_ENABLED, model: MODEL, calls: callCount, totalTokens });

export interface GenOpts {
  user: string;
  fallback: string;
  system?: string;
  maxTokens?: number;
  /** Per-agent switch: scripted agents set this to force the deterministic fallback. */
  disabled?: boolean;
}

export async function generate(opts: GenOpts): Promise<{ text: string; usedAI: boolean }> {
  if (opts.disabled || !AI_ENABLED || !budgetLeft()) return { text: opts.fallback, usedAI: false };
  callCount++;
  try {
    const messages = [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: opts.user },
    ];
    const r = await getClient().chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: 0.7,
    });
    totalTokens += r.usage?.total_tokens ?? 0;
    const text = r.choices[0]?.message?.content?.trim();
    return text ? { text, usedAI: true } : { text: opts.fallback, usedAI: false };
  } catch {
    return { text: opts.fallback, usedAI: false };
  }
}
