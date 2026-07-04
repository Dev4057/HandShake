/**
 * Competency 5 in action — the manager negotiates OUT LOUD, then AI-judges the
 * delivered page. Prints real token usage at the end.
 *
 *   npm run ai-demo          → AI OFF (free, uses fallbacks)
 *   USE_AI=1 npm run ai-demo → AI ON (real calls, ~4 total)
 */
import { LANDING_JOB } from "./fixtures.js";
import { MockSeller } from "./sellers/mockSeller.js";
import { seedReputations } from "./reputation.js";
import { runMarket } from "./buyer/runMarket.js";
import { aiJudgeLanding } from "./buyer/verify/landing.js";
import { aiEnabled, aiStats } from "./llm.js";

const sellers = [
  new MockSeller({ id: "PixelPro",  startPrice: 480, floorPrice: 400, startDelivery: 1, floorDelivery: 1,   concession: 0.5, pitch: "Clean, mobile-responsive — my specialty.", delivers: "good" }),
  new MockSeller({ id: "CheapBot",  startPrice: 300, floorPrice: 260, startDelivery: 4, floorDelivery: 3,   concession: 0.5, pitch: "Cheapest price you'll get.",              delivers: "bad"  }),
  new MockSeller({ id: "PremiumCo", startPrice: 510, floorPrice: 470, startDelivery: 2, floorDelivery: 1.5, concession: 0.4, pitch: "Premium design, 2-year support.",        delivers: "good" }),
];

const job = LANDING_JOB;
const result = await runMarket(job, sellers, seedReputations());

console.log(`\n=== HANDSHAKE (AI ${aiEnabled() ? "ON" : "OFF — using fallbacks"}) ===`);
console.log(`"${job.task}"\n`);

for (const rl of result.negotiation.rounds) {
  const table = rl.scored.map((s, i) => `${i === 0 ? "👑" : "  "}${s.offer.sellerId}($${s.offer.price}/${s.offer.deliveryEst}h,${s.score.toFixed(0)})`).join("   ");
  console.log(`R${rl.round}: ${table}`);
  console.log(`   🗣️  ${rl.managerLine}\n`);
}

console.log(`🏆 hired: ${result.winnerId}. Delivered work — now judging...`);
const verdict = await aiJudgeLanding(job, result.deliverable);
console.log(`🔍 ${verdict.pass ? "✅ PASS" : "❌ FAIL"} (${verdict.score}/10) — ${verdict.notes}`);

const s = aiStats();
console.log(`\n💰 usage this run: ${s.calls} AI calls, ${s.totalTokens} tokens total  (model: ${s.model})\n`);
