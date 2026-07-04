import { useEffect, useRef, useState } from "react";
import {
  Link2, Loader2, CheckCircle2, XCircle, Circle, ExternalLink, TrendingUp, Zap,
} from "lucide-react";
import type { Settlement, SettlementStep } from "../types";
import { getSettle, settleSession } from "../api";
import { cn, subtle, chip, btnPrimary, short } from "../lib/ui";

const POLL_MS = 1200;

export function SettleLive({
  pass,
  sessionId,
  existingId,
  chain,
}: {
  pass: boolean;
  sessionId: string;
  /** Settlement already started for this session (e.g. page reloaded) — resume it. */
  existingId?: string | null;
  chain?: { escrow: string; explorer: string };
}) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function poll(id: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const s = await getSettle(id);
        setSettlement(s);
        if (s.status !== "running" && timer.current) clearInterval(timer.current);
      } catch {
        /* transient poll error — keep trying */
      }
    }, POLL_MS);
  }

  useEffect(() => {
    if (existingId) {
      getSettle(existingId)
        .then((s) => {
          setSettlement(s);
          if (s.status === "running") poll(s.id);
        })
        .catch(() => {});
    }
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId]);

  async function begin() {
    setStarting(true);
    setFailed(null);
    try {
      const s = await settleSession(sessionId);
      setSettlement(s);
      if (s.status === "running") poll(s.id);
    } catch (e) {
      setFailed((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 size={15} strokeWidth={2.2} className="text-brand" />
          <span className="text-sm font-semibold">On-chain settlement</span>
          <span className={cn(chip, "border-brand/30 text-brand-strong dark:text-brand-soft")}>Monad Testnet</span>
        </div>

        {!settlement && (
          <button onClick={begin} disabled={starting} className={btnPrimary}>
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} strokeWidth={2.4} />}
            Settle on Monad
          </button>
        )}
        {settlement?.status === "running" && (
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium hs-pulse", subtle)}>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Broadcasting transactions…
          </span>
        )}
        {settlement?.status === "done" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Settled on-chain
          </span>
        )}
        {settlement?.status === "error" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <XCircle size={14} /> {settlement.error ?? "Settlement failed"}
          </span>
        )}
      </div>

      {failed && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Could not start settlement: {failed}
        </p>
      )}

      {!settlement && (
        <p className={cn("text-xs", subtle)}>
          Locks the budget, stakes a bond from each seller&rsquo;s own wallet, then
          {pass ? " pays the winner and lifts its reputation" : " refunds the buyer and slashes the winner's bond"} —
          every transaction verifiable on the explorer.
        </p>
      )}

      {settlement && (
        <ol className="flex flex-col">
          {settlement.steps.map((st, i) => (
            <Step key={st.key} step={st} last={i === settlement.steps.length - 1} />
          ))}
        </ol>
      )}

      {settlement?.status === "done" && settlement.reputationBefore && settlement.reputationAfter && (
        <div className="hs-rise flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-neutral-200 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <TrendingUp size={13} className="text-brand" /> {settlement.winnerId} reputation
          </span>
          <span className={cn("font-mono text-xs tabular", subtle)}>
            won {settlement.reputationBefore.jobsWon} → <b className="text-brand-strong dark:text-brand-soft">{settlement.reputationAfter.jobsWon}</b>
            {" · "}passed {settlement.reputationBefore.jobsPassed} → <b className="text-brand-strong dark:text-brand-soft">{settlement.reputationAfter.jobsPassed}</b>
            {" · "}avg {settlement.reputationBefore.avgScore.toFixed(1)} → <b className="text-brand-strong dark:text-brand-soft">{settlement.reputationAfter.avgScore.toFixed(1)}</b>
          </span>
          {settlement.winnerAddressUrl && (
            <a
              href={settlement.winnerAddressUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-brand-strong hover:underline dark:text-brand-soft"
            >
              {short(settlement.winnerAddress ?? "")} <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {chain && (
        <a
          href={chain.explorer}
          target="_blank"
          rel="noreferrer"
          className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] hover:underline", subtle)}
        >
          escrow {chain.escrow.slice(0, 10)}…{chain.escrow.slice(-6)} <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function Step({ step, last }: { step: SettlementStep; last: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepIcon state={step.state} />
        {!last && (
          <span
            className={cn(
              "my-0.5 w-px flex-1",
              step.state === "done" ? "bg-brand/40" : "bg-neutral-200 dark:bg-white/10",
            )}
          />
        )}
      </div>
      <div className={cn("flex min-w-0 flex-1 items-baseline gap-2 pb-3", last && "pb-0")}>
        <span
          className={cn(
            "text-sm",
            step.state === "pending" && subtle,
            step.state === "running" && "font-medium",
            step.state === "done" && "font-medium",
            step.state === "error" && "font-medium text-red-600 dark:text-red-400",
          )}
        >
          {step.label}
        </span>
        {step.detail && <span className={cn("truncate font-mono text-[11px]", subtle)}>{step.detail}</span>}
        {step.txUrl && (
          <a
            href={step.txUrl}
            target="_blank"
            rel="noreferrer"
            className="hs-rise ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-brand-strong hover:underline dark:text-brand-soft"
          >
            {step.txHash?.slice(0, 10)}… <ExternalLink size={11} />
          </a>
        )}
      </div>
    </li>
  );
}

function StepIcon({ state }: { state: SettlementStep["state"] }) {
  if (state === "done") return <CheckCircle2 size={16} className="shrink-0 text-brand" strokeWidth={2.2} />;
  if (state === "running") return <Loader2 size={16} className="shrink-0 animate-spin text-brand" strokeWidth={2.2} />;
  if (state === "error") return <XCircle size={16} className="shrink-0 text-red-500" strokeWidth={2.2} />;
  return <Circle size={16} className="shrink-0 text-neutral-300 dark:text-white/20" strokeWidth={2} />;
}
