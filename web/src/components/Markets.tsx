import { useEffect, useRef, useState } from "react";
import {
  Store, Play, Loader2, CheckCircle2, XCircle, LayoutTemplate, Database, LineChart,
  ShieldCheck, FileCode2, Bot, User,
} from "lucide-react";
import type { MarketSession } from "../types";
import { openMarkets, getMarkets, settleSession, getChain } from "../api";
import { SellerCard } from "./SellerCard";
import { NegotiationFeed } from "./NegotiationFeed";
import { PriorityBars } from "./PriorityBars";
import { SettleLive } from "./SettleLive";
import { card, cn, subtle, chip, btnPrimary } from "../lib/ui";

const JOB_ICON = { landing: LayoutTemplate, sql: Database, data: LineChart } as const;
const POLL_MS = 2500;

export function Markets() {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [chain, setChain] = useState<{ escrow: string; explorer: string } | undefined>();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getChain().then((c) => c.escrow && c.explorer && setChain({ escrow: c.escrow, explorer: c.explorer })).catch(() => {});
    refresh();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  function refresh() {
    getMarkets()
      .then((r) => {
        const latest = r.sessions.slice(0, 3); // newest batch
        setSessions(latest);
        if (latest.some((s) => s.status === "running")) {
          if (!timer.current) timer.current = setInterval(refresh, POLL_MS);
        } else if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      })
      .catch(() => {});
  }

  async function openAll() {
    setOpening(true);
    setSelected(null);
    try {
      await openMarkets();
      refresh();
    } finally {
      setOpening(false);
    }
  }

  const sel = sessions.find((s) => s.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* control */}
      <div className={cn(card, "flex flex-wrap items-center justify-between gap-4 p-4")}>
        <div className="flex items-center gap-2">
          <Store size={16} strokeWidth={2.2} className="text-brand" />
          <span className="text-sm font-semibold">Marketplace</span>
          <span className={cn("text-xs", subtle)}>3 buyers · 6 sellers · one shared pool</span>
        </div>
        <button onClick={openAll} disabled={opening || sessions.some((s) => s.status === "running")} className={btnPrimary}>
          {opening ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2.4} />}
          Open all markets
        </button>
      </div>

      {/* empty state */}
      {sessions.length === 0 && (
        <div className={cn(card, "grid place-items-center gap-2 p-14 text-center")}>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Store size={22} strokeWidth={2.2} />
          </div>
          <p className="text-sm font-medium">Three buyers, three jobs, one seller pool</p>
          <p className={cn("max-w-md text-sm", subtle)}>
            Each buyer posts its job; every seller decides which markets to enter. Three negotiations run in
            parallel and each settles on Monad from its own buyer wallet.
          </p>
        </div>
      )}

      {/* session cards */}
      {sessions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {sessions.map((s) => {
            const Icon = JOB_ICON[s.job.type];
            const isSel = s.id === selected;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={cn(
                  card,
                  "hs-rise flex flex-col gap-3 p-4 text-left transition hover:border-brand/40",
                  isSel && "ring-2 ring-brand",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    {s.buyer.scripted ? <Bot size={14} className={cn(subtle)} /> : <User size={14} className="text-brand" />}
                    {s.buyer.name}
                  </span>
                  {s.status === "running" && (
                    <span className={cn("inline-flex items-center gap-1.5 text-xs hs-pulse", subtle)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Live
                    </span>
                  )}
                  {s.status === "done" && s.verdict && (
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold",
                      s.verdict.pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}>
                      {s.verdict.pass ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {s.verdict.pass ? "Verified" : "Rejected"}
                    </span>
                  )}
                  {s.status === "error" && <span className="text-xs font-semibold text-red-500">Error</span>}
                </div>

                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon size={14} strokeWidth={2.2} />
                  </span>
                  <p className="line-clamp-2 text-sm leading-snug">{s.job.task}</p>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  {s.bidders.map((b) => (
                    <span key={b} className={cn(chip, "px-2 py-0.5 text-[10px]", s.winnerId === b && "border-brand/40 bg-brand/10 text-brand-strong dark:text-brand-soft")}>
                      {b}
                    </span>
                  ))}
                  <span className={cn("ml-auto font-mono text-xs tabular", subtle)}>${s.job.budget}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* detail */}
      {sel && sel.status === "done" && sel.rounds.length > 0 && (
        <SessionDetail session={sel} chain={chain} />
      )}
      {sel && sel.status === "running" && (
        <div className={cn(card, "flex items-center gap-3 p-6")}>
          <Loader2 size={18} className="animate-spin text-brand" />
          <span className="text-sm">Agents are negotiating — {sel.bidders.join(", ")} in the room…</span>
        </div>
      )}
    </div>
  );
}

function SessionDetail({ session: s, chain }: { session: MarketSession; chain?: { escrow: string; explorer: string } }) {
  const last = s.rounds[s.rounds.length - 1];
  return (
    <div className="hs-rise flex flex-col gap-5">
      {/* brief */}
      <div className={cn(card, "grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]")}>
        <div>
          <div className={cn("mb-1 text-[11px] uppercase tracking-wide", subtle)}>
            {s.buyer.name} · buyer brief {s.buyer.scripted ? "(scripted buyer)" : "(AI buyer)"}
          </div>
          <p className="text-[15px] font-medium leading-snug">{s.job.task}</p>
          <div className={cn("mt-2 text-sm", subtle)}>
            Budget <span className="font-mono font-semibold tabular text-neutral-900 dark:text-white">${s.job.budget}</span>
          </div>
        </div>
        <PriorityBars priorities={s.job.priorities} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Final round</h3>
          <div className={cn("grid gap-4", last.offers.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {last.offers.map((o, i) => (
              <SellerCard key={o.sellerId} offer={o} reputation={s.reputations[o.sellerId]} isLeader={o.sellerId === last.leader} rank={i + 1} />
            ))}
          </div>

          {/* verdict + deliverable + settle */}
          {s.verdict && s.deliverable && (
            <div className={cn(card, "flex flex-col gap-4 p-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck size={15} className="text-brand" />
                <span className="text-sm font-semibold">{s.winnerId} delivered · {s.verdict.pass ? "verified" : "rejected"} ({s.verdict.score}/10)</span>
              </div>
              <p className={cn("text-xs", subtle)}>{s.verdict.notes}</p>
              <div>
                <div className={cn("mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide", subtle)}>
                  <FileCode2 size={12} /> Delivered work
                </div>
                {s.job.type === "landing" ? (
                  <iframe title="delivered work" srcDoc={s.deliverable.content} className="h-96 w-full rounded-xl border border-neutral-200 bg-white dark:border-white/10" />
                ) : (
                  <pre className="max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed dark:border-white/10 dark:bg-black/30">
                    {s.deliverable.content.trim()}
                  </pre>
                )}
              </div>
              <SettleLive pass={s.verdict.pass} start={() => settleSession(s)} chain={chain} />
            </div>
          )}
        </div>

        <NegotiationFeed rounds={s.rounds} totalRounds={s.rounds.length} />
      </div>
    </div>
  );
}
