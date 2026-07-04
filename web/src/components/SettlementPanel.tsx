import { CheckCircle2, XCircle, ShieldCheck, Trophy, FileCode2 } from "lucide-react";
import type { MarketRun } from "../types";
import { card, cn, subtle, chip } from "../lib/ui";
import { SettleLive } from "./SettleLive";
import { startSettle } from "../api";

export function SettlementPanel({ run, chain }: { run: MarketRun; chain?: { escrow: string; explorer: string } }) {
  const pass = run.verdict.pass;

  return (
    <div className={cn(card, "hs-rise flex flex-col gap-5 p-5")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} strokeWidth={2.2} className="text-brand" />
          <h3 className="text-sm font-semibold">Settlement</h3>
        </div>
        <span
          className={cn(
            chip,
            pass
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
          )}
        >
          {pass ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {pass ? "Verified" : "Rejected"} · {run.verdict.score}/10
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
          <div className={cn("text-[11px] uppercase tracking-wide", subtle)}>Winner hired</div>
          <div className="mt-0.5 font-semibold">{run.winnerId}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
          <div className={cn("flex items-center gap-1.5 text-[11px] uppercase tracking-wide", subtle)}>
            <ShieldCheck size={12} /> Verification
          </div>
          <div className="mt-0.5 text-sm">{run.verdict.notes}</div>
        </div>
      </div>

      {/* delivered work */}
      <div>
        <div className={cn("mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide", subtle)}>
          <FileCode2 size={12} /> Delivered work
        </div>
        {run.job.type === "landing" ? (
          <iframe
            title="delivered landing page"
            srcDoc={run.deliverable.content}
            className="h-96 w-full rounded-xl border border-neutral-200 bg-white dark:border-white/10"
          />
        ) : (
          <pre className="max-h-80 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed dark:border-white/10 dark:bg-black/30">
            {run.deliverable.content.trim()}
          </pre>
        )}
      </div>

      {/* on-chain — live settlement */}
      <SettleLive pass={pass} start={() => startSettle(run)} chain={chain} />
    </div>
  );
}
