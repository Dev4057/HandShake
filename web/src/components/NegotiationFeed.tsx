import { MessageSquareText } from "lucide-react";
import type { Round } from "../types";
import { card, cn, subtle } from "../lib/ui";

export function NegotiationFeed({ rounds, totalRounds }: { rounds: Round[]; totalRounds: number }) {
  return (
    <div className={cn(card, "flex h-full flex-col p-5")}>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquareText size={16} strokeWidth={2.2} className="text-brand" />
        <h3 className="text-sm font-semibold">Negotiation Feed</h3>
        <span className={cn("ml-auto font-mono text-xs tabular", subtle)}>
          {rounds.length}/{totalRounds}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {rounds.length === 0 && (
          <p className={cn("text-sm", subtle)}>The buyer agent will narrate each round here as it negotiates.</p>
        )}
        {rounds.map((r, i) => {
          const latest = i === rounds.length - 1;
          return (
            <div key={r.round} className="hs-rise flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-bold",
                    latest ? "bg-brand text-white" : "bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
                  )}
                >
                  {r.round}
                </span>
                {i < rounds.length - 1 && <span className="my-1 w-px flex-1 bg-neutral-200 dark:bg-white/10" />}
              </div>
              <div className="pb-1">
                <div className={cn("mb-0.5 text-[11px] uppercase tracking-wide", subtle)}>
                  Round {r.round} · leader {r.leader}
                </div>
                <p className="text-sm leading-relaxed">{r.managerLine}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
