/**
 * Full end-to-end market — negotiate -> hire -> deliver -> verify -> verdict.
 * No AI, no chain yet. Run: npm run market
 */
import { LANDING_JOB, SQL_JOB } from "./fixtures.js";
import { MockSeller } from "./sellers/mockSeller.js";
import { seedReputations } from "./reputation.js";
import { runMarket } from "./buyer/runMarket.js";
import type { JobSpec } from "./types.js";

function makeSellers() {
  return [
    new MockSeller({ id: "PixelPro",  startPrice: 480, floorPrice: 400, startDelivery: 1, floorDelivery: 1,   concession: 0.5, pitch: "Clean, mobile-responsive — my specialty.", delivers: "good" }),
    new MockSeller({ id: "CheapBot",  startPrice: 300, floorPrice: 260, startDelivery: 4, floorDelivery: 3,   concession: 0.5, pitch: "Cheapest price you'll get.",              delivers: "bad"  }),
    new MockSeller({ id: "PremiumCo", startPrice: 510, floorPrice: 470, startDelivery: 2, floorDelivery: 1.5, concession: 0.4, pitch: "Premium design, 2-year support.",        delivers: "good" }),
  ];
}

async function runOne(job: JobSpec) {
  const result = await runMarket(job, makeSellers(), seedReputations());
  console.log(`\n=== ${job.type.toUpperCase()} JOB — "${job.task}" ===`);
  for (const rl of result.negotiation.rounds) {
    const line = rl.scored.map((s, i) => `${i === 0 ? "👑" : "  "}${s.offer.sellerId}($${s.offer.price}/${s.offer.deliveryEst}h,${s.score.toFixed(0)})`).join("   ");
    console.log(`  R${rl.round}: ${line}`);
  }
  console.log(`  🏆 hired: ${result.winnerId} @ $${result.negotiation.winner.offer.price}`);
  const v = result.verdict;
  console.log(`  🔍 verify: ${v.pass ? "✅ PASS" : "❌ FAIL"} (${v.score}/10) — ${v.notes}`);
  console.log(`  💸 settlement: ${v.pass ? `PAY ${result.winnerId}, reputation++` : `REFUND buyer, slash ${result.winnerId}'s bond, reputation--`}`);
}

await runOne(LANDING_JOB);
await runOne(SQL_JOB);
console.log("");
