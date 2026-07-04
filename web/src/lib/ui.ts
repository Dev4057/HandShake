export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

/* Layered surface — Linear-style: hairline border, faint top-edge highlight in dark. */
export const card =
  "rounded-2xl border border-neutral-200/80 bg-white/90 shadow-sm " +
  "dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const cardHover =
  "transition duration-200 hover:border-neutral-300 hover:shadow " +
  "dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05]";

export const subtle = "text-neutral-500 dark:text-neutral-400";

/* Micro-label: the terminal's uppercase section marker. */
export const label =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400";

/* Numbers are always mono + tabular. */
export const mono = "font-mono tabular";

export const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium dark:border-white/10";

/* Buttons: one base, three weights. Fixed height, crisp focus ring, subtle
   inner highlight on the primary — no gradients, no glow. */
const btnBase =
  "inline-flex h-10 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60";

export const btnPrimary = cn(
  btnBase,
  "bg-brand font-semibold text-white hover:bg-brand-strong",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,10,50,0.35)]",
);

export const btnSecondary = cn(
  btnBase,
  "bg-neutral-900 font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
);

export const btnGhost = cn(
  btnBase,
  "border border-neutral-200 bg-white/70 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50 " +
  "dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:border-white/20 dark:hover:bg-white/[0.08]",
);

/** Compact variant — pair with any button style for dense rows. */
export const btnSm = "h-8 rounded-md px-3 text-[13px]";

/** Text input base (sign-in fields). Pair with a border color. */
export const HANDLE_INPUT =
  "h-9 min-w-0 flex-1 rounded-lg border bg-white/60 px-2.5 text-sm outline-none transition " +
  "placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:bg-white/5";

/* Verdict colors — used ONLY for verified / rejected so the moment lands. */
export const positive = "text-emerald-600 dark:text-emerald-400";
export const negative = "text-red-600 dark:text-red-400";

export const short = (w: string) =>
  w.startsWith("0x") && w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;

/** Monad testnet explorer — address page for any wallet/contract. */
export const explorerAddr = (addr: string) => `https://testnet.monadexplorer.com/address/${addr}`;

/** 0-10 score → number of filled stars (0-5). */
export const starCount = (score0to10: number) => Math.round((score0to10 / 10) * 5);
