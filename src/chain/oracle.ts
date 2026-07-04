/**
 * DataOracle client — the paid data shop.
 *  buyData(wallet):   seller pays the fee on-chain, gets the value + a receipt tx.
 *  verifyReceipt(tx): buyer independently checks the receipt — who bought, what value.
 */
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { getProvider, txUrl } from "../chain.js";

const dep = JSON.parse(readFileSync(new URL("../../deployments.oracle.json", import.meta.url), "utf8")) as {
  address: string;
  feeWei: string;
};

const ABI = [
  "function fee() view returns (uint256)",
  "function purchase() payable returns (uint256)",
  "event DataPurchased(address indexed buyer, uint256 value, uint256 paid)",
];

export const oracleAddress = () => dep.address;

export interface DataPurchase {
  valueCents: number;
  txHash: string;
  txUrl: string;
}

/** Seller-side: pay the fee, read the value from the receipt event. */
export async function buyData(wallet: ethers.Wallet): Promise<DataPurchase> {
  const oracle = new ethers.Contract(dep.address, ABI, wallet);
  const est = await oracle.purchase.estimateGas({ value: BigInt(dep.feeWei) });
  const tx = await oracle.purchase({ value: BigInt(dep.feeWei), gasLimit: est + est / 10n });
  const receipt = await tx.wait();
  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "DataPurchased") {
        return { valueCents: Number(parsed.args.value), txHash: tx.hash, txUrl: txUrl(tx.hash) };
      }
    } catch { /* not our event */ }
  }
  throw new Error("purchase succeeded but no DataPurchased receipt found");
}

export interface ReceiptCheck {
  ok: boolean;
  buyer?: string;
  valueCents?: number;
  reason?: string;
}

/** Buyer-side provenance check: does the cited receipt exist, and what did it say? */
export async function verifyReceipt(txHash: string): Promise<ReceiptCheck> {
  const provider = await getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { ok: false, reason: "receipt tx not found on-chain" };
  if (receipt.to?.toLowerCase() !== dep.address.toLowerCase())
    return { ok: false, reason: "tx was not sent to the DataOracle" };
  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "DataPurchased") {
        return { ok: true, buyer: String(parsed.args.buyer), valueCents: Number(parsed.args.value) };
      }
    } catch { /* not our event */ }
  }
  return { ok: false, reason: "no DataPurchased event in tx" };
}
