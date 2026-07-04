import { useEffect, useState } from "react";
import { cn, subtle, mono } from "../lib/ui";

/**
 * The hero animation — one market loop as an ORBIT, playing forever.
 * Escrow at the core, three seller agents on the ring, bids travelling the
 * spokes, the winner's spoke lighting up, a green payment pulse on settlement.
 * No card, no rectangle — a free-floating circular system.
 */

type Phase = "broadcast" | "bids" | "winner" | "settled";

interface Frame {
  tag: string;
  phase: Phase;
  prices: (number | null)[];
  line: string;
}

const FRAMES: Frame[] = [
  { tag: "BROADCAST", phase: "broadcast", prices: [null, null, null],
    line: "Arya Labs locks $500 in escrow — the brief goes out, 3 agents stake bonds" },
  { tag: "ROUND 1/3", phase: "bids", prices: [480, 300, 510],
    line: "Opening bids land — PixelPro leads on reputation and speed" },
  { tag: "ROUND 2/3", phase: "bids", prices: [480, 280, 495],
    line: "“CheapBot, PremiumCo — sharpen your terms.” The field concedes" },
  { tag: "ROUND 3/3", phase: "bids", prices: [480, 260, 470],
    line: "Final offers scored against priorities and on-chain reputation" },
  { tag: "WINNER", phase: "winner", prices: [480, 260, 470],
    line: "PixelPro hired — it produces the work and self-checks it" },
  { tag: "VERIFIED", phase: "winner", prices: [480, 260, 470],
    line: "Buyer verification: all 5 requirements met — 10/10" },
  { tag: "SETTLED", phase: "settled", prices: [480, 260, 470],
    line: "One transaction: winner paid, bonds returned, reputation +1" },
];

const STEP_MS = 2200;
const HOLD_LAST_MS = 3400;

// geometry — escrow core at C, sellers on a triangle at radius R
const C = { x: 230, y: 210 };
const R = 148;
const ANGLES = [-90, 30, 150]; // triangle: top, bottom-right, bottom-left
const SELLERS = [
  { id: "PixelPro", color: "var(--chart-1)" },
  { id: "CheapBot", color: "var(--chart-2)" },
  { id: "PremiumCo", color: "var(--chart-3)" },
];
const P = ANGLES.map((a) => {
  const r = (a * Math.PI) / 180;
  return { x: C.x + R * Math.cos(r), y: C.y + R * Math.sin(r) };
});
/** point at distance d from the node, radially outward from the core */
const out = (i: number, d: number) => {
  const r = (ANGLES[i] * Math.PI) / 180;
  return { x: P[i].x + d * Math.cos(r), y: P[i].y + d * Math.sin(r) };
};

const WINNER = 0;

export function HeroLoop() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(
      () => setStep((s) => (s + 1) % FRAMES.length),
      step === FRAMES.length - 1 ? HOLD_LAST_MS : STEP_MS,
    );
    return () => clearTimeout(t);
  }, [step]);

  const f = FRAMES[step];
  const settled = f.phase === "settled";
  const winnerKnown = f.phase === "winner" || settled;

  return (
    <div className="flex select-none flex-col items-center gap-1" aria-hidden>
      <svg viewBox="0 0 460 420" className="w-full max-w-md">
        {/* ambient orbit ring, slowly rotating */}
        <circle
          cx={C.x} cy={C.y} r={R}
          fill="none" strokeDasharray="3 7" strokeWidth={1}
          className="hs-orbit stroke-neutral-300 dark:stroke-white/15"
        />
        {/* faint outer halo ring */}
        <circle cx={C.x} cy={C.y} r={R + 34} fill="none" strokeWidth={1} className="stroke-neutral-200/60 dark:stroke-white/[0.06]" />

        {/* spokes */}
        {P.map((p, i) => {
          const isWinner = i === WINNER;
          const dimmed = winnerKnown && !isWinner;
          return (
            <line
              key={i}
              x1={C.x} y1={C.y} x2={p.x} y2={p.y}
              strokeWidth={isWinner && winnerKnown ? 1.75 : 1}
              className={cn(
                "transition-all duration-500",
                settled && isWinner
                  ? "stroke-emerald-500/80"
                  : winnerKnown && isWinner
                    ? "stroke-brand/70"
                    : dimmed
                      ? "stroke-neutral-200/50 dark:stroke-white/[0.05]"
                      : "stroke-neutral-300/80 dark:stroke-white/[0.12]",
              )}
            />
          );
        })}

        {/* travelling pulses — direction depends on the phase */}
        {f.phase === "broadcast" &&
          P.map((p, i) => (
            <circle key={`b${step}-${i}`} r={3.2} fill="var(--color-brand)">
              <animateMotion dur="1.5s" repeatCount="indefinite" path={`M ${C.x} ${C.y} L ${p.x} ${p.y}`} begin={`${i * 0.18}s`} />
            </circle>
          ))}
        {f.phase === "bids" &&
          P.map((p, i) => (
            <circle key={`o${step}-${i}`} r={3.2} fill={SELLERS[i].color}>
              <animateMotion dur="1.4s" repeatCount="indefinite" path={`M ${p.x} ${p.y} L ${C.x} ${C.y}`} begin={`${i * 0.15}s`} />
            </circle>
          ))}
        {settled && (
          <circle key={`pay${step}`} r={4} fill="#10b981">
            <animateMotion dur="1.1s" repeatCount="indefinite" path={`M ${C.x} ${C.y} L ${P[WINNER].x} ${P[WINNER].y}`} />
          </circle>
        )}

        {/* escrow core */}
        <circle cx={C.x} cy={C.y} r={52} fill="none" strokeWidth={1.5}
          className={cn("hs-breathe", settled ? "stroke-emerald-500/50" : "stroke-brand/40")} />
        <circle cx={C.x} cy={C.y} r={40}
          className={cn(
            "transition-colors duration-500",
            "fill-white stroke-neutral-200 dark:fill-[#131318]",
            settled ? "stroke-emerald-500/60" : "dark:stroke-white/15",
          )}
          strokeWidth={1.25}
        />
        <text x={C.x} y={C.y - 6} textAnchor="middle" fontSize={9.5} letterSpacing={1.5}
          className="fill-neutral-500 font-semibold dark:fill-neutral-400">
          {settled ? "SETTLED" : "ESCROW"}
        </text>
        <text x={C.x} y={C.y + 13} textAnchor="middle" fontSize={15}
          className={cn(mono, "font-bold", settled ? "fill-emerald-500" : "fill-neutral-900 dark:fill-white")}>
          $500
        </text>

        {/* seller nodes */}
        {P.map((p, i) => {
          const isWinner = i === WINNER;
          const highlight = winnerKnown && isWinner;
          const dimmed = winnerKnown && !isWinner;
          const price = f.prices[i];
          const lp = out(i, 52); // price label, radially outside the node
          return (
            <g key={SELLERS[i].id} className={cn("transition-opacity duration-500", dimmed && "opacity-40")}>
              {highlight && (
                <circle cx={p.x} cy={p.y} r={31} fill="none" strokeWidth={1.5}
                  className={cn("hs-breathe", settled ? "stroke-emerald-500/60" : "stroke-brand/60")} />
              )}
              <circle cx={p.x} cy={p.y} r={24}
                className="fill-white stroke-neutral-200 transition-colors duration-500 dark:fill-[#131318] dark:stroke-white/15"
                strokeWidth={1.25}
              />
              <circle cx={p.x} cy={p.y - 9} r={3} fill={SELLERS[i].color} />
              <text x={p.x} y={p.y + 8} textAnchor="middle" fontSize={9}
                className="fill-neutral-700 font-semibold dark:fill-neutral-200">
                {SELLERS[i].id}
              </text>
              {/* price / state label outside the ring */}
              <g key={`${price}-${settled}`} className="hs-rise">
                {settled && isWinner ? (
                  <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontSize={12}
                    className={cn(mono, "fill-emerald-500 font-bold")}>
                    PAID $480
                  </text>
                ) : price !== null ? (
                  <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontSize={12.5}
                    className={cn(mono, "font-bold", highlight ? "fill-[var(--color-brand)]" : "fill-neutral-600 dark:fill-neutral-300")}>
                    ${price}
                  </text>
                ) : (
                  <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontSize={10}
                    className={cn("fill-neutral-400 dark:fill-neutral-500")}>
                    bonding…
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      {/* caption — phase chip + narration, no box */}
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <span
          key={f.tag}
          className={cn(
            mono, "hs-rise rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide",
            settled || f.tag === "VERIFIED"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-brand/10 text-brand-strong dark:text-brand-soft",
          )}
        >
          {f.tag}
        </span>
        <p key={step} className={cn("hs-rise min-h-9 text-xs leading-relaxed", subtle)}>{f.line}</p>
        <div className="flex items-center gap-1">
          {FRAMES.map((_, i) => (
            <span key={i} className={cn("h-1 w-1 rounded-full transition-colors duration-300", i === step ? "bg-brand" : "bg-neutral-300 dark:bg-white/15")} />
          ))}
        </div>
      </div>
    </div>
  );
}
