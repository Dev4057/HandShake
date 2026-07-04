import { useEffect, useMemo, useRef, useState } from "react";
import {
  TerminalSquare, Radio, Trophy, XCircle, MinusCircle, ArrowUpRight, Flame, Star, BellRing,
  BadgeDollarSign, ExternalLink, Loader2, CheckCircle2,
} from "lucide-react";
import type { Agent, MarketSession } from "../types";
import { getAgents } from "../api";
import { useMarkets } from "../lib/markets";
import { useUser } from "../lib/user";
import { card, cn, subtle, label, mono, positive, negative } from "../lib/ui";

/**
 * The seller side of the trade: pick your agent and see the market through its
 * eyes. Live engagements pin to the top the moment a buyer broadcasts a job —
 * an incoming-request alert first, then a live standings board as rounds land.
 */
export function SellerTerminal() {
  const { sessions, connection } = useMarkets();
  const { user } = useUser();
  const [allSellers, setAllSellers] = useState<Agent[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    getAgents().then((r) => setAllSellers(r.agents.filter((a) => a.role === "seller"))).catch(() => {});
  }, [connection === "offline", sessions.length]);

  // only YOUR agents — nobody else's terminal is visible to you
  const sellers = useMemo(
    () => allSellers.filter((a) => a.owner === user),
    [allSellers, user],
  );

  useEffect(() => {
    setMe((cur) => (cur && sellers.some((a) => a.id === cur) ? cur : sellers[0]?.id ?? null));
  }, [sellers]);

  const markets = useMemo(() => sessions.filter((s) => s.kind === "market"), [sessions]);
  const mine = useMemo(() => (me ? markets.filter((s) => s.bidders.includes(me)) : []), [markets, me]);
  const live = mine.filter((s) => s.status === "running");
  const past = mine.filter((s) => s.status !== "running");
  const rep = sellers.find((a) => a.id === me)?.reputation;

  // payment notifications — fire when a settlement involving MY agents completes
  const [toasts, setToasts] = useState<{ id: string; text: string; ok: boolean; txUrl: string | null }[]>([]);
  const seenSettle = useRef(new Map<string, string>());
  const myIds = useMemo(() => new Set(sellers.map((a) => a.id)), [sellers]);
  useEffect(() => {
    for (const s of markets) {
      const st = s.settlement;
      if (!st) continue;
      const prev = seenSettle.current.get(s.id);
      seenSettle.current.set(s.id, st.status);
      if (prev === st.status || st.status !== "done") continue;
      if (prev === undefined && st.status === "done") continue; // pre-existing on page load
      const winnerIsMine = s.winnerId !== null && myIds.has(s.winnerId);
      const participated = s.bidders.some((b) => myIds.has(b));
      if (!participated) continue;
      const price = s.rounds.at(-1)?.offers.find((o) => o.sellerId === s.winnerId)?.price;
      const text = winnerIsMine
        ? st.pass
          ? `Payment settled — ${s.winnerId} received $${price ?? "?"} on Monad`
          : `Settlement final — ${s.winnerId}'s work was rejected, bond slashed`
        : `Market settled — your bond was returned`;
      const id = `${s.id}-${Date.now()}`;
      setToasts((cur) => [...cur, { id, text, ok: winnerIsMine ? st.pass : true, txUrl: st.txUrl }]);
      setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 8_000);
    }
  }, [markets, myIds]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={cn(label, "mb-1 flex items-center gap-1.5")}>
            <TerminalSquare size={11} /> Seller terminal
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Your agent on the floor</h1>
          <p className={cn("mt-1 max-w-lg text-sm leading-relaxed", subtle)}>
            When a buyer broadcasts a job your agent chose to bid on, the engagement pins here live —
            who it's up against, where it ranks, and what the buyer wants next.
          </p>
        </div>
        {rep && rep.jobs > 0 && me && (
          <div className={cn(card, "flex items-center gap-3 px-4 py-2.5")}>
            <Star size={13} className="fill-brand text-brand" />
            <span className={cn(mono, "text-sm font-semibold")}>{rep.score.toFixed(1)}</span>
            <span className={cn(mono, "text-xs", subtle)}>{rep.successes}/{rep.jobs} jobs passed</span>
          </div>
        )}
      </header>

      {/* agent picker */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose your seller agent">
        {sellers.map((a) => {
          const liveCount = markets.filter((s) => s.status === "running" && s.bidders.includes(a.id)).length;
          return (
            <button
              key={a.id}
              onClick={() => setMe(a.id)}
              aria-pressed={a.id === me}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition duration-150",
                a.id === me
                  ? "border-brand/50 bg-brand/[0.08] text-brand-strong dark:border-brand/40 dark:text-brand-soft"
                  : cn("border-neutral-200 bg-white/70 hover:border-neutral-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20", subtle),
              )}
            >
              <span className="grid h-5 w-5 place-items-center rounded bg-neutral-900 text-[9px] font-bold text-white dark:bg-white dark:text-neutral-900">
                {a.id.slice(0, 2).toUpperCase()}
              </span>
              {a.id}
              {liveCount > 0 && (
                <span className="hs-pulse h-1.5 w-1.5 rounded-full bg-brand" aria-label={`${liveCount} live engagement(s)`} />
              )}
            </button>
          );
        })}
      </div>

      {/* live — pinned */}
      {live.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className={cn(label, "flex items-center gap-1.5 text-brand-strong dark:text-brand-soft")}>
            <span className="hs-pulse h-1.5 w-1.5 rounded-full bg-brand" /> Live engagements
          </div>
          {live.map((s) => <Engagement key={s.id} s={s} me={me!} />)}
        </section>
      )}

      {/* no agents yet */}
      {sellers.length === 0 && (
        <div className={cn(card, "grid place-items-center gap-2 p-14 text-center")}>
          <TerminalSquare size={20} className={cn(subtle)} />
          <p className="text-sm font-semibold">No agents under @{user}</p>
          <a href="#/registry" className={cn("mt-1 text-sm font-semibold text-brand-strong hover:underline dark:text-brand-soft")}>
            Register or assign one in the Registry →
          </a>
        </div>
      )}

      {/* history */}
      {sellers.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className={label}>Engagement history</div>
          {past.map((s) => <Engagement key={s.id} s={s} me={me!} />)}
          {mine.length === 0 && (
            <div className={cn(card, "grid place-items-center gap-1.5 p-12 text-center")}>
              <Radio size={20} className={cn(subtle)} />
              <p className="text-sm font-medium">No broadcasts yet{me ? ` for ${me}` : ""}</p>
              <p className={cn("max-w-sm text-sm", subtle)}>
                When a buyer opens a market matching this agent&rsquo;s service types, it appears here
                the moment the brief goes out.
              </p>
            </div>
          )}
        </section>
      )}

      {/* payment notifications */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "hs-rise pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white p-3.5 shadow-lg dark:bg-[#16161c]",
              t.ok ? "border-emerald-500/40" : "border-red-500/40",
            )}
          >
            {t.ok
              ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              : <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />}
            <div className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
              {t.text}
              {t.txUrl && (
                <a
                  href={t.txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(mono, "mt-1 flex items-center gap-1 text-[11px] text-brand-strong hover:underline dark:text-brand-soft")}
                >
                  view transaction <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One market, seen from this seller's side. */
function Engagement({ s, me }: { s: MarketSession; me: string }) {
  const liveNow = s.status === "running";
  const last = s.rounds[s.rounds.length - 1];
  const leading = last?.leader === me;
  const pushed = last?.pushed.includes(me) ?? false;
  const rivals = s.bidders.filter((b) => b !== me);
  const won = s.winnerId === me;
  const incoming = liveNow && !last;

  return (
    <div
      className={cn(
        card,
        "hs-rise flex flex-col gap-4 p-5",
        liveNow && "border-brand/40 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-brand)_8%,transparent)] dark:border-brand/30",
      )}
    >
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{s.job.task}</div>
          <div className={cn("mt-0.5 text-xs", subtle)}>
            from <span className="font-medium text-neutral-900 dark:text-white">{s.buyer.name}</span>
            {" · "}budget <span className={cn(mono, "font-medium")}>${s.job.budget}</span>
            {" · "}{s.job.type.toUpperCase()}
          </div>
        </div>
        {incoming ? (
          <span className={cn(mono, "inline-flex items-center gap-1.5 rounded-md bg-brand px-2 py-1 text-[10px] font-semibold tracking-wide text-white")}>
            <BellRing size={11} strokeWidth={2.4} /> NEW REQUEST
          </span>
        ) : liveNow ? (
          <span className={cn(mono, "inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-strong dark:text-brand-soft")}>
            <span className="hs-pulse h-1.5 w-1.5 rounded-full bg-brand" />
            ROUND {s.rounds.length}/3 · {leading ? "LEADING" : pushed ? "BEING PUSHED" : "IN THE PACK"}
          </span>
        ) : won ? (
          <span className={cn(mono, "inline-flex items-center gap-1 text-[10px] font-semibold", s.verdict?.pass ? positive : negative)}>
            <Trophy size={11} /> WON · {s.verdict?.pass ? "PAID" : "SLASHED"}
          </span>
        ) : s.status === "error" ? (
          <span className={cn(mono, "inline-flex items-center gap-1 text-[10px] font-semibold", negative)}>
            <XCircle size={11} /> MARKET ERROR
          </span>
        ) : (
          <span className={cn(mono, "inline-flex items-center gap-1 text-[10px] font-semibold", subtle)}>
            <MinusCircle size={11} /> LOST TO {s.winnerId?.toUpperCase()}
          </span>
        )}
      </div>

      {/* incoming: the brief just arrived — bid in preparation */}
      {incoming && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-brand/40 p-4">
          <div className={cn("hs-pulse flex items-center gap-2 text-[13px] font-medium")}>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {me} accepted the brief — preparing its opening bid…
          </div>
          {rivals.length > 0 && (
            <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", subtle)}>
              Competing against
              {rivals.map((r) => (
                <span key={r} className={cn(mono, "rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] dark:border-white/10")}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* standings board — every bidder, my row highlighted */}
      {last && (
        <div className="overflow-x-auto">
          <div className="min-w-105 overflow-hidden rounded-xl border border-neutral-200/80 dark:border-white/[0.07]">
            <div className={cn(label, "grid grid-cols-[2.25rem_1.4fr_5rem_4.5rem_4.5rem] gap-2 border-b border-neutral-200/80 bg-neutral-50 px-3.5 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]")}>
              <span>#</span><span>Agent</span><span className="text-right">Bid</span><span className="text-right">Delivery</span><span className="text-right">Score</span>
            </div>
            {last.offers.map((o, i) => {
              const isMe = o.sellerId === me;
              const isLeader = o.sellerId === last.leader;
              return (
                <div
                  key={o.sellerId}
                  className={cn(
                    "grid grid-cols-[2.25rem_1.4fr_5rem_4.5rem_4.5rem] items-center gap-2 px-3.5 py-2.5 text-sm",
                    i > 0 && "border-t border-neutral-200/60 dark:border-white/[0.05]",
                    isMe && "border-l-2 border-l-brand bg-brand/[0.05]",
                  )}
                >
                  <span className={cn(mono, "text-xs font-bold", i === 0 ? "text-brand" : subtle)}>{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{o.sellerId}</span>
                    {isMe && (
                      <span className={cn(mono, "shrink-0 rounded bg-brand px-1 py-px text-[9px] font-bold text-white")}>YOU</span>
                    )}
                    {isLeader && <ArrowUpRight size={12} strokeWidth={2.6} className="shrink-0 text-brand" />}
                    {isMe && pushed && !isLeader && <Flame size={12} className="shrink-0 text-amber-500" />}
                  </span>
                  <span className={cn(mono, "text-right font-semibold tabular")}>${o.price}</span>
                  <span className={cn(mono, "text-right text-xs tabular", subtle)}>{o.deliveryEst}h</span>
                  <span className={cn(mono, "text-right text-xs font-semibold tabular")}>{o.score.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* what the buyer just said */}
      {last?.managerLine && (
        <p className={cn("text-[13px] leading-relaxed", subtle)}>
          <span className={cn(label, "mr-1.5")}>Buyer</span>
          “{last.managerLine}”
          {liveNow && <span className="hs-blink ml-0.5 inline-block h-3 w-[6px] translate-y-0.5 bg-brand" />}
        </p>
      )}

      {/* payment — the seller's view of settlement */}
      {!liveNow && s.status === "done" && (
        <PaymentStatus s={s} won={won} myPrice={last?.offers.find((o) => o.sellerId === me)?.price} />
      )}
    </div>
  );
}

function PaymentStatus({ s, won, myPrice }: { s: MarketSession; won: boolean; myPrice?: number }) {
  const st = s.settlement;
  const winnerPrice = s.rounds.at(-1)?.offers.find((o) => o.sellerId === s.winnerId)?.price;

  if (!st) {
    if (won && s.verdict?.pass) {
      return (
        <p className={cn("flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-medium dark:border-white/10", subtle)}>
          <BadgeDollarSign size={14} /> Work verified — awaiting the buyer&rsquo;s on-chain settlement.
        </p>
      );
    }
    return null;
  }

  if (st.status === "running") {
    return (
      <p className="hs-pulse flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/[0.05] px-3 py-2.5 text-xs font-semibold text-brand-strong dark:text-brand-soft">
        <Loader2 size={14} className="animate-spin" /> Buyer is settling on Monad — transactions broadcasting…
      </p>
    );
  }

  if (st.status === "done") {
    if (won && st.pass) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <BadgeDollarSign size={14} />
          PAYMENT SETTLED — ${winnerPrice ?? myPrice ?? "?"} paid to your wallet{st.collected ? " and withdrawn" : ""}
          {st.txUrl && (
            <a href={st.txUrl} target="_blank" rel="noreferrer" className={cn(mono, "ml-auto inline-flex items-center gap-1 font-medium hover:underline")}>
              tx <ExternalLink size={10} />
            </a>
          )}
        </div>
      );
    }
    if (won && !st.pass) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/[0.07] px-3 py-2.5 text-xs font-semibold text-red-700 dark:text-red-400">
          <XCircle size={14} /> Settlement final — work rejected, your bond was slashed.
          {st.txUrl && (
            <a href={st.txUrl} target="_blank" rel="noreferrer" className={cn(mono, "ml-auto inline-flex items-center gap-1 font-medium hover:underline")}>
              tx <ExternalLink size={10} />
            </a>
          )}
        </div>
      );
    }
    return (
      <p className={cn("flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-medium dark:border-white/10", subtle)}>
        <CheckCircle2 size={14} className="text-emerald-500" /> Market settled on-chain — your bond was returned.
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2.5 text-xs font-medium text-red-600 dark:text-red-400">
      <XCircle size={14} /> Settlement hit an error — the buyer can retry it.
    </p>
  );
}
