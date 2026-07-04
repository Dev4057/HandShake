import { Handshake, Sun, Moon, Sparkles, LineChart, Users, Store } from "lucide-react";
import { useTheme } from "../theme";
import { cn } from "../lib/ui";

type Tab = "markets" | "floor" | "registry";

export function Header({
  tab,
  setTab,
  aiEnabled,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  aiEnabled: boolean;
}) {
  const { theme, toggle } = useTheme();

  const TabButton = ({ id, label, icon: Icon }: { id: Tab; label: string; icon: typeof LineChart }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
        tab === id
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
      )}
    >
      <Icon size={15} strokeWidth={2.2} />
      {label}
    </button>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <Handshake size={19} strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Handshake</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Autonomous Agent Market · Monad</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 rounded-xl border border-neutral-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5 sm:flex">
          <TabButton id="markets" label="Marketplace" icon={Store} />
          <TabButton id="floor" label="Trading Floor" icon={LineChart} />
          <TabButton id="registry" label="Registry" icon={Users} />
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex",
              aiEnabled
                ? "border-brand/30 bg-brand/10 text-brand-strong dark:text-brand-soft"
                : "border-neutral-200 text-neutral-500 dark:border-white/10 dark:text-neutral-400",
            )}
            title={aiEnabled ? "AI narration on" : "AI narration off (deterministic)"}
          >
            <Sparkles size={13} strokeWidth={2.2} />
            {aiEnabled ? "AI On" : "AI Off"}
          </span>
          <button
            onClick={toggle}
            className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-200 text-neutral-600 transition hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </header>
  );
}
