import { useEffect, useState } from "react";
import { Play, RotateCcw, Wallet, Target, Loader2, LayoutTemplate, Database } from "lucide-react";
import type { MarketRun } from "../types";
import { runMarket, getChain } from "../api";
import { SellerCard } from "./SellerCard";
import { NegotiationFeed } from "./NegotiationFeed";
import { SettlementPanel } from "./SettlementPanel";
import { PriorityBars } from "./PriorityBars";
import { card, cn, subtle, btnPrimary, btnGhost } from "../lib/ui";

type Status = "idle" | "loading" | "running" | "done";

export function TradingFloor() {
  const [jobType, setJobType] = useState<"landing" | "sql">("landing");
  const [status, setStatus] = useState<Status>("idle");
  const [run, setRun] = useState<MarketRun | null>(null);
  const [visible, setVisible] = useState(0);
  const [chain, setChain] = useState<{ escrow: string; explorer: string } | undefined>();

  useEffect(() => {
    getChain().then((c) => c.escrow && c.explorer && setChain({ escrow: c.escrow, explorer: c.explorer })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!run) return;
    setVisible(1);
    let n = 1;
    const id = setInterval(() => {
      n += 1;
      if (n > run.rounds.length) {
        clearInterval(id);
        setStatus("done");
        return;
      }
      setVisible(n);
    }, 1700);
    return () => clearInterval(id);
  }, [run]);

  async function start() {
    setStatus("loading");
    setRun(null);
    setVisible(0);
    try {
      const r = await runMarket(jobType);
      setStatus("running");
      setRun(r);
    } catch {
      setStatus("idle");
    }
  }

  function reset() {
    setStatus("idle");
    setRun(null);
    setVisible(0);
  }

  const currentRound = run?.rounds[Math.max(0, visible - 1)];
  const job = run?.job;

  return (
    <div className="flex flex-col gap-5">
      {/* control bar */}
      <div className={cn(card, "flex flex-wrap items-center justify-between gap-4 p-4")}>
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
          {([["landing", "Landing Page", LayoutTemplate], ["sql", "SQL Query", Database]] as const).map(
            ([id, label, Icon]) => (
              <button
                key={id}
                disabled={status === "running" || status === "loading"}
                onClick={() => setJobType(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50",
                  jobType === id
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : cn(subtle, "hover:text-neutral-900 dark:hover:text-white"),
                )}
              >
                <Icon size={15} strokeWidth={2.2} />
                {label}
              </button>
            ),
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === "done" && (
            <button onClick={reset} className={btnGhost}>
              <RotateCcw size={15} strokeWidth={2.2} /> Reset
            </button>
          )}
          <button onClick={start} disabled={status === "running" || status === "loading"} className={btnPrimary}>
            {status === "loading" ? (
              <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
            ) : (
              <Play size={15} strokeWidth={2.4} />
            )}
            {status === "running" ? "Negotiating…" : status === "done" ? "Run again" : "Open market"}
          </button>
        </div>
      </div>

      {/* buyer brief */}
      {job && (
        <div className={cn(card, "hs-rise grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]")}>
          <div>
            <div className={cn("mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide", subtle)}>
              <Target size={12} /> Buyer brief
            </div>
            <p className="text-[15px] font-medium leading-snug">{job.task}</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Wallet size={14} className="text-brand" strokeWidth={2.2} />
              <span className={subtle}>Budget locked</span>
              <span className="font-mono font-semibold tabular">${job.budget}</span>
            </div>
          </div>
          <div>
            <div className={cn("mb-2 text-[11px] uppercase tracking-wide", subtle)}>Priorities</div>
            <PriorityBars priorities={job.priorities} />
          </div>
        </div>
      )}

      {/* empty state */}
      {status === "idle" && (
        <div className={cn(card, "grid place-items-center gap-2 p-16 text-center")}>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Play size={22} strokeWidth={2.2} />
          </div>
          <p className="text-sm font-medium">Open a market to start the bidding war</p>
          <p className={cn("max-w-sm text-sm", subtle)}>
            One buyer agent negotiates with three seller agents over three rounds, verifies the delivered work, and
            settles on Monad.
          </p>
        </div>
      )}

      {/* live floor */}
      {run && currentRound && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Round <span className="font-mono">{currentRound.round}</span> of {run.rounds.length}
              </h3>
              {status === "running" && (
                <span className={cn("inline-flex items-center gap-1.5 text-xs hs-pulse", subtle)}>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Live
                </span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {currentRound.offers.map((o, i) => (
                <SellerCard
                  key={o.sellerId}
                  offer={o}
                  reputation={run.reputations[o.sellerId]}
                  isLeader={o.sellerId === currentRound.leader}
                  rank={i + 1}
                />
              ))}
            </div>
            {status === "done" && <SettlementPanel run={run} chain={chain} />}
          </div>

          <NegotiationFeed rounds={run.rounds.slice(0, visible)} totalRounds={run.rounds.length} />
        </div>
      )}
    </div>
  );
}
