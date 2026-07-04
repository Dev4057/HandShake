/**
 * Registered seller agents — user-created agents that join the LIVE pool.
 *
 * Registration stores a full SellerAgentConfig (strategy: prices, delivery,
 * service types, personality). Every new market builds fresh SellerAgent
 * instances from these configs, so registered agents genuinely bid, negotiate,
 * deliver, and earn on-chain reputation alongside the built-in roster.
 */
import type { SellerAgentConfig } from "../sellers/sellerAgent.js";

const registered = new Map<string, SellerAgentConfig>();

export const listRegisteredSellerConfigs = (): SellerAgentConfig[] => [...registered.values()];

export function addRegisteredSeller(cfg: SellerAgentConfig): void {
  registered.set(cfg.id, cfg);
}
