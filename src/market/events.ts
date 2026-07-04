/**
 * In-process event bus — the live wire between the market engine and the API's
 * SSE stream. Sessions emit "markets" whenever any session mutates (new round,
 * phase change, verdict, error); settlement emits "settled" once a winner's
 * on-chain reputation is final so the scoring map can absorb it.
 */
import { EventEmitter } from "node:events";
import type { OnChainRep } from "../chain/escrow.js";

export const bus = new EventEmitter();
bus.setMaxListeners(200); // one listener pair per connected SSE client

let pending: ReturnType<typeof setTimeout> | null = null;

/** Debounced — concurrent sessions mutate in bursts; clients need one snapshot. */
export function emitMarketsChanged(): void {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    bus.emit("markets");
  }, 120);
}

export function emitSettled(sellerId: string, rep: OnChainRep): void {
  bus.emit("settled", { sellerId, rep });
}
