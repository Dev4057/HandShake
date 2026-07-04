/**
 * Handshake API — feeds the web UI. Reuses the exact agent + chain code we built.
 * Run:  npm run server   (http://localhost:8787)
 *
 * Hardening:
 *  - CORS allowlist (CORS_ORIGIN env, comma-separated; defaults to the Vite dev origin)
 *  - per-IP rate limits on every mutating route
 *  - optional API key: set API_KEY in .env and mutating routes require x-api-key
 *  - /api/settle derives ALL settlement parameters server-side from the finished
 *    session — clients can no longer forge prices, verdicts, or scores
 *
 * Live updates: GET /api/events is an SSE stream; every session mutation pushes
 * a fresh snapshot, so the UI never has to poll while a market runs.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import express from "express";
import cors from "cors";
import { seedReputations } from "./reputation.js";
import { aiEnabled } from "./llm.js";
import { startSettlement, getSettlement } from "./chain/settlement.js";
import { loadAgentWallets } from "./chain/wallets.js";
import { signer } from "./chain/escrow.js";
import {
  openAllMarkets, openFloorMarket, openMarketFor, listSessions, getSession, getReputations, BUYERS, makeSellerPool,
  type MarketSession,
} from "./market/sessions.js";
import { addRegisteredSeller } from "./market/sellerRegistry.js";
import type { SellerAgentConfig } from "./sellers/sellerAgent.js";
import { bus } from "./market/events.js";
import type { Reputation } from "./types.js";

const app = express();

// ---- CORS: allowlist, not the world ----------------------------------------
const ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: ORIGINS }));
app.use(express.json({ limit: "64kb" }));

// ---- tiny per-IP rate limiter (no deps) -------------------------------------
function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    if (hits.size > 5_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    const key = req.ip ?? "unknown";
    const h = hits.get(key);
    if (!h || now > h.reset) {
      hits.set(key, { n: 1, reset: now + 60_000 });
      return next();
    }
    if (++h.n > maxPerMinute) return res.status(429).json({ error: "rate limit exceeded — try again in a minute" });
    return next();
  };
}

// ---- optional API key on mutating routes ------------------------------------
const API_KEY = process.env.API_KEY;
function requireKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY || req.get("x-api-key") === API_KEY) return next();
  return res.status(401).json({ error: "unauthorized — missing or invalid x-api-key" });
}

// ---- agent registry (persisted to data/agents.json; on-chain registry is next) ----
interface Agent {
  id: string;
  name: string;
  role: "seller" | "buyer";
  skills: string;      // sellers: capabilities · buyers: what they procure
  wallet: string;      // REAL address from the persistent wallet store
  reputation: Reputation;
  /** Account handle that registered this agent. House roster: "Handshake". */
  owner: string;
  /** Sellers: job types this agent bids on. */
  serviceTypes?: string[];
}

const reps = seedReputations();

const HOUSE = "Handshake";

/** Addresses are matched exactly — store them in one canonical (lowercase) form. */
const normalizeOwner = (o: string) => (/^0x[0-9a-fA-F]{40}$/.test(o) ? o.toLowerCase() : o);
const SERVICE_TYPES = ["landing", "sql", "data"] as const;
type ServiceTypeStr = (typeof SERVICE_TYPES)[number];

/** Directory built from the actual marketplace roster, with REAL wallet addresses. */
const SELLER_META: Record<string, { skills: string; types: ServiceTypeStr[] }> = {
  PixelPro: { skills: "Landing pages, responsive frontend", types: ["landing"] },
  CheapBot: { skills: "Budget builds, quick turnarounds", types: ["landing", "sql"] },
  PremiumCo: { skills: "Premium design, long support", types: ["landing", "sql"] },
  QueryForge: { skills: "SQL, analytics pipelines", types: ["sql"] },
  DataScout: { skills: "Live market data, paid API sourcing", types: ["data"] },
  InfoSnap: { skills: "Generic web scraping", types: ["data"] },
};

const agents: Agent[] = [];
const sellerConfigs = new Map<string, SellerAgentConfig>(); // registered sellers' strategies
const claims = new Map<string, string>(); // roster agents assigned to an account
const MAX_AGENTS = 500;
const DATA_DIR = new URL("../data/", import.meta.url);
const AGENTS_FILE = new URL("agents.json", DATA_DIR);

function saveRegisteredAgents() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const registered = agents.filter((a) => !(a.id in SELLER_META) && !BUYERS.some((b) => b.id === a.id));
    writeFileSync(
      AGENTS_FILE,
      JSON.stringify(
        { agents: registered, sellerConfigs: [...sellerConfigs.values()], claims: Object.fromEntries(claims) },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("could not persist agents:", (e as Error).message);
  }
}

async function seedDirectory() {
  const sellerIds = Object.keys(SELLER_META);
  const sellerWallets = await loadAgentWallets(sellerIds);
  for (const sw of sellerWallets) {
    agents.push({
      id: sw.sellerId,
      name: sw.sellerId,
      role: "seller",
      skills: SELLER_META[sw.sellerId].skills,
      wallet: sw.wallet.address,
      reputation: reps.get(sw.sellerId) ?? { sellerId: sw.sellerId, jobs: 0, successes: 0, score: 0 },
      owner: HOUSE,
      serviceTypes: SELLER_META[sw.sellerId].types,
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
      owner: HOUSE,
    });
  }
  // restore user-registered agents (and their live strategies) from the last run
  if (existsSync(AGENTS_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(AGENTS_FILE, "utf8")) as
        | Agent[] // legacy shape
        | { agents: Agent[]; sellerConfigs: SellerAgentConfig[]; claims?: Record<string, string> };
      const saved = Array.isArray(raw) ? { agents: raw, sellerConfigs: [], claims: {} } : raw;
      for (const a of saved.agents) {
        if (!agents.some((x) => x.id === a.id)) agents.push({ ...a, owner: a.owner ?? "unknown" });
      }
      for (const cfg of saved.sellerConfigs ?? []) {
        sellerConfigs.set(cfg.id, cfg);
        addRegisteredSeller(cfg);
      }
      for (const [id, owner] of Object.entries(saved.claims ?? {})) {
        const a = agents.find((x) => x.id === id);
        if (a) {
          a.owner = normalizeOwner(owner);
          claims.set(id, a.owner);
        }
      }
    } catch (e) {
      console.error("could not restore agents.json:", (e as Error).message);
    }
  }
  console.log(`directory seeded: ${agents.length} agents (with real wallets)`);
}
seedDirectory().catch((e) => console.error("directory seed failed:", e.message));

// ---- views -------------------------------------------------------------------

const roundView = (rl: { round: number; leader: string; pushed: string[]; managerLine: string; scored: { offer: { sellerId: string; price: number; deliveryEst: number; pitch: string }; score: number; breakdown: unknown }[] }) => ({
  round: rl.round,
  leader: rl.leader,
  pushed: rl.pushed,
  managerLine: rl.managerLine,
  offers: rl.scored.map((sc) => ({
    sellerId: sc.offer.sellerId, price: sc.offer.price, deliveryEst: sc.offer.deliveryEst,
    pitch: sc.offer.pitch, score: sc.score, breakdown: sc.breakdown,
  })),
});

const settlementSummary = (settlementId?: string) => {
  const st = settlementId ? getSettlement(settlementId) : undefined;
  if (!st) return null;
  return {
    status: st.status,
    pass: st.pass,
    txUrl: st.steps.find((x) => x.key === "settle")?.txUrl ?? null,
    collected: st.steps.find((x) => x.key === "collect")?.state === "done",
  };
};

const sessionView = (s: MarketSession) => ({
  id: s.id,
  kind: s.kind,
  reputations: Object.fromEntries(getReputations()),
  buyer: { id: s.buyer.id, name: s.buyer.name, scripted: s.buyer.scripted },
  job: { id: s.buyer.job.id, type: s.buyer.job.type, task: s.buyer.job.task, budget: s.buyer.job.budget, priorities: s.buyer.job.priorities, requirements: s.buyer.job.requirements },
  status: s.status,
  phase: s.phase,
  phaseDetail: s.phaseDetail ?? null,
  bidders: s.bidders,
  error: s.error,
  winnerId: s.result?.winnerId ?? null,
  verdict: s.result?.verdict ?? null,
  deliverable: s.result?.deliverable ?? null,
  settlementId: s.settlementId ?? null,
  settlement: settlementSummary(s.settlementId),
  // while running, stream the live rounds; once done, serve the final record
  rounds: (s.result?.negotiation.rounds ?? s.liveRounds).map(roundView),
});

// ---- read endpoints ----------------------------------------------------------

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

/** Buyer roster with full job specs — powers the buyer desk. */
app.get("/api/buyers", (_req, res) => {
  res.json({
    buyers: BUYERS.map((b) => ({
      id: b.id,
      name: b.name,
      scripted: b.scripted,
      wallet: agents.find((a) => a.id === b.id)?.wallet ?? null,
      owner: agents.find((a) => a.id === b.id)?.owner ?? HOUSE,
      job: {
        id: b.job.id, type: b.job.type, task: b.job.task, budget: b.job.budget,
        priorities: b.job.priorities, requirements: b.job.requirements,
      },
    })),
  });
});

app.get("/api/markets", (_req, res) => {
  res.json({ sessions: listSessions("market").map(sessionView) });
});

app.get("/api/markets/:id", (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  return res.json(sessionView(s));
});

app.get("/api/settle/:id", (req, res) => {
  const s = getSettlement(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  return res.json(s);
});

/** Live stream — one snapshot per market mutation, no client polling needed. */
app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const sendMarkets = () => {
    res.write(`event: markets\ndata: ${JSON.stringify({ sessions: listSessions().map(sessionView) })}\n\n`);
  };
  sendMarkets(); // initial snapshot so a fresh client renders immediately
  bus.on("markets", sendMarkets);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    bus.off("markets", sendMarkets);
  });
});

// ---- mutating endpoints (rate-limited, optionally key-gated) -------------------

app.post("/api/register", requireKey, rateLimit(10), async (req, res) => {
  try {
    const { name, skills, wallet, role, owner, strategy } = req.body ?? {};
    if (typeof name !== "string" || typeof skills !== "string" || !name.trim() || !skills.trim()) {
      return res.status(400).json({ error: "name and skills required" });
    }
    if (name.length > 40) return res.status(400).json({ error: "name too long (max 40 chars)" });
    if (skills.length > 200) return res.status(400).json({ error: "skills too long (max 200 chars)" });
    if (typeof owner !== "string" || !/^[\w.-]{2,42}$/.test(owner.trim())) {
      return res.status(400).json({ error: "sign in first — owner identity required" });
    }
    if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(String(wallet))) {
      return res.status(400).json({ error: "wallet must be a 0x… address (40 hex chars)" });
    }
    if (agents.length >= MAX_AGENTS) return res.status(409).json({ error: "registry full" });

    const agentRole: Agent["role"] = role === "buyer" ? "buyer" : "seller";
    const id = name.replace(/\s+/g, "");
    if (!/^[\w.-]{1,40}$/.test(id)) return res.status(400).json({ error: "name must be letters, numbers, . _ or -" });
    if (agents.some((a) => a.id === id)) return res.status(409).json({ error: "agent id already registered" });

    // sellers register a live STRATEGY — this is what makes the agent actually bid
    let cfg: SellerAgentConfig | null = null;
    if (agentRole === "seller") {
      const s = strategy ?? {};
      const types = (Array.isArray(s.serviceTypes) ? s.serviceTypes : []).filter(
        (t: unknown): t is ServiceTypeStr => SERVICE_TYPES.includes(t as ServiceTypeStr),
      );
      const startPrice = Math.round(Number(s.startPrice));
      const floorPrice = Math.round(Number(s.floorPrice));
      const deliveryHours = Number(s.deliveryHours);
      if (types.length === 0) return res.status(400).json({ error: "pick at least one service type (landing / sql / data)" });
      if (!Number.isFinite(startPrice) || startPrice < 10 || startPrice > 10_000) {
        return res.status(400).json({ error: "start price must be $10–$10,000" });
      }
      if (!Number.isFinite(floorPrice) || floorPrice < 10 || floorPrice > startPrice) {
        return res.status(400).json({ error: "floor price must be $10 or more and not above the start price" });
      }
      if (!Number.isFinite(deliveryHours) || deliveryHours < 0.5 || deliveryHours > 72) {
        return res.status(400).json({ error: "delivery must be 0.5–72 hours" });
      }
      const personality =
        typeof s.personality === "string" && s.personality.trim()
          ? s.personality.trim().slice(0, 200)
          : `Professional specialist in ${skills.trim()}. Negotiates firmly but concedes under pressure.`;
      cfg = {
        id,
        skills: skills.trim(),
        personality,
        serviceTypes: types,
        startPrice,
        floorPrice,
        startDelivery: deliveryHours,
        bestDelivery: Math.max(0.5, Math.round(deliveryHours * 0.7 * 10) / 10),
        concession: 0.45,
      };
    }

    // no wallet supplied -> mint a REAL persistent wallet for this agent
    const realWallet = wallet || (await loadAgentWallets([id]))[0].wallet.address;
    const agent: Agent = {
      id,
      name: name.trim(),
      role: agentRole,
      skills: skills.trim(),
      wallet: realWallet,
      reputation: { sellerId: id, jobs: 0, successes: 0, score: 0 },
      owner: normalizeOwner(owner.trim()),
      ...(cfg ? { serviceTypes: cfg.serviceTypes } : {}),
    };
    agents.push(agent);
    if (cfg) {
      sellerConfigs.set(cfg.id, cfg);
      addRegisteredSeller(cfg); // joins the pool — bids in the NEXT market that opens
    }
    saveRegisteredAgents();
    return res.json({ agent, joinsPool: !!cfg });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** Assign an unowned (house) agent — buyer or seller — to an account. */
app.post("/api/agents/:id/assign", requireKey, rateLimit(20), (req, res) => {
  const owner = normalizeOwner(String(req.body?.owner ?? "").trim());
  if (!/^[\w.-]{2,42}$/.test(owner)) return res.status(400).json({ error: "owner identity required" });
  const agent = agents.find((a) => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "agent not found" });
  if (agent.owner !== HOUSE && agent.owner !== owner) {
    return res.status(409).json({ error: `already owned by @${agent.owner}` });
  }
  agent.owner = owner;
  claims.set(agent.id, owner);
  saveRegisteredAgents();
  return res.json({ agent });
});

app.post("/api/markets/open", requireKey, rateLimit(6), (_req, res) => {
  if (listSessions("market").some((s) => s.status === "running")) {
    return res.status(409).json({ error: "markets are already running" });
  }
  return res.json({
    sessions: openAllMarkets().map(sessionView),
    buyers: BUYERS.map((b) => ({ id: b.id, name: b.name, scripted: b.scripted })),
  });
});

/** Open ONE buyer's market from the buyer desk. */
app.post("/api/markets/open-one", requireKey, rateLimit(12), (req, res) => {
  const buyerId = String(req.body?.buyerId ?? "");
  if (!BUYERS.some((b) => b.id === buyerId)) return res.status(404).json({ error: "unknown buyer agent" });
  if (listSessions("market").some((s) => s.buyer.id === buyerId && s.status === "running")) {
    return res.status(409).json({ error: "this buyer's market is already running" });
  }
  return res.json({ session: sessionView(openMarketFor(buyerId)!) });
});

app.post("/api/floor/open", requireKey, rateLimit(6), (req, res) => {
  const jobType = req.body?.jobType === "sql" ? "sql" : "landing";
  if (listSessions("floor").some((s) => s.status === "running")) {
    return res.status(409).json({ error: "a floor market is already running" });
  }
  return res.json({ session: sessionView(openFloorMarket(jobType)) });
});

/**
 * Settle a finished session on-chain. Everything is derived server-side from
 * the session record — the client only says WHICH market to settle.
 */
app.post("/api/settle", requireKey, rateLimit(6), (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId ?? "");
    const s = sessionId ? getSession(sessionId) : undefined;
    if (!s) return res.status(404).json({ error: "session not found" });
    if (s.status !== "done" || !s.result) return res.status(409).json({ error: "market not finished — nothing to settle" });

    // idempotent: a session settles once; repeat calls return the same settlement.
    // Exception: an ERRORED settlement (e.g. RPC timeout) may be retried.
    if (s.settlementId) {
      const existing = getSettlement(s.settlementId);
      if (existing && existing.status !== "error") return res.json(existing);
    }

    const finalRound = s.result.negotiation.rounds.at(-1);
    const winnerOffer = finalRound?.scored.find((sc) => sc.offer.sellerId === s.result!.winnerId)?.offer;
    const settlement = startSettlement({
      jobId: s.buyer.job.id,
      winnerId: s.result.winnerId,
      sellerIds: s.bidders,
      winnerPrice: winnerOffer?.price ?? s.buyer.job.budget,
      budget: s.buyer.job.budget,
      pass: s.result.verdict.pass,
      score: Math.max(0, Math.min(10, Math.round(s.result.verdict.score))),
      buyer: { id: s.buyer.id, wallet: s.buyer.wallet },
    });
    s.settlementId = settlement.id;
    return res.json(settlement);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`Handshake API → http://localhost:${PORT}`);
  console.log(`  CORS origins: ${ORIGINS.join(", ")}`);
  console.log(`  API key: ${API_KEY ? "required on mutating routes" : "off (set API_KEY in .env to enable)"}`);
});
