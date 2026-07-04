/**
 * Buyer's on-chain settlement layer — thin ethers.js wrapper over HandshakeEscrow.
 * Reads the deployed address from deployments.json (so a redeploy needs no code change).
 */
import "dotenv/config";
import process from "node:process";
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { getProvider, txUrl } from "../chain.js";

const deployment = JSON.parse(readFileSync(new URL("../../deployments.json", import.meta.url), "utf8")) as {
  address: string;
};

const ABI = [
  // HandshakeEscrowV2: openJob takes a deadline; payouts are pull-based (withdraw)
  "function openJob(bytes32 jobId, uint64 deadline) payable",
  "function postBond(bytes32 jobId) payable",
  "function settle(bytes32 jobId, address winner, uint256 winnerPrice, bool pass, uint8 score)",
  "function reclaimBond(bytes32 jobId)",
  "function cancelJob(bytes32 jobId)",
  "function withdraw()",
  "function withdrawable(address) view returns (uint256)",
  "function getJob(bytes32 jobId) view returns (address buyer, uint256 budget, uint64 deadline, bool exists, bool settled, uint256 bonderCount)",
  "function bondOf(bytes32 jobId, address seller) view returns (uint256)",
  "function reputation(address) view returns (uint256 jobsWon, uint256 jobsPassed, uint256 scoreSum)",
];

/** Default job lifetime: after this, sellers reclaim bonds and the buyer can cancel. */
export const JOB_TTL_SECONDS = 24 * 60 * 60;

export const defaultDeadline = () => BigInt(Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS);

export async function signer(): Promise<ethers.Wallet> {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set in .env");
  return new ethers.Wallet(pk, await getProvider());
}

export function escrow(runner: ethers.Signer | ethers.Provider): ethers.Contract {
  return new ethers.Contract(deployment.address, ABI, runner);
}

/** bytes32 job id from our string job id. */
export const jobIdOf = (id: string): string => ethers.id(id);

export const escrowAddress = () => deployment.address;

export async function openJob(id: string, budgetEth: string, deadline: bigint = defaultDeadline()): Promise<string> {
  const tx = await escrow(await signer()).openJob(jobIdOf(id), deadline, { value: ethers.parseEther(budgetEth) });
  await tx.wait();
  return tx.hash;
}

/** Pull this wallet's accumulated payouts (V2 credits instead of pushing funds). */
export async function withdrawPayout(wallet: ethers.Wallet): Promise<string | null> {
  const esc = escrow(wallet);
  const owed: bigint = await esc.withdrawable(wallet.address);
  if (owed === 0n) return null;
  const tx = await esc.withdraw();
  await tx.wait();
  return tx.hash;
}

export async function postBond(id: string, bondEth: string): Promise<string> {
  const tx = await escrow(await signer()).postBond(jobIdOf(id), { value: ethers.parseEther(bondEth) });
  await tx.wait();
  return tx.hash;
}

export async function settle(
  id: string,
  winner: string,
  priceEth: string,
  pass: boolean,
  score: number,
): Promise<string> {
  const tx = await escrow(await signer()).settle(jobIdOf(id), winner, ethers.parseEther(priceEth), pass, score);
  await tx.wait();
  return tx.hash;
}

export interface OnChainRep {
  jobsWon: number;
  jobsPassed: number;
  avgScore: number;
}

export async function reputationOf(addr: string): Promise<OnChainRep> {
  const [won, passed, scoreSum] = await escrow(await getProvider()).reputation(addr);
  const jobsWon = Number(won);
  return {
    jobsWon,
    jobsPassed: Number(passed),
    avgScore: jobsWon === 0 ? 0 : Number(scoreSum) / jobsWon,
  };
}

export { txUrl };
