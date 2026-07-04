import { Radio } from "lucide-react";
import type { Round } from "../types";
import { card, cn, subtle, label, mono } from "../lib/ui";

export function NegotiationFeed({
  rounds,
  totalRounds,
  live = false,
}: {
  rounds: Round[];
  totalRounds: number;
  live?: boolean;
}) {
  return (
    <div className={cn(card, "flex h-full flex-col p-5")}>
      <div className="mb-4 flex items-center gap-2">
        <Radio size={15} strokeWidth={2.2} className="text-brand" />
        <h3 className="text-sm font-semibold">Negotiation log</h3>
        <span className={cn(mono, "ml-auto text-[11px]", subtle)}>
          ROUND {rounds.length}/{totalRounds}
        </span>
      </div>

      <div className="flex flex-col">
        {rounds.length === 0 && (
          <p className={cn("text-sm leading-relaxed", subtle)}>
            The buyer agent narrates each round here — who leads, who gets pushed, and why.
          </p>
        )}
        {rounds.map((r, i) => {
          const latest = i === rounds.length - 1;
          return (
            <div key={r.round} className="hs-rise flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    mono,
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                    latest
                      ? "bg-brand text-white"
                      : "border border-neutral-200 text-neutral-500 dark:border-white/10 dark:text-neutral-400",
                  )}
                >
                  {r.round}
                </span>
                {i < rounds.length - 1 && <span className="my-1 w-px flex-1 bg-neutral-200 dark:bg-white/[0.08]" />}
              </div>
              <div className={cn("min-w-0 pb-4", i === rounds.length - 1 && "pb-0")}>
                <div className={cn(label, "mb-1")}>
                  R{r.round} · LEADER <span className="text-brand-strong dark:text-brand-soft">{r.leader.toUpperCase()}</span>
                  {r.pushed.length > 0 && <> · PUSHING {r.pushed.map((p) => p.toUpperCase()).join(", ")}</>}
                </div>
                <p className="text-sm leading-relaxed">
                  {r.managerLine}
                  {latest && live && <span className="hs-blink ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 bg-brand" />}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
