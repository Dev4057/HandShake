import { Star, Clock, Trophy } from "lucide-react";
import type { RoundOffer, Reputation } from "../types";
import { card, cn, subtle, starCount } from "../lib/ui";

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
  const stars = starCount(reputation?.score ?? 5);

  return (
    <div
      className={cn(
        card,
        "hs-rise relative flex flex-col gap-4 p-5 transition",
        isLeader && "ring-2 ring-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand)_12%,transparent)]",
      )}
    >
      {isLeader && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
          <Trophy size={11} strokeWidth={2.4} /> Leading
        </span>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
              {offer.sellerId.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight">{offer.sellerId}</div>
              <div className={cn("font-mono text-[11px]", subtle)}>#{rank}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              strokeWidth={2}
              className={i < stars ? "fill-brand text-brand" : "text-neutral-300 dark:text-white/15"}
            />
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={cn("text-[11px] uppercase tracking-wide", subtle)}>Bid</div>
          <div className="font-mono text-2xl font-semibold tabular tracking-tight">${offer.price}</div>
        </div>
        <div className={cn("inline-flex items-center gap-1.5 text-sm", subtle)}>
          <Clock size={14} strokeWidth={2.2} />
          <span className="font-mono tabular">{offer.deliveryEst}h</span>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className={subtle}>Score</span>
          <span className="font-mono font-semibold tabular">{offer.score.toFixed(1)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.min(100, offer.score)}%` }}
          />
        </div>
        <div className={cn("mt-1.5 flex gap-3 font-mono text-[10px]", subtle)}>
          <span>Q {Math.round(offer.breakdown.quality * 100)}</span>
          <span>P {Math.round(offer.breakdown.price * 100)}</span>
          <span>S {Math.round(offer.breakdown.speed * 100)}</span>
        </div>
      </div>

      <p className={cn("border-t border-neutral-200/70 pt-3 text-xs italic dark:border-white/10", subtle)}>
        “{offer.pitch}”
      </p>
    </div>
  );
}
