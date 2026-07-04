import { useMemo, useState } from "react";
import type { Round } from "../types";
import { card, cn, subtle, label as labelCls, mono } from "../lib/ui";

/**
 * Price convergence over negotiation rounds — one line per seller, colors fixed
 * to the entity (never re-assigned by rank), budget as a dashed reference line.
 * Palette: --chart-1..4, CVD-validated for both themes (see index.css).
 */
const SERIES_VAR = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const W = 600;
const H = 200;
const M = { top: 14, right: 118, bottom: 26, left: 46 };

export function PriceChart({ rounds, totalRounds, budget }: { rounds: Round[]; totalRounds: number; budget: number }) {
  const [hover, setHover] = useState<number | null>(null); // round index

  const { sellers, ys, xs, ticks } = useMemo(() => {
    const sellerIds = rounds[0]?.offers.map((o) => o.sellerId) ?? [];
    const prices = rounds.flatMap((r) => r.offers.map((o) => o.price));
    const lo = Math.min(...prices, budget);
    const hi = Math.max(...prices, budget);
    const pad = Math.max(4, (hi - lo) * 0.1);
    const y0 = lo - pad;
    const y1 = hi + pad;
    const yOf = (p: number) => M.top + (H - M.top - M.bottom) * (1 - (p - y0) / (y1 - y0));
    const xOf = (i: number) =>
      M.left + (W - M.left - M.right) * (totalRounds <= 1 ? 0.5 : i / (totalRounds - 1));
    // 3 recessive gridlines at nice-ish values
    const step = (y1 - y0) / 3;
    const gridTicks = [y0 + step * 0.5, y0 + step * 1.5, y0 + step * 2.5].map((v) => Math.round(v));
    return { sellers: sellerIds, ys: yOf, xs: xOf, ticks: gridTicks };
  }, [rounds, totalRounds, budget]);

  if (rounds.length === 0 || sellers.length === 0) return null;

  const seriesOf = (sellerId: string) =>
    rounds.map((r, i) => {
      const o = r.offers.find((x) => x.sellerId === sellerId);
      return o ? { x: xs(i), y: ys(o.price), price: o.price, round: r.round } : null;
    }).filter((p): p is NonNullable<typeof p> => p !== null);

  const lastRound = rounds[rounds.length - 1];
  const finalLeader = lastRound.leader;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < rounds.length; i++) {
      const d = Math.abs(xs(i) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  }

  const hoverRound = hover !== null ? rounds[hover] : null;

  return (
    <div className={cn(card, "p-4")}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className={labelCls}>Bid convergence</span>
        {/* legend — identity via colored mark, text stays in text tokens */}
        <div className="flex flex-wrap items-center gap-3">
          {sellers.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1.5 text-[11px] font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_VAR[i % SERIES_VAR.length] }} />
              {id}
            </span>
          ))}
          <span className={cn("inline-flex items-center gap-1.5 text-[11px]", subtle)}>
            <span className="inline-block w-3 border-t border-dashed border-current" /> budget
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Seller bids across ${rounds.length} negotiation rounds`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive grid + y tick labels */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={ys(v)} y2={ys(v)} className="stroke-neutral-200/70 dark:stroke-white/[0.07]" strokeWidth={1} />
              <text x={M.left - 8} y={ys(v) + 3.5} textAnchor="end" className={cn("fill-neutral-400 dark:fill-neutral-500", mono)} fontSize={10}>
                ${v}
              </text>
            </g>
          ))}

          {/* budget reference line */}
          <line
            x1={M.left} x2={W - M.right} y1={ys(budget)} y2={ys(budget)}
            strokeDasharray="4 4" strokeWidth={1.25}
            className="stroke-neutral-400/70 dark:stroke-neutral-500/70"
          />
          <text x={W - M.right + 8} y={ys(budget) + 3.5} className={cn("fill-neutral-400 dark:fill-neutral-500", mono)} fontSize={10}>
            ${budget}
          </text>

          {/* x labels */}
          {rounds.map((r, i) => (
            <text key={r.round} x={xs(i)} y={H - 8} textAnchor="middle" className={cn("fill-neutral-400 dark:fill-neutral-500", mono)} fontSize={10}>
              R{r.round}
            </text>
          ))}

          {/* crosshair */}
          {hover !== null && (
            <line x1={xs(hover)} x2={xs(hover)} y1={M.top} y2={H - M.bottom} className="stroke-neutral-300 dark:stroke-white/20" strokeWidth={1} />
          )}

          {/* series — 2px lines, points with a 2px surface ring */}
          {sellers.map((id, si) => {
            const pts = seriesOf(id);
            const color = SERIES_VAR[si % SERIES_VAR.length];
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
            const end = pts[pts.length - 1];
            return (
              <g key={id}>
                {pts.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.map((p) => (
                  <circle
                    key={p.round}
                    cx={p.x} cy={p.y} r={3.5}
                    fill={color}
                    className="stroke-white dark:stroke-[#131318]"
                    strokeWidth={2}
                  />
                ))}
                {/* direct end label — text in text tokens, mark carries identity */}
                <circle cx={W - M.right + 10} cy={end.y} r={2.5} fill={color} />
                <text
                  x={W - M.right + 17} y={end.y + 3.5}
                  fontSize={10.5}
                  className={cn(
                    mono,
                    id === finalLeader
                      ? "fill-neutral-900 font-semibold dark:fill-white"
                      : "fill-neutral-500 dark:fill-neutral-400",
                  )}
                >
                  {id} ${end.price}
                </text>
              </g>
            );
          })}
        </svg>

        {/* tooltip — all sellers at the hovered round, cheapest first */}
        {hoverRound && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-2 text-[11px] shadow-md dark:border-white/10 dark:bg-[#1a1a20]/95"
            style={{
              left: `calc(${((xs(hover!) / W) * 100).toFixed(2)}% + 10px)`,
              transform: xs(hover!) > W * 0.6 ? "translateX(calc(-100% - 20px))" : undefined,
            }}
          >
            <div className={cn(labelCls, "mb-1")}>Round {hoverRound.round}</div>
            {[...hoverRound.offers].sort((a, b) => a.price - b.price).map((o) => {
              const si = sellers.indexOf(o.sellerId);
              return (
                <div key={o.sellerId} className="flex items-center gap-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SERIES_VAR[si % SERIES_VAR.length] }} />
                  <span className="font-medium">{o.sellerId}</span>
                  <span className={cn(mono, "ml-auto pl-3 font-semibold")}>${o.price}</span>
                  {o.sellerId === hoverRound.leader && <span className="text-[9px] font-bold uppercase text-brand">lead</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
