import { cn, subtle } from "../lib/ui";

const LABELS: Record<string, string> = { quality: "Quality", speed: "Speed", price: "Price" };

export function PriorityBars({ priorities }: { priorities: { quality: number; speed: number; price: number } }) {
  return (
    <div className="flex flex-col gap-2.5">
      {(Object.keys(LABELS) as (keyof typeof priorities)[]).map((k) => (
        <div key={k} className="flex items-center gap-3">
          <span className={cn("w-14 text-xs", subtle)}>{LABELS[k]}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand" style={{ width: `${priorities[k]}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-xs tabular">{priorities[k]}</span>
        </div>
      ))}
    </div>
  );
}
