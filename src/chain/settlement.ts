/**
 * Settlement engine — runs the full on-chain sequence for a finished market and
 * records progress step-by-step so the UI can render each transaction live:
 *
 *   fund sellers → openJob (buyer locks budget) → postBond ×N (each seller's OWN
 *   wallet) → settle (pay/slash + reputation) → read reputation back.
 *
 * Kicked off via startSettlement(); the UI polls getSettlement(id) as steps land.
 */
import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { escrow, signer, jobIdOf, reputationOf, escrowAddress, defaultDeadline, withdrawPayout, type OnChainRep } from "./escrow.js";
import { loadSellerWallets, fundSellerWallets, BUYER_FUNDING, type SellerWallet } from "./wallets.js";
import { txUrl, addrUrl, resetProvider } from "../chain.js";
import { emitSettled, emitMarketsChanged } from "../market/events.js";

/** Tiny real amounts — the $ figures in the market are display units. */
const BUDGET = ethers.parseEther("0.01");
const BOND = ethers.parseEther("0.002");

export type StepState = "pending" | "running" | "done" | "error";

export interface SettlementStep {
  key: string;
  label: string;
  state: StepState;
  txHash?: string;
  txUrl?: string;
  detail?: string;
}

export interface Settlement {
  id: string;
  status: "running" | "done" | "error";
  escrow: string;
  escrowUrl: string;
  buyerId?: string;
  buyerAddress?: string;
  buyerAddressUrl?: string;
  winnerId: string;
  winnerAddress?: string;
  winnerAddressUrl?: string;
  pass: boolean;
  steps: SettlementStep[];
  reputationBefore?: OnChainRep;
  reputationAfter?: OnChainRep;
  error?: string;
}

const settlements = new Map<string, Settlement>();

export function getSettlement(id: string): Settlement | undefined {
  return settlements.get(id);
}

export interface SettleRequest {
  jobId: string;      // market job id (made unique per settlement internally)
  winnerId: string;   // seller agent id, e.g. "PixelPro"
  sellerIds: string[];
  winnerPrice: number; // display units
  budget: number;      // display units
  pass: boolean;
  score: number;       // 0-10
  /** Which buyer settles this market. "master" uses the main wallet;
   *  "own" gives this buyer its own auto-funded wallet (distinct address). */
  buyer?: { id: string; wallet: "master" | "own" };
}

export function startSettlement(req: SettleRequest): Settlement {
  const id = randomUUID();
  const s: Settlement = {
    id,
    status: "running",
    escrow: escrowAddress(),
    escrowUrl: addrUrl(escrowAddress()),
    winnerId: req.winnerId,
    pass: req.pass,
    steps: [
      { key: "fund", label: "Fund seller wallets", state: "pending" },
      { key: "open", label: "Buyer locks budget in escrow", state: "pending" },
      ...req.sellerIds.map((sid) => ({
        key: `bond:${sid}`,
        label: `${sid} stakes bond`,
        state: "pending" as StepState,
      })),
      {
        key: "settle",
        label: req.pass ? "Settle — pay winner, return bonds" : "Settle — refund buyer, slash bond to treasury",
        state: "pending",
      },
      { key: "collect", label: "Collect payouts (pull payments)", state: "pending" },
      { key: "rep", label: "Read reputation from chain", state: "pending" },
    ],
  };
  settlements.set(id, s);
  emitMarketsChanged(); // both sides see "settlement in progress" immediately
  run(s, req).catch((e) => {
    s.status = "error";
    s.error = (e as Error).message;
    const running = s.steps.find((st) => st.state === "running");
    if (running) running.state = "error";
    // the endpoint may have gone bad mid-run — a retry starts from a fresh probe
    resetProvider();
    emitMarketsChanged();
  });
  return s;
}

function step(s: Settlement, key: string): SettlementStep {
  return s.steps.find((st) => st.key === key)!;
}

/**
 * Monad charges gas_limit × price (not gas used), so we estimate and add only a
 * 10% buffer instead of letting ethers over-pad the limit. (monskills: gas)
 */
async function tightGas(est: bigint): Promise<{ gasLimit: bigint }> {
  return { gasLimit: est + est / 10n };
}

/**
 * Retries with a pause — absorbs Monad's lagged-balance races on freshly
 * funded low-balance wallets ("Signer had insufficient balance") and
 * transient RPC timeouts.
 */
async function withRetry<T>(send: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await send();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 4_000));
    }
  }
  throw lastErr;
}

async function run(s: Settlement, req: SettleRequest): Promise<void> {
  // unique on-chain job id per settlement so repeat demos never collide
  const chainJobId = jobIdOf(`${req.jobId}-${s.id.slice(0, 8)}`);

  // resolve the settling buyer: master wallet, or this buyer's own wallet
  let buyer: ethers.Wallet;
  const ownWallet = req.buyer && req.buyer.wallet === "own";
  if (ownWallet) {
    const [bw] = await loadSellerWallets([req.buyer!.id]);
    buyer = bw.wallet;
  } else {
    buyer = await signer();
  }
  s.buyerId = req.buyer?.id ?? "master";
  s.buyerAddress = buyer.address;
  s.buyerAddressUrl = addrUrl(buyer.address);

  const sellers = await loadSellerWallets(req.sellerIds);
  const winner = sellers.find((w) => w.sellerId === req.winnerId)!;
  s.winnerAddress = winner.wallet.address;
  s.winnerAddressUrl = addrUrl(winner.wallet.address);
  // best-effort: a slow RPC read must never abort a settlement
  s.reputationBefore = await withRetry(() => reputationOf(winner.wallet.address), 2).catch(() => undefined);

  // 1. fund seller wallets that are low (+ the buyer's own wallet, more generously)
  const fund = step(s, "fund");
  fund.state = "running";
  const funded = await fundSellerWallets(sellers);
  if (ownWallet) {
    const buyerFunded = await fundSellerWallets(
      [{ sellerId: req.buyer!.id, wallet: buyer }],
      BUYER_FUNDING,
    );
    funded.push(...buyerFunded);
  }
  fund.state = "done";
  fund.detail = funded.length
    ? `topped up ${funded.map((f) => f.sellerId).join(", ")}`
    : "all wallets already funded";
  if (funded[0]) {
    fund.txHash = funded[0].txHash;
    fund.txUrl = txUrl(funded[0].txHash);
  }

  // 2. buyer locks the budget (with a deadline — funds can never be stuck forever)
  const open = step(s, "open");
  open.state = "running";
  const buyerEscrow = escrow(buyer);
  const deadline = defaultDeadline();
  const openTx = await withRetry(async () => {
    const est = await buyerEscrow.openJob.estimateGas(chainJobId, deadline, { value: BUDGET });
    const tx = await buyerEscrow.openJob(chainJobId, deadline, { value: BUDGET, ...(await tightGas(est)) });
    await tx.wait();
    return tx;
  });
  open.state = "done";
  open.txHash = openTx.hash;
  open.txUrl = txUrl(openTx.hash);

  // 3. every seller stakes a bond from its OWN wallet
  for (const sw of sellers) {
    const b = step(s, `bond:${sw.sellerId}`);
    b.state = "running";
    const sellerEscrow = escrow(sw.wallet);
    const tx = await withRetry(async () => {
      const est = await sellerEscrow.postBond.estimateGas(chainJobId, { value: BOND });
      const t = await sellerEscrow.postBond(chainJobId, { value: BOND, ...(await tightGas(est)) });
      await t.wait();
      return t;
    });
    b.state = "done";
    b.txHash = tx.hash;
    b.txUrl = txUrl(tx.hash);
    b.detail = sw.wallet.address;
  }

  // 4. settle — winner price proportional to the negotiated deal
  const settleStep = step(s, "settle");
  settleStep.state = "running";
  const ratio = Math.min(1, req.winnerPrice / req.budget);
  const priceWei = (BUDGET * BigInt(Math.round(ratio * 1000))) / 1000n;
  const tx = await withRetry(async () => {
    const est = await buyerEscrow.settle.estimateGas(chainJobId, winner.wallet.address, priceWei, req.pass, req.score);
    const t = await buyerEscrow.settle(chainJobId, winner.wallet.address, priceWei, req.pass, req.score, await tightGas(est));
    await t.wait();
    return t;
  });
  settleStep.state = "done";
  settleStep.txHash = tx.hash;
  settleStep.txUrl = txUrl(tx.hash);
  emitMarketsChanged(); // the on-chain verdict is final — notify both sides

  // 5. pull payments: every participant withdraws its credited payout
  const collect = step(s, "collect");
  collect.state = "running";
  const participants = new Map<string, ethers.Wallet>([[buyer.address, buyer]]);
  for (const sw of sellers) participants.set(sw.wallet.address, sw.wallet);
  let collected = 0;
  let lastTx: string | null = null;
  for (const w of participants.values()) {
    const hash = await withRetry(() => withdrawPayout(w));
    if (hash) {
      collected++;
      lastTx = hash;
    }
  }
  collect.state = "done";
  collect.detail = collected ? `${collected} wallet(s) withdrew` : "nothing owed";
  if (lastTx) {
    collect.txHash = lastTx;
    collect.txUrl = txUrl(lastTx);
  }

  // 6. read reputation back (best-effort — the money already moved)
  const rep = step(s, "rep");
  rep.state = "running";
  s.reputationAfter = await withRetry(() => reputationOf(winner.wallet.address), 2).catch(() => undefined);
  rep.state = "done";
  rep.detail = s.reputationAfter
    ? `won ${s.reputationAfter.jobsWon} · passed ${s.reputationAfter.jobsPassed} · avg ${s.reputationAfter.avgScore.toFixed(1)}`
    : "rep read unavailable (RPC) — settlement itself succeeded";

  s.status = "done";
  // feed the fresh on-chain record back into the live scoring map
  if (s.reputationAfter) emitSettled(req.winnerId, s.reputationAfter);
  emitMarketsChanged(); // payment collected — the seller side gets the news live
}
