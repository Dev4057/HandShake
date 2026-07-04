import { Loader2, ShieldCheck, FileCode2, Star } from "lucide-react";
import type { MarketSession } from "../types";
import { SellerCard } from "./SellerCard";
import { NegotiationFeed } from "./NegotiationFeed";
import { PriorityBars } from "./PriorityBars";
import { PriceChart } from "./PriceChart";
import { SettleLive } from "./SettleLive";
import { card, cn, subtle, label, mono, positive, negative } from "../lib/ui";

const TOTAL_ROUNDS = 3;

export const PHASE_LABEL: Record<MarketSession["phase"], string> = {
  opening: "Opening market",
  negotiating: "Negotiating",
  delivering: "Winner producing the work",
  verifying: "Buyer verifying the work",
  settled: "Complete",
};

/** Full view of one market session — live while running, full record when done. */
export function SessionDetail({ session: s, chain }: { session: MarketSession; chain?: { escrow: string; explorer: string } }) {
  const last = s.rounds[s.rounds.length - 1];
  const live = s.status === "running";
  return (
    <div className="hs-rise flex flex-col gap-5">
      {/* brief */}
      <div className={cn(card, "grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]")}>
        <div>
          <div className={cn(label, "mb-1.5")}>
            {s.buyer.name} · {s.buyer.scripted ? "Autonomous buyer" : "AI buyer"} · brief
          </div>
          <p className="text-[15px] font-medium leading-snug">{s.job.task}</p>
          <div className={cn("mt-2 text-sm", subtle)}>
            Budget locked <span className={cn(mono, "font-semibold text-neutral-900 dark:text-white")}>${s.job.budget}</span>
          </div>
        </div>
        <div>
          <div className={cn(label, "mb-2")}>Priorities</div>
          <PriorityBars priorities={s.job.priorities} />
        </div>
      </div>

      {/* live phase banner */}
      {live && (
        <div className={cn(card, "flex items-center gap-3 border-brand/30 p-4 dark:border-brand/25")}>
          <Loader2 size={15} className="animate-spin text-brand" />
          <span className="text-sm font-medium">
            {PHASE_LABEL[s.phase]}
            {s.phaseDetail ? <> — <span className={cn(mono, "text-xs")}>{s.phaseDetail}</span></> : null}
          </span>
          <span className={cn(mono, "ml-auto text-[10px] tracking-wide", subtle)}>
            {s.phase === "negotiating" ? `ROUND ${s.rounds.length}/${TOTAL_ROUNDS} SCORED` : "NEGOTIATION CLOSED"}
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* the drama, made visible: every seller's bid stepping down each round */}
          <PriceChart rounds={s.rounds} totalRounds={live ? TOTAL_ROUNDS : s.rounds.length} budget={s.job.budget} />

          <div className={label}>{live ? `Round ${last.round} — standing offers` : "Final round"}</div>
          <div className={cn("grid gap-4", last.offers.length >= 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2")}>
            {last.offers.map((o, i) => (
              <SellerCard key={o.sellerId} offer={o} reputation={s.reputations[o.sellerId]} isLeader={o.sellerId === last.leader} rank={i + 1} />
            ))}
          </div>

          {!live && s.verdict && s.deliverable && (
            <div className={cn(card, "flex flex-col gap-4 p-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck size={15} strokeWidth={2.2} className="text-brand" />
                <span className="text-sm font-semibold">
                  {s.winnerId} delivered — <span className={s.verdict.pass ? positive : negative}>{s.verdict.pass ? "verified" : "rejected"}</span>
                  <span className={cn(mono, "ml-1 text-xs", subtle)}>({s.verdict.score}/10)</span>
                </span>
              </div>
              <p className={cn("text-xs leading-relaxed", subtle)}>{s.verdict.notes}</p>
              <DeliveredWork type={s.job.type} content={s.deliverable.content} />
              <SettleLive pass={s.verdict.pass} sessionId={s.id} existingId={s.settlementId} chain={chain} />
            </div>
          )}

          {s.status === "error" && (
            <div className={cn(card, "border-red-500/30 p-4 text-sm", negative)}>
              Market failed: {s.error ?? "unknown error"}
            </div>
          )}
        </div>

        <NegotiationFeed rounds={s.rounds} totalRounds={live ? TOTAL_ROUNDS : s.rounds.length} live={live} />
      </div>
    </div>
  );
}

/**
 * The market's opening moment: the brief is out and these sellers entered.
 * Shown from the second a market opens until round 1 is scored, so the
 * competitors are visible immediately — not just a loading line.
 */
export function OpeningLineup({ session: s }: { session: MarketSession }) {
  return (
    <div className={cn(card, "hs-rise flex flex-col gap-5 p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <Loader2 size={15} className="animate-spin text-brand" />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold">
            {s.buyer.name} broadcast the brief — {s.bidders.length} seller{s.bidders.length === 1 ? "" : "s"} entered the market
          </div>
          <div className={cn("mt-0.5 truncate text-xs", subtle)}>
            {s.job.task} · budget <span className={cn(mono, "font-medium")}>${s.job.budget}</span>
          </div>
        </div>
        <span className={cn(mono, "ml-auto text-[10px] font-semibold tracking-wide text-brand-strong dark:text-brand-soft")}>
          OPENING BIDS
        </span>
      </div>

      <div className={cn("grid gap-3", s.bidders.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {s.bidders.map((id) => {
          const rep = s.reputations[id];
          return (
            <div key={id} className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 p-4 dark:border-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-neutral-900">
                    {id.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-semibold">{id}</span>
                </div>
                {rep && rep.jobs > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <Star size={11} className="fill-brand text-brand" />
                    <span className={mono}>{rep.score.toFixed(1)}</span>
                  </span>
                ) : (
                  <span className={cn(mono, "shrink-0 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] dark:border-white/10", subtle)}>
                    NEW
                  </span>
                )}
              </div>
              <div className={cn("hs-pulse flex items-center gap-1.5 text-xs", subtle)}>
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> preparing opening bid…
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The one place delivered work renders. Landing pages run in a sandboxed
 *  iframe — seller HTML executes in an isolated origin, never ours. */
export function DeliveredWork({ type, content }: { type: MarketSession["job"]["type"]; content: string }) {
  return (
    <div>
      <div className={cn(label, "mb-2 flex items-center gap-1.5")}>
        <FileCode2 size={11} /> Delivered work
      </div>
      {type === "landing" ? (
        <iframe
          title="delivered work"
          srcDoc={content}
          sandbox="allow-scripts"
          className="h-96 w-full rounded-xl border border-neutral-200 bg-white dark:border-white/10"
        />
      ) : (
        <pre className={cn(mono, "max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-white/10 dark:bg-black/40")}>
          {content.trim()}
        </pre>
      )}
    </div>
  );
}
