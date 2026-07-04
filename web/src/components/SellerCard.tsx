import { Star, Clock, ArrowUpRight } from "lucide-react";
import type { RoundOffer, Reputation } from "../types";
import { card, cn, subtle, label, mono } from "../lib/ui";

export function SellerCard({
  offer,
  reputation,
  isLeader,
  rank,
}: {
  offer: RoundOffer;
  reputation?: Reputation;
  isLeader: boolean;
  rank: number;
}) {
  const rep = reputation;

  return (
    <div
      className={cn(
        card,
        "relative flex flex-col gap-4 p-5 transition duration-200",
        isLeader
          ? "border-brand/50 dark:border-brand/40 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-brand)_10%,transparent)]"
          : "opacity-[0.92]",
      )}
    >
      {isLeader && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          <ArrowUpRight size={11} strokeWidth={2.6} /> Leading
        </span>
      )}

      {/* identity row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-neutral-900">
            {offer.sellerId.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{offer.sellerId}</div>
            <div className={cn(mono, "text-[10px]", subtle)}>RANK {rank}</div>
          </div>
        </div>
        {rep && rep.jobs > 0 ? (
          <div className="text-right leading-tight">
            <div className="inline-flex items-center gap-1 text-sm font-semibold">
              <Star size={12} className="fill-brand text-brand" />
              <span className={mono}>{rep.score.toFixed(1)}</span>
            </div>
            <div className={cn(mono, "text-[10px]", subtle)}>
              {rep.successes}/{rep.jobs} jobs
            </div>
          </div>
        ) : (
          <span className={cn(mono, "rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] dark:border-white/10", subtle)}>
            NEW
          </span>
        )}
      </div>

      {/* the numbers — flash on change, like a terminal tick */}
      <div className="flex items-end justify-between">
        <div>
          <div className={label}>Bid</div>
          <div key={offer.price} className={cn(mono, "hs-flash -mx-1 px-1 text-[26px] font-semibold leading-tight tracking-tight")}>
            ${offer.price}
          </div>
        </div>
        <div className="text-right">
          <div className={label}>Delivery</div>
          <div key={offer.deliveryEst} className={cn(mono, "hs-flash -mx-1 inline-flex items-center gap-1 px-1 text-sm font-medium")}>
            <Clock size={12} strokeWidth={2.2} className={cn(subtle)} />
            {offer.deliveryEst}h
          </div>
        </div>
      </div>

      {/* buyer's score for this offer */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className={label}>Buyer score</span>
          <span className={cn(mono, "text-sm font-semibold")}>{offer.score.toFixed(1)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200/70 dark:bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.min(100, offer.score)}%`, transitionTimingFunction: "var(--ease)" }}
          />
        </div>
        <div className={cn(mono, "mt-1.5 grid grid-cols-3 text-[10px]", subtle)}>
          <span>Q {Math.round(offer.breakdown.quality * 100)}</span>
          <span className="text-center">P {Math.round(offer.breakdown.price * 100)}</span>
          <span className="text-right">S {Math.round(offer.breakdown.speed * 100)}</span>
        </div>
      </div>

      <p className={cn("border-t border-neutral-200/70 pt-3 text-xs leading-relaxed dark:border-white/[0.07]", subtle)}>
        “{offer.pitch}”
      </p>
    </div>
  );
}
