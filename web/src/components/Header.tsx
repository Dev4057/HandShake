import { useState } from "react";
import { Handshake, Sun, Moon, Wifi, WifiOff, LogIn, LogOut, Wallet } from "lucide-react";
import { useTheme } from "../theme";
import { useUser } from "../lib/user";
import { WalletPicker } from "./WalletPicker";
import type { Connection } from "../lib/markets";
import { cn, mono, short } from "../lib/ui";

/** Minimal chrome: identity, theme, connection health. Navigation lives on Home. */
export function Header({ onHome, connection }: { onHome: () => void; connection: Connection }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/70 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0a0a0e]/70">
      <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <button onClick={onHome} className="flex items-center gap-3 text-left" aria-label="Handshake home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
            <Handshake size={17} strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">Handshake</span>
            <span className={cn("hidden text-[11px] text-neutral-500 sm:block dark:text-neutral-400")}>
              Autonomous agent marketplace
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {connection !== "live" && connection !== "connecting" && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium tracking-wide",
                mono,
                connection === "offline"
                  ? "border-red-500/30 bg-red-500/[0.07] text-red-600 dark:text-red-400"
                  : "border-amber-500/30 bg-amber-500/[0.07] text-amber-700 dark:text-amber-400",
              )}
            >
              {connection === "offline" ? <WifiOff size={12} strokeWidth={2.2} /> : <Wifi size={12} strokeWidth={2.2} />}
              {connection === "offline" ? "OFFLINE" : "POLLING"}
            </span>
          )}
          <button
            onClick={toggle}
            className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition duration-200 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
          </button>
          <AccountControl />
        </div>
      </div>
    </header>
  );
}

function AccountControl() {
  const { user, signOut } = useUser();
  const [open, setOpen] = useState(false);

  if (user) {
    const isAddr = user.startsWith("0x");
    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/[0.07] px-2.5 text-xs font-semibold text-brand-strong dark:text-brand-soft", isAddr && mono)}>
          {isAddr ? <Wallet size={12} strokeWidth={2.2} /> : (
            <span className="grid h-4.5 w-4.5 place-items-center rounded bg-brand text-[8px] font-bold text-white">
              {user.slice(0, 2).toUpperCase()}
            </span>
          )}
          {isAddr ? short(user) : `@${user}`}
        </span>
        <button
          onClick={signOut}
          className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 text-neutral-600 transition duration-200 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
          aria-label="Sign out"
        >
          <LogOut size={14} strokeWidth={2.2} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-semibold text-neutral-700 transition duration-200 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
        aria-expanded={open}
      >
        <LogIn size={13} strokeWidth={2.2} /> Sign in
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-[#16161c]">
          <WalletPicker onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
