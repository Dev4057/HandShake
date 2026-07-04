/**
 * MockSeller — deterministic stand-in seller implementing the same Seller
 * interface as the real SellerAgent. Zero AI, zero cost, fully predictable:
 * used for tests, AI-off demos, and as the control group.
 */
import type { JobSpec, Offer, Deliverable } from "../types.js";
import type { Seller, MarketSignal } from "./seller.js";
import { GOOD_SQL, BAD_SQL, GOOD_LANDING, BAD_LANDING } from "./canned.js";

export interface MockSellerConfig {
  id: string;
  serviceTypes?: import("../types.js").ServiceType[]; // defaults to all
  startPrice: number;
  floorPrice: number;
  startDelivery: number; // hours
  floorDelivery: number;
  concession: number; // 0-1: how far toward the floor it moves when pushed
  pitch: string;
  delivers?: "good" | "bad"; // quality of work this seller produces if it wins
}

export class MockSeller implements Seller {
  readonly cfg: MockSellerConfig;
  readonly id: string;
  private price: number;
  private delivery: number;

  constructor(cfg: MockSellerConfig) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.price = cfg.startPrice;
    this.delivery = cfg.startDelivery;
  }

  bids(job: JobSpec): boolean {
    return !this.cfg.serviceTypes || this.cfg.serviceTypes.includes(job.type);
  }

  /** Concede toward the floor whenever the buyer pushes. */
  async makeOffer(job: JobSpec, signal: MarketSignal): Promise<Offer> {
    if (signal.pushed) {
      this.price = Math.max(
        this.cfg.floorPrice,
        Math.round(this.price - (this.price - this.cfg.floorPrice) * this.cfg.concession),
      );
      this.delivery = Math.max(
        this.cfg.floorDelivery,
        Math.round((this.delivery - (this.delivery - this.cfg.floorDelivery) * this.cfg.concession) * 10) / 10,
      );
    }
    return {
      sellerId: this.id,
      jobId: job.id,
      price: this.price,
      deliveryEst: this.delivery,
      pitch: this.cfg.pitch,
    };
  }

  async deliver(job: JobSpec): Promise<Deliverable> {
    const good = (this.cfg.delivers ?? "good") === "good";
    const content = job.type === "sql" ? (good ? GOOD_SQL : BAD_SQL) : good ? GOOD_LANDING : BAD_LANDING;
    return { jobId: job.id, sellerId: this.id, content };
  }
}
