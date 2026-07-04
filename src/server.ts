/**
 * Handshake API — feeds the web UI. Reuses the exact agent + chain code we built.
 * Run:  npm run server   (http://localhost:8787)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import express from "express";
import cors from "cors";
import { LANDING_JOB, SQL_JOB } from "./fixtures.js";
import { SellerAgent } from "./sellers/sellerAgent.js";
import { seedReputations } from "./reputation.js";
import { runMarket } from "./buyer/runMarket.js";
import { aiJudgeLanding } from "./buyer/verify/landing.js";
import { aiEnabled } from "./llm.js";
import { startSettlement, getSettlement } from "./chain/settlement.js";
import { loadAgentWallets } from "./chain/wallets.js";
import { signer } from "./chain/escrow.js";
import { openAllMarkets, listSessions, getSession, getReputations, BUYERS, makeSellerPool } from "./market/sessions.js";
import type { JobSpec, Reputation } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

// ---- in-memory agent registry (on-chain AgentRegistry contract comes next) ----
interface Agent {
  id: string;
  name: string;
  role: "seller" | "buyer";
  skills: string;      // sellers: capabilities · buyers: what they procure
  wallet: string;      // REAL address from the persistent wallet store
  reputation: Reputation;
}

const reps = seedReputations();

/** Directory built from the actual marketplace roster, with REAL wallet addresses. */
const SELLER_META: Record<string, string> = {
  PixelPro: "Landing pages, responsive frontend",
  CheapBot: "Budget builds, quick turnarounds",
  PremiumCo: "Premium design, long support",
  QueryForge: "SQL, analytics pipelines",
  DataScout: "Live market data, paid API sourcing",
  InfoSnap: "Generic web scraping",
};

const agents: Agent[] = [];

async function seedDirectory() {
  const sellerIds = Object.keys(SELLER_META);
  const sellerWallets = await loadAgentWallets(sellerIds);
  for (const sw of sellerWallets) {
    agents.push({
      id: sw.sellerId,
      name: sw.sellerId,
      role: "seller",
      skills: SELLER_META[sw.sellerId],
      wallet: sw.wallet.address,
      reputation: reps.get(sw.sellerId) ?? { sellerId: sw.sellerId, jobs: 0, successes: 0, score: 0 },
    });
  }
  const master = await signer().catch(() => null);
  for (const b of BUYERS) {
    const wallet =
      b.wallet === "master"
        ? master?.address ?? "master"
        : (await loadAgentWallets([b.id]))[0].wallet.address;
    agents.push({
      id: b.id,
      name: b.name,
      role: "buyer",
      skills: `Procures: ${b.job.type} · budget $${b.job.budget}`,
      wallet,
      reputation: { sellerId: b.id, jobs: 0, successes: 0, score: 0 },
    });
  }
  console.log(`directory seeded: ${agents.length} agents (with real wallets)`);
}
seedDirectory().catch((e) => console.error("directory seed failed:", e.message));

/** One roster for the whole marketplace — defined in market/sessions.ts. */
const makeSellers = makeSellerPool;

async function runNarrated(job: JobSpec) {
  const result = await runMarket(job, makeSellers(), reps);
  const rounds = result.negotiation.rounds.map((rl) => ({
      round: rl.round,
      leader: rl.leader,
      pushed: rl.pushed,
      managerLine: rl.managerLine,
      offers: rl.scored.map((s) => ({
        sellerId: s.offer.sellerId,
        price: s.offer.price,
        deliveryEst: s.offer.deliveryEst,
        pitch: s.offer.pitch,
        score: s.score,
        breakdown: s.breakdown,
      })),
  }));
  // upgrade landing verdict with the AI judge when AI is on
  const verdict = job.type === "landing" ? await aiJudgeLanding(job, result.deliverable) : result.verdict;
  return {
    job: { id: job.id, type: job.type, task: job.task, budget: job.budget, requirements: job.requirements, priorities: job.priorities },
    winnerId: result.winnerId,
    verdict,
    deliverable: result.deliverable,
    rounds,
    aiEnabled: aiEnabled(),
    reputations: Object.fromEntries(reps),
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, aiEnabled: aiEnabled() }));

app.get("/api/chain", (_req, res) => {
  try {
    const d = JSON.parse(readFileSync(new URL("../deployments.json", import.meta.url), "utf8"));
    res.json({ escrow: d.address, explorer: d.explorer });
  } catch {
    res.json({ escrow: null, explorer: null });
  }
});

app.get("/api/agents", (_req, res) => res.json({ agents }));

app.post("/api/register", async (req, res) => {
  try {
    const { name, skills, wallet, role } = req.body ?? {};
    if (!name || !skills) return res.status(400).json({ error: "name and skills required" });
    const agentRole: Agent["role"] = role === "buyer" ? "buyer" : "seller";
    const id = String(name).replace(/\s+/g, "");
    if (agents.some((a) => a.id === id)) return res.status(409).json({ error: "agent id already registered" });
    // no wallet supplied -> mint a REAL persistent wallet for this agent
    const realWallet = wallet || (await loadAgentWallets([id]))[0].wallet.address;
    const agent: Agent = {
      id,
      name,
      role: agentRole,
      skills,
      wallet: realWallet,
      reputation: { sellerId: id, jobs: 0, successes: 0, score: 0 },
    };
    agents.push(agent);
    return res.json({ agent });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

app.post("/api/market/run", async (req, res) => {
  try {
    const job = req.body?.jobType === "sql" ? SQL_JOB : LANDING_JOB;
    res.json(await runNarrated(job));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---- multi-market sessions ----

const sessionView = (s: ReturnType<typeof listSessions>[number]) => ({
  id: s.id,
  reputations: Object.fromEntries(getReputations()),
  buyer: { id: s.buyer.id, name: s.buyer.name, scripted: s.buyer.scripted },
  job: { id: s.buyer.job.id, type: s.buyer.job.type, task: s.buyer.job.task, budget: s.buyer.job.budget, priorities: s.buyer.job.priorities, requirements: s.buyer.job.requirements },
  status: s.status,
  bidders: s.bidders,
  error: s.error,
  winnerId: s.result?.winnerId ?? null,
  verdict: s.result?.verdict ?? null,
  deliverable: s.result?.deliverable ?? null,
  rounds: s.result?.negotiation.rounds.map((rl) => ({
    round: rl.round,
    leader: rl.leader,
    pushed: rl.pushed,
    managerLine: rl.managerLine,
    offers: rl.scored.map((sc) => ({
      sellerId: sc.offer.sellerId, price: sc.offer.price, deliveryEst: sc.offer.deliveryEst,
      pitch: sc.offer.pitch, score: sc.score, breakdown: sc.breakdown,
    })),
  })) ?? [],
});

app.post("/api/markets/open", (_req, res) => {
  res.json({ sessions: openAllMarkets().map(sessionView), buyers: BUYERS.map((b) => ({ id: b.id, name: b.name, scripted: b.scripted })) });
});

app.get("/api/markets", (_req, res) => {
  res.json({ sessions: listSessions().map(sessionView) });
});

app.get("/api/markets/:id", (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  return res.json(sessionView(s));
});

app.post("/api/settle", (req, res) => {
  try {
    const { jobId, winnerId, sellerIds, winnerPrice, budget, pass, score, buyerId } = req.body ?? {};
    if (!jobId || !winnerId || !Array.isArray(sellerIds) || !sellerIds.length) {
      return res.status(400).json({ error: "jobId, winnerId and sellerIds required" });
    }
    const buyerCfg = buyerId ? BUYERS.find((b) => b.id === buyerId) : undefined;
    const s = startSettlement({
      jobId: String(jobId),
      winnerId: String(winnerId),
      sellerIds: sellerIds.map(String),
      winnerPrice: Number(winnerPrice) || 0,
      budget: Number(budget) || 1,
      pass: !!pass,
      score: Math.max(0, Math.min(10, Number(score) || 0)),
      buyer: buyerCfg ? { id: buyerCfg.id, wallet: buyerCfg.wallet } : undefined,
    });
    return res.json(s);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/settle/:id", (req, res) => {
  const s = getSettlement(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  return res.json(s);
});

const PORT = 8787;
app.listen(PORT, () => console.log(`Handshake API → http://localhost:${PORT}`));
