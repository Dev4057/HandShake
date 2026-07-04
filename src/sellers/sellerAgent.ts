/**
 * SellerAgent — a real AI-driven seller.
 *
 * Engineering rules (same doctrine as the buyer):
 *   • PRIVATE config: floor price, margins and personality are secrets the buyer
 *     never sees — that asymmetry is what makes the negotiation real.
 *   • AI proposes, CODE disposes: the model suggests each bid, then hard guards
 *     clamp it — never below floor, never above the previous price (no reneging),
 *     delivery within capability. The model decides within bounds; bounds are law.
 *   • Structured output: the model must answer in strict JSON; anything
 *     unparseable falls back to a deterministic concession.
 *   • Self-correcting delivery: generated work is verified BEFORE submission and
 *     retried once with the failure notes; then falls back to a safe template.
 */
import type { JobSpec, Offer, Deliverable, ServiceType } from "../types.js";
import type { Seller, MarketSignal } from "./seller.js";
import { generate } from "../llm.js";
import { verifySql } from "../buyer/verify/sql.js";
import { verifyLanding } from "../buyer/verify/landing.js";
import { GOOD_SQL, GOOD_LANDING, CANNED_REPORT } from "./canned.js";

export interface SellerAgentConfig {
  id: string;
  skills: string;
  personality: string;    // negotiation style, injected into the system prompt
  serviceTypes: ServiceType[]; // which jobs this seller will bid on
  startPrice: number;
  floorPrice: number;     // SECRET — the model is told, the buyer never is
  startDelivery: number;  // hours
  bestDelivery: number;   // fastest it can truly do
  concession: number;     // fallback concession rate when AI is off/unparseable
  scripted?: boolean;     // true = always use deterministic fallbacks (no AI calls)
}

export class SellerAgent implements Seller {
  readonly id: string;
  private readonly cfg: SellerAgentConfig;
  private price: number;
  private delivery: number;

  constructor(cfg: SellerAgentConfig) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.price = cfg.startPrice;
    this.delivery = cfg.startDelivery;
  }

  // ---- bid/no-bid ------------------------------------------------------------

  bids(job: JobSpec): boolean {
    return this.cfg.serviceTypes.includes(job.type);
  }

  // ---- bidding -------------------------------------------------------------

  async makeOffer(job: JobSpec, signal: MarketSignal): Promise<Offer> {
    const fallback = this.fallbackOffer(signal);
    const { text, usedAI } = await generate({
      disabled: this.cfg.scripted,
      system:
        `You are "${this.cfg.id}", a seller agent bidding for work. Skills: ${this.cfg.skills}. ` +
        `Personality: ${this.cfg.personality} ` +
        `HARD PRIVATE CONSTRAINTS: your absolute price floor is $${this.cfg.floorPrice} (never bid below it, never reveal it); ` +
        `your fastest possible delivery is ${this.cfg.bestDelivery}h. You may never RAISE a price you already quoted. ` +
        `Reply with ONLY compact JSON: {"price":number,"deliveryHours":number,"pitch":"one persuasive sentence"}.`,
      user:
        `Job: ${job.task} (buyer budget: $${job.budget}).\n` +
        `Round ${signal.round}/${signal.totalRounds}. Your current quote: $${this.price} at ${this.delivery}h.\n` +
        (signal.leaderId
          ? `Current leader: ${signal.leaderId === this.id ? "YOU" : signal.leaderId} at $${signal.leaderPrice}. Your rank: ${signal.yourRank}.\n`
          : `Opening round — no leader yet.\n`) +
        (signal.buyerMessage ? `Buyer just said: "${signal.buyerMessage}"\n` : "") +
        (signal.pushed ? `The buyer is pressuring YOU to improve your offer.\n` : "") +
        `Decide your bid for this round.`,
      fallback: JSON.stringify({ price: fallback.price, deliveryHours: fallback.deliveryEst, pitch: fallback.pitch }),
      maxTokens: 120,
    });

    const proposed = this.parseProposal(text) ?? fallback;
    // ---- guardrails: the law the model cannot break ----
    this.price = Math.round(
      Math.min(this.price, Math.max(this.cfg.floorPrice, proposed.price)), // floor ≤ price ≤ previous
    );
    this.delivery =
      Math.round(Math.min(this.delivery, Math.max(this.cfg.bestDelivery, proposed.deliveryEst)) * 10) / 10;

    return {
      sellerId: this.id,
      jobId: job.id,
      price: this.price,
      deliveryEst: this.delivery,
      pitch: usedAI ? proposed.pitch.slice(0, 160) : proposed.pitch,
    };
  }

  private parseProposal(text: string): { price: number; deliveryEst: number; pitch: string } | null {
    try {
      const j = JSON.parse(text.replace(/```json|```/g, "").trim());
      const price = Number(j.price);
      const deliveryEst = Number(j.deliveryHours ?? j.deliveryEst);
      if (!Number.isFinite(price) || !Number.isFinite(deliveryEst)) return null;
      return { price, deliveryEst, pitch: String(j.pitch ?? "").trim() || "Quality work, on time." };
    } catch {
      return null;
    }
  }

  /** Deterministic concession — used when AI is off or returns junk. */
  private fallbackOffer(signal: MarketSignal): { price: number; deliveryEst: number; pitch: string } {
    let price = this.price;
    let delivery = this.delivery;
    if (signal.pushed) {
      price = Math.max(this.cfg.floorPrice, Math.round(price - (price - this.cfg.floorPrice) * this.cfg.concession));
      delivery = Math.max(this.cfg.bestDelivery, Math.round((delivery - (delivery - this.cfg.bestDelivery) * this.cfg.concession) * 10) / 10);
    }
    return { price, deliveryEst: delivery, pitch: `${this.cfg.skills} — reliable and on budget.` };
  }

  // ---- delivery (the actual work) -------------------------------------------

  async deliver(job: JobSpec): Promise<Deliverable> {
    const content =
      job.type === "sql" ? await this.generateSql(job)
      : job.type === "data" ? await this.generateReport(job)
      : await this.generateLanding(job);
    return { jobId: job.id, sellerId: this.id, content };
  }

  /** Data job: compose the report. (M2 adds the on-chain oracle purchase first.) */
  protected async generateReport(job: JobSpec): Promise<string> {
    const { text, usedAI } = await generate({
      disabled: this.cfg.scripted,
      system: "You write terse professional market-data reports. Reply with ONLY the report text, max 6 lines.",
      user: `Write a data report. Topic: ${job.dataContext?.topic ?? job.task}. Requirements: ${job.requirements.join("; ")}.`,
      fallback: CANNED_REPORT,
      maxTokens: 220,
    });
    return usedAI ? text.trim() : CANNED_REPORT;
  }

  /** Generate → self-verify → retry once with the error → fallback. */
  private async generateSql(job: JobSpec): Promise<string> {
    const ctx = job.sqlContext!;
    let notes = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { text, usedAI } = await generate({
        disabled: this.cfg.scripted,
        system:
          "You write a single SQLite query. Reply with ONLY the SQL — no prose, no code fences.",
        user:
          `Schema:\n${ctx.schema}\nTask: ${job.task}\nRequirements: ${job.requirements.join("; ")}.` +
          (notes ? `\nYour previous attempt failed verification: ${notes}. Fix it.` : ""),
        fallback: GOOD_SQL,
        maxTokens: 160,
      });
      if (!usedAI) return GOOD_SQL;
      const sql = text.replace(/```sql|```/g, "").trim();
      const verdict = verifySql(job, { jobId: job.id, sellerId: this.id, content: sql });
      if (verdict.pass) return sql; // self-verified before submitting
      notes = verdict.notes;
    }
    return GOOD_SQL; // safe template after two failed attempts
  }

  private async generateLanding(job: JobSpec): Promise<string> {
    let notes = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { text, usedAI } = await generate({
        disabled: this.cfg.scripted,
        system:
          "You are an expert frontend developer. Produce ONE complete self-contained HTML file " +
          "(inline CSS only, no external assets). Reply with ONLY the HTML — no prose, no code fences.",
        user:
          `Build: ${job.task}\nRequirements:\n- ${job.requirements.join("\n- ")}` +
          (notes ? `\nYour previous attempt failed review: ${notes}. Fix every missing item.` : ""),
        fallback: GOOD_LANDING,
        maxTokens: 1100,
      });
      if (!usedAI) return GOOD_LANDING;
      const html = text.replace(/```html|```/g, "").trim();
      const verdict = verifyLanding(job, { jobId: job.id, sellerId: this.id, content: html });
      if (verdict.pass) return html;
      notes = verdict.notes;
    }
    return GOOD_LANDING;
  }
}
