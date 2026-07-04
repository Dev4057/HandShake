/**
 * Walking skeleton — watch the manager run a full 3-round negotiation against
 * three mock sellers, with NO AI. Run:  npm run demo
 */
import { LANDING_JOB } from "./fixtures.js";
import { MockSeller } from "./sellers/mockSeller.js";
import { seedReputations } from "./reputation.js";
import { runNegotiation } from "./buyer/negotiate.js";
import type { ScoredOffer } from "./buyer/scoring.js";

const sellers = [
  new MockSeller({ id: "PixelPro",  startPrice: 480, floorPrice: 400, startDelivery: 1, floorDelivery: 1,   concession: 0.5, pitch: "Clean, mobile-responsive — my specialty." }),
  new MockSeller({ id: "CheapBot",  startPrice: 300, floorPrice: 260, startDelivery: 4, floorDelivery: 3,   concession: 0.5, pitch: "Cheapest price you'll get." }),
  new MockSeller({ id: "PremiumCo", startPrice: 510, floorPrice: 470, startDelivery: 2, floorDelivery: 1.5, concession: 0.4, pitch: "Premium design, 2-year support." }),
];

const reps = seedReputations();
const job = LANDING_JOB;
const result = await runNegotiation(job, sellers, reps);

const p = job.priorities;
const row = (s: ScoredOffer, i: number) => {
  const o = s.offer;
  const b = s.breakdown;
  const crown = i === 0 ? "👑" : "  ";
  return `  ${crown} ${o.sellerId.padEnd(10)} $${String(o.price).padStart(3)}  ${String(o.deliveryEst).padStart(3)}h   ` +
    `score ${s.score.toFixed(1).padStart(5)}   [Q ${Math.round(b.quality * 100)} · P ${Math.round(b.price * 100)} · S ${Math.round(b.speed * 100)}]`;
};

console.log(`\n=== HANDSHAKE — "${job.task}" ===`);
console.log(`Budget ${job.budget} MON | priorities: quality ${p.quality} / speed ${p.speed} / price ${p.price}`);
console.log(`(score columns: Q=quality/reputation, P=price, S=speed — each 0-100 before weighting)\n`);

for (const rl of result.rounds) {
  console.log(`--- Round ${rl.round} ---`);
  rl.scored.forEach((s, i) => console.log(row(s, i)));
  if (rl.pushed.length) console.log(`   ↳ buyer pushes ${rl.pushed.join(", ")} to sharpen their offer for next round`);
  console.log("");
}

const w = result.winner;
console.log(`🏆 WINNER: ${w.offer.sellerId} @ $${w.offer.price}, ${w.offer.deliveryEst}h — final score ${w.score.toFixed(1)}`);
console.log(`   "${w.offer.pitch}"\n`);
