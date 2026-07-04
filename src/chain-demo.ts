/**
 * The full loop with a REAL on-chain settlement on Monad testnet:
 *   run the market -> get winner + verdict -> openJob -> postBond -> settle -> read reputation.
 *
 * Uses tiny amounts (testnet MON). Single wallet plays buyer + winning seller so it
 * runs with just your one funded key. Run:  npm run chain-demo
 */
import { LANDING_JOB } from "./fixtures.js";
import { MockSeller } from "./sellers/mockSeller.js";
import { seedReputations } from "./reputation.js";
import { runMarket } from "./buyer/runMarket.js";
import { signer, openJob, postBond, settle, reputationOf, escrowAddress, txUrl } from "./chain/escrow.js";

// tiny on-chain amounts (the $480 etc. in the market are display units)
const BUDGET = "0.01";
const BOND = "0.002";
const PRICE = "0.008";

const sellers = [
  new MockSeller({ id: "PixelPro",  startPrice: 480, floorPrice: 400, startDelivery: 1, floorDelivery: 1,   concession: 0.5, pitch: "Clean, mobile-responsive.", delivers: "good" }),
  new MockSeller({ id: "CheapBot",  startPrice: 300, floorPrice: 260, startDelivery: 4, floorDelivery: 3,   concession: 0.5, pitch: "Cheapest.",                delivers: "bad"  }),
  new MockSeller({ id: "PremiumCo", startPrice: 510, floorPrice: 470, startDelivery: 2, floorDelivery: 1.5, concession: 0.4, pitch: "Premium.",                 delivers: "good" }),
];

const me = await signer();
const jobId = `${LANDING_JOB.id}-${me.address.slice(2, 8)}`; // unique per run so openJob won't clash

console.log(`\n=== on-chain settlement demo ===`);
console.log(`escrow:  ${escrowAddress()}`);
console.log(`wallet:  ${me.address} (plays buyer + winning seller)\n`);

// 1. run the market off-chain -> winner + verdict
const result = await runMarket(LANDING_JOB, sellers, seedReputations());
console.log(`market: hired ${result.winnerId}, verdict ${result.verdict.pass ? "PASS" : "FAIL"} (${result.verdict.score}/10)`);

const before = await reputationOf(me.address);

// 2. settle on-chain
console.log(`\n▶ openJob (lock ${BUDGET} MON budget)...`);
console.log(`  ${txUrl(await openJob(jobId, BUDGET))}`);
console.log(`▶ postBond (${BOND} MON)...`);
console.log(`  ${txUrl(await postBond(jobId, BOND))}`);
console.log(`▶ settle (${result.verdict.pass ? "PASS -> pay + reputation++" : "FAIL -> refund + slash"})...`);
console.log(`  ${txUrl(await settle(jobId, me.address, PRICE, result.verdict.pass, result.verdict.score))}`);

// 3. read reputation back from chain
const after = await reputationOf(me.address);
console.log(`\n📈 on-chain reputation for winner:`);
console.log(`   before: won ${before.jobsWon}, passed ${before.jobsPassed}, avg ${before.avgScore.toFixed(1)}`);
console.log(`   after:  won ${after.jobsWon}, passed ${after.jobsPassed}, avg ${after.avgScore.toFixed(1)}`);
console.log(`\n✅ verdict settled on Monad. Reputation now lives on-chain.\n`);
