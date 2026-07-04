/**
 * DataScout — the seller that SPENDS to earn.
 *
 * When it wins a data job it buys the data from the on-chain DataOracle with
 * its OWN wallet (a real fee-paying transaction), then packages the report and
 * cites the purchase receipt so the buyer can verify provenance on-chain.
 * If the chain is unreachable it degrades to the canned report (demo survives).
 */
import type { JobSpec } from "../types.js";
import { SellerAgent, type SellerAgentConfig } from "./sellerAgent.js";
import { generate } from "../llm.js";
import { CANNED_REPORT } from "./canned.js";
import { loadSellerWallets, fundSellerWallets } from "../chain/wallets.js";
import { buyData } from "../chain/oracle.js";

export class DataScoutAgent extends SellerAgent {
  constructor(cfg: SellerAgentConfig) {
    super(cfg);
  }

  protected override async generateReport(job: JobSpec): Promise<string> {
    try {
      // 1. pay for the data on-chain, from DataScout's own wallet
      const [me] = await loadSellerWallets([this.id]);
      await fundSellerWallets([me]); // top up if low (funded by the master wallet)
      const purchase = await buyData(me.wallet);
      const priceUsd = (purchase.valueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

      // 2. AI writes only the one-line summary; the rest is exact, code-built
      const { text } = await generate({
        system: "You write one terse professional line summarizing a crypto price level. Reply with ONLY that line.",
        user: `BTC/USD is $${priceUsd}. One-line market summary.`,
        fallback: "Bitcoin trades near recent highs; volatility subdued.",
        maxTokens: 60,
      });

      // 3. exact report format — the buyer's verifier depends on these fields
      return [
        `MARKET DATA REPORT — ${job.dataContext?.topic ?? "BTC/USD"}`,
        `Price: $${priceUsd}`,
        `Summary: ${text.trim()}`,
        `Source: Handshake DataOracle (licensed, paid on-chain)`,
        `Receipt: ${purchase.txHash}`,
      ].join("\n");
    } catch {
      return CANNED_REPORT; // chain down -> graceful degradation
    }
  }
}
