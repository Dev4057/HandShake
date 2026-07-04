/**
 * Seller wallet manager — gives each seller agent its OWN on-chain identity.
 *
 * Wallets are generated once, persisted to seller-wallets.json (git-ignored),
 * and re-used across runs so reputation accrues to a stable address per agent.
 * The main (buyer) wallet auto-tops-up any seller wallet that is low on gas,
 * so bonds are genuinely posted from three distinct addresses.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ethers } from "ethers";
import { getProvider } from "../chain.js";
import { signer } from "./escrow.js";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seller-wallets.json");

/**
 * Monad testnet runs ~100-200 gwei fees, so a single bond tx can cost ~0.025 MON
 * in gas headroom. Fund generously (it's testnet MON) so bonds never bounce.
 * Buyers need more than sellers: budget lock + openJob gas + settle gas.
 */
const MIN_BALANCE = ethers.parseEther("0.05");
const TOP_UP_TO = ethers.parseEther("0.1");

export interface FundOpts {
  minBalance?: bigint;
  topUpTo?: bigint;
}

export const BUYER_FUNDING: FundOpts = {
  minBalance: ethers.parseEther("0.1"),
  topUpTo: ethers.parseEther("0.2"),
};

export interface SellerWallet {
  sellerId: string;
  wallet: ethers.Wallet;
}

/** Load (or create on first run) one persistent wallet per seller id. */
export async function loadSellerWallets(sellerIds: string[]): Promise<SellerWallet[]> {
  const p = await getProvider();
  let store: Record<string, string> = {};
  if (existsSync(FILE)) {
    store = JSON.parse(readFileSync(FILE, "utf8"));
  }
  let dirty = false;
  for (const id of sellerIds) {
    if (!store[id]) {
      store[id] = ethers.Wallet.createRandom().privateKey;
      dirty = true;
    }
  }
  if (dirty) writeFileSync(FILE, JSON.stringify(store, null, 2));
  return sellerIds.map((sellerId) => ({
    sellerId,
    wallet: new ethers.Wallet(store[sellerId], p),
  }));
}

/**
 * Top up any seller wallet that can't afford a bond + gas.
 * Sequential sends from the buyer wallet (clean nonce ordering).
 * Returns the tx hashes of any funding transfers made.
 */
export async function fundSellerWallets(
  agents: SellerWallet[],
  opts: FundOpts = {},
): Promise<{ sellerId: string; txHash: string }[]> {
  const min = opts.minBalance ?? MIN_BALANCE;
  const target = opts.topUpTo ?? TOP_UP_TO;
  const master = await signer();
  const funded: { sellerId: string; txHash: string }[] = [];
  for (const a of agents) {
    const bal = await a.wallet.provider!.getBalance(a.wallet.address);
    if (bal < min) {
      // Monad charges gas_limit (not gas used) — hardcode 21000 for plain transfers
      const tx = await master.sendTransaction({ to: a.wallet.address, value: target - bal, gasLimit: 21_000n });
      await tx.wait();
      funded.push({ sellerId: a.sellerId, txHash: tx.hash });
    }
  }
  if (funded.length > 0) {
    // Monad reserve rule: low-balance accounts' gas budget uses the LAGGED state
    // (3 blocks back). A wallet that spends immediately after funding gets
    // rejected — give the lagged state time to catch up.
    await new Promise((r) => setTimeout(r, 4_000));
  }
  return funded;
}

/** Buyers and sellers share the same persistent id->wallet store. */
export const loadAgentWallets = loadSellerWallets;
