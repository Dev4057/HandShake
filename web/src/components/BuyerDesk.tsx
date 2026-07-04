import { useEffect, useState } from "react";
import {
  Briefcase, Play, Loader2, LayoutTemplate, Database, LineChart, CheckCircle2, XCircle, User, Bot, Star, Search,
} from "lucide-react";
import type { Agent, MarketSession } from "../types";
import { getAgents, getBuyers, getChain, openMarketFor, ApiError, type BuyerAgent } from "../api";
import { useMarkets } from "../lib/markets";
import { useUser } from "../lib/user";
import { SessionDetail, OpeningLineup } from "./SessionDetail";
import { card, cardHover, cn, subtle, label, mono, btnPrimary, btnSm, positive, negative, short, explorerAddr } from "../lib/ui";

const JOB_ICON = { landing: LayoutTemplate, sql: Database, data: LineChart } as const;

/**
 * The buyer side of the trade: your buyer agents, their standing jobs, and a
 * one-click market per agent. The selected agent's latest market renders below,
 * live — same engine, this desk is just its owner's view.
 */
export function BuyerDesk() {
  const { sessions, connection } = useMarkets();
  const { user } = useUser();
  const [allBuyers, setAllBuyers] = useState<BuyerAgent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<{ escrow: string; explorer: string } | undefined>();
  const [sellerPool, setSellerPool] = useState<Agent[]>([]);

  useEffect(() => {
    getBuyers().then((r) => setAllBuyers(r.buyers)).catch(() => {});
    getAgents().then((r) => setSellerPool(r.agents.filter((a) => a.role === "seller"))).catch(() => {});
    getChain().then((c) => c.escrow && c.explorer && setChain({ escrow: c.escrow, explorer: c.explorer })).catch(() => {});
  }, [connection === "offline", sessions.length]);

  // only YOUR buyer agents — the desk is account-scoped
  const buyers = allBuyers.filter((b) => b.owner === user);

  useEffect(() => {
    setSelected((cur) => (cur && buyers.some((b) => b.id === cur) ? cur : buyers[0]?.id ?? null));
  }, [buyers.length, user]);

  const latestFor = (buyerId: string): MarketSession | undefined =>
    sessions.find((s) => s.kind === "market" && s.buyer.id === buyerId);

  async function open(buyerId: string) {
    setOpeningId(buyerId);
    setError(null);
    setSelected(buyerId);
    try {
      await openMarketFor(buyerId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not open the market");
    } finally {
      setOpeningId(null);
    }
  }

  const sel = selected ? latestFor(selected) : undefined;
  const selBuyer = buyers.find((b) => b.id === selected) ?? null;
  const matching = selBuyer
    ? sellerPool.filter((a) => a.serviceTypes?.includes(selBuyer.job.type))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className={cn(label, "mb-1 flex items-center gap-1.5")}>
            <Briefcase size={11} /> Buyer desk
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Your buyer agents</h1>
          <p className={cn("mt-1 max-w-lg text-sm leading-relaxed", subtle)}>
            Each agent has a standing job and a budget it can escrow. Open its market and it
            negotiates, verifies, and settles on its own — you just watch.
          </p>
        </div>
        {error && <p className={cn("text-sm", negative)}>{error}</p>}
      </header>

      {/* agent cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {buyers.map((b) => {
          const s = latestFor(b.id);
          const running = s?.status === "running";
          const Icon = JOB_ICON[b.job.type];
          const isSel = b.id === selected;
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(b.id)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(b.id)}
              className={cn(card, cardHover, "flex cursor-pointer flex-col gap-4 p-5", isSel && "border-brand/50 dark:border-brand/40")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-neutral-900">
                    {b.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{b.name}</span>
                      {b.scripted
                        ? <Bot size={12} strokeWidth={2.2} className={cn("shrink-0", subtle)} />
                        : <User size={12} strokeWidth={2.2} className="shrink-0 text-brand" />}
                    </div>
                    {b.wallet?.startsWith("0x") ? (
                      <a
                        href={explorerAddr(b.wallet)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(mono, "text-[10px] hover:underline", subtle)}
                      >
                        {short(b.wallet)}
                      </a>
                    ) : (
                      <span className={cn(mono, "text-[10px]", subtle)}>{b.wallet ?? "—"}</span>
                    )}
                  </div>
                </div>
                <DeskStatus s={s} />
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <p className="line-clamp-2 text-[13px] leading-snug">{b.job.task}</p>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-neutral-200/70 pt-3.5 dark:border-white/[0.07]">
                <span className={cn("text-xs", subtle)}>
                  Budget <span className={cn(mono, "font-semibold text-neutral-900 dark:text-white")}>${b.job.budget}</span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); void open(b.id); }}
                  disabled={running || openingId !== null || connection === "offline"}
                  className={cn(btnPrimary, btnSm)}
                >
                  {openingId === b.id || running
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Play size={13} strokeWidth={2.4} />}
                  {running ? "Market live" : "Open market"}
                </button>
              </div>
            </div>
          );
        })}
        {buyers.length === 0 && (
          <div className={cn(card, "col-span-full grid place-items-center gap-2 p-12 text-center")}>
            <p className="text-sm font-semibold">No buyer agents under this account</p>
            <a href="#/registry" className="text-sm font-semibold text-brand-strong hover:underline dark:text-brand-soft">
              Assign one in the Registry →
            </a>
          </div>
        )}
      </div>

      {/* sellers whose skills match the selected job — who CAN do this work */}
      {selBuyer && (
        <section className={cn(card, "flex flex-col gap-4 p-5")}>
          <div className="flex flex-wrap items-center gap-2">
            <Search size={14} strokeWidth={2.2} className="text-brand" />
            <span className="text-sm font-semibold">
              Sellers matching this job
              <span className={cn("ml-1.5 font-normal", subtle)}>· {selBuyer.job.type.toUpperCase()} specialists</span>
            </span>
            <span className={cn(mono, "ml-auto text-[11px]", subtle)}>{matching.length} available</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matching.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-neutral-200/80 p-3.5 dark:border-white/[0.07]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white dark:bg-white dark:text-neutral-900">
                  {a.id.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-semibold">{a.id}</div>
                  <div className={cn("truncate text-[11px]", subtle)}>
                    {a.skills} · {a.owner === "Handshake" ? "Handshake" : `@${a.owner}`}
                  </div>
                </div>
                {a.reputation.jobs > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <Star size={11} className="fill-brand text-brand" />
                    <span className={mono}>{a.reputation.score.toFixed(1)}</span>
                  </span>
                ) : (
                  <span className={cn(mono, "shrink-0 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] dark:border-white/10", subtle)}>
                    NEW
                  </span>
                )}
              </div>
            ))}
            {matching.length === 0 && (
              <p className={cn("col-span-full text-sm", subtle)}>
                No sellers cover {selBuyer.job.type} yet — register one in the Registry with that service type.
              </p>
            )}
          </div>
        </section>
      )}

      {/* the selected agent's market, live */}
      {sel && sel.rounds.length > 0 && <SessionDetail session={sel} chain={chain} />}
      {sel && sel.status === "running" && sel.rounds.length === 0 && <OpeningLineup session={sel} />}
      {selected && !sel && buyers.length > 0 && (
        <div className={cn(card, "grid place-items-center gap-1.5 p-12 text-center")}>
          <p className="text-sm font-medium">No market yet for {buyers.find((b) => b.id === selected)?.name}</p>
          <p className={cn("text-sm", subtle)}>Open its market above — the negotiation will stream here live.</p>
        </div>
      )}
    </div>
  );
}

function DeskStatus({ s }: { s?: MarketSession }) {
  if (!s) return <span className={cn(mono, "text-[10px]", subtle)}>IDLE</span>;
  if (s.status === "running")
    return (
      <span className={cn(mono, "inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-strong dark:text-brand-soft")}>
        <span className="hs-pulse h-1.5 w-1.5 rounded-full bg-brand" /> LIVE
      </span>
    );
  if (s.status === "error") return <span className={cn(mono, "text-[10px] font-semibold", negative)}>ERROR</span>;
  if (s.verdict)
    return (
      <span className={cn(mono, "inline-flex items-center gap-1 text-[10px] font-semibold", s.verdict.pass ? positive : negative)}>
        {s.verdict.pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
        {s.verdict.pass ? "VERIFIED" : "REJECTED"}
      </span>
    );
  return null;
}
