import { useEffect, useState } from "react";
import {
  Store, Play, Loader2, CheckCircle2, XCircle, LayoutTemplate, Database, LineChart,
  Bot, User, WifiOff, RefreshCw,
} from "lucide-react";
import type { MarketSession } from "../types";
import { openMarkets, getChain, ApiError } from "../api";
import { useMarkets } from "../lib/markets";
import { SessionDetail, OpeningLineup, PHASE_LABEL } from "./SessionDetail";
import { card, cardHover, cn, subtle, mono, btnPrimary, btnGhost, positive, negative } from "../lib/ui";

const JOB_ICON = { landing: LayoutTemplate, sql: Database, data: LineChart } as const;

export function Markets({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { sessions: all, connection, refresh } = useMarkets();
  const sessions = all.filter((s) => s.kind === "market").slice(0, 3);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [chain, setChain] = useState<{ escrow: string; explorer: string } | undefined>();

  useEffect(() => {
    getChain().then((c) => c.escrow && c.explorer && setChain({ escrow: c.escrow, explorer: c.explorer })).catch(() => {});
  }, []);

  async function openAll() {
    setOpening(true);
    setOpenError(null);
    try {
      await openMarkets();
      refresh();
    } catch (e) {
      setOpenError(e instanceof ApiError ? e.message : "Could not open markets");
    } finally {
      setOpening(false);
    }
  }

  // selection: deep link wins; otherwise auto-open the first live market
  const sel =
    sessions.find((s) => s.id === selectedId) ??
    sessions.find((s) => s.status === "running") ??
    sessions[0] ??
    null;
  const anyRunning = sessions.some((s) => s.status === "running");
  const loading = connection === "connecting" && sessions.length === 0;
  const offline = connection === "offline" && sessions.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ticker strip */}
      {sessions.length > 0 && <Ticker sessions={sessions} />}

      {/* control */}
      <div className={cn(card, "flex flex-wrap items-center justify-between gap-4 p-4")}>
        <div className="flex items-center gap-2.5">
          <Store size={16} strokeWidth={2.2} className="text-brand" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Marketplace</div>
            <div className={cn("text-xs", subtle)}>Every seller sees every job and picks its own markets</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {openError && <span className={cn("text-xs", negative)}>{openError}</span>}
          <button onClick={openAll} disabled={opening || anyRunning || connection === "offline"} className={btnPrimary}>
            {opening ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2.4} />}
            Open all markets
          </button>
        </div>
      </div>

      {/* first-load skeleton */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(card, "h-36 animate-pulse bg-neutral-100/60 dark:bg-white/[0.02]")} />
          ))}
        </div>
      )}

      {/* backend unreachable — distinct from "no markets" */}
      {offline && !loading && (
        <div className={cn(card, "grid place-items-center gap-2.5 border-red-500/20 p-16 text-center")}>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <WifiOff size={22} strokeWidth={2.2} />
          </div>
          <p className="text-sm font-semibold">Can&rsquo;t reach the Handshake API</p>
          <p className={cn("max-w-md text-sm leading-relaxed", subtle)}>
            Start it with <code className={cn(mono, "rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-white/10")}>npm run server</code> — the
            marketplace reconnects automatically.
          </p>
          <button onClick={refresh} className={cn(btnGhost, "mt-1")}>
            <RefreshCw size={14} /> Retry now
          </button>
        </div>
      )}

      {/* genuinely empty */}
      {!loading && !offline && sessions.length === 0 && (
        <div className={cn(card, "grid place-items-center gap-2.5 p-16 text-center")}>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Store size={22} strokeWidth={2.2} />
          </div>
          <p className="text-sm font-semibold">No markets open</p>
          <p className={cn("max-w-md text-sm leading-relaxed", subtle)}>
            Buyer agents post their jobs into a shared seller pool. Negotiations run in parallel and each
            market settles on Monad from its own buyer wallet.
          </p>
        </div>
      )}

      {/* session cards */}
      {sessions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {sessions.map((s) => {
            const Icon = JOB_ICON[s.job.type];
            const isSel = s.id === sel?.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                aria-pressed={isSel}
                className={cn(card, cardHover, "hs-rise flex flex-col gap-3.5 p-4 text-left", isSel && "border-brand/50 dark:border-brand/40")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                    {s.buyer.scripted
                      ? <Bot size={13} strokeWidth={2.2} className={cn("shrink-0", subtle)} />
                      : <User size={13} strokeWidth={2.2} className="shrink-0 text-brand" />}
                    <span className="truncate">{s.buyer.name}</span>
                  </span>
                  <Status s={s} />
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon size={14} strokeWidth={2.2} />
                  </span>
                  <p className="line-clamp-2 text-sm leading-snug">{s.job.task}</p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-neutral-200/70 pt-3 dark:border-white/[0.07]">
                  <div className="flex flex-wrap gap-1">
                    {s.bidders.map((b) => (
                      <span
                        key={b}
                        className={cn(
                          mono,
                          "rounded-md border px-1.5 py-0.5 text-[10px]",
                          s.winnerId === b
                            ? "border-brand/40 bg-brand/[0.08] font-semibold text-brand-strong dark:text-brand-soft"
                            : cn("border-neutral-200 dark:border-white/10", subtle),
                        )}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                  <span className={cn(mono, "text-xs font-semibold")}>${s.job.budget}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* detail — live while running, full record when done */}
      {sel && sel.rounds.length > 0 && <SessionDetail session={sel} chain={chain} />}
      {sel && sel.status === "running" && sel.rounds.length === 0 && <OpeningLineup session={sel} />}
    </div>
  );
}

function Status({ s }: { s: MarketSession }) {
  if (s.status === "running")
    return (
      <span className={cn(mono, "inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wide text-brand-strong dark:text-brand-soft")}>
        <span className="hs-pulse h-1.5 w-1.5 rounded-full bg-brand" />
        {s.phase === "negotiating" ? `LIVE · R${Math.min(s.rounds.length + 1, 3)}` : PHASE_LABEL[s.phase].toUpperCase()}
      </span>
    );
  if (s.status === "error") return <span className={cn(mono, "text-[10px] font-semibold", negative)}>ERROR</span>;
  if (s.verdict)
    return (
      <span className={cn(mono, "inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wide", s.verdict.pass ? positive : negative)}>
        {s.verdict.pass ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        {s.verdict.pass ? "VERIFIED" : "REJECTED"}
      </span>
    );
  return null;
}

function Ticker({ sessions }: { sessions: MarketSession[] }) {
  const items = sessions.map((s) => {
    const state = s.status === "running" ? "LIVE" : s.status === "error" ? "ERROR" : s.verdict?.pass ? "VERIFIED" : "REJECTED";
    const win = s.winnerId ? ` · WINNER ${s.winnerId.toUpperCase()}` : ` · ${s.bidders.length} BIDDERS`;
    return `${s.buyer.name.toUpperCase()} / ${s.job.type.toUpperCase()} · $${s.job.budget} · ${state}${win}`;
  });
  const row = items.join("      •      ");
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-100 py-2 dark:border-white/[0.08] dark:bg-neutral-950">
      <div className={cn(mono, "hs-ticker flex w-max whitespace-nowrap text-[11px] font-medium tracking-wide text-neutral-600 dark:text-neutral-400")}>
        <span className="px-6">{row}</span>
        <span className="px-6">{row}</span>
      </div>
    </div>
  );
}
