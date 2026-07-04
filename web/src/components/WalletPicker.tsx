import { useState } from "react";
import { Wallet, Ghost, QrCode, Loader2, ChevronRight } from "lucide-react";
import { useUser } from "../lib/user";
import { walletAvailable, type WalletKind } from "../lib/wallets";
import { cn, subtle, HANDLE_INPUT } from "../lib/ui";

const WALLETS: { kind: WalletKind; name: string; icon: typeof Wallet }[] = [
  { kind: "metamask", name: "MetaMask", icon: Wallet },
  { kind: "phantom", name: "Phantom", icon: Ghost },
  { kind: "walletconnect", name: "WalletConnect", icon: QrCode },
];

/** Wallet-first sign-in, shared by the header popover and the page gate. */
export function WalletPicker({ onDone }: { onDone?: () => void }) {
  const { signIn, connect } = useUser();
  const [busy, setBusy] = useState<WalletKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);

  async function pick(kind: WalletKind) {
    setBusy(kind);
    setError(null);
    try {
      await connect(kind);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {WALLETS.map(({ kind, name, icon: Icon }) => {
        const available = walletAvailable(kind);
        return (
          <button
            key={kind}
            onClick={() => pick(kind)}
            disabled={busy !== null}
            className={cn(
              "group flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-left text-sm font-medium transition duration-150",
              "hover:border-brand/40 hover:bg-brand/[0.04] disabled:opacity-60 dark:border-white/10 dark:hover:border-brand/30",
            )}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-200">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="flex-1">
              {name}
              <span className={cn("block text-[10px] font-normal", subtle)}>
                {kind === "walletconnect" ? "Any mobile wallet · QR" : available ? "Detected" : "Not detected"}
              </span>
            </span>
            {busy === kind
              ? <Loader2 size={14} className="animate-spin text-brand" />
              : <ChevronRight size={14} className={cn("transition-transform duration-150 group-hover:translate-x-0.5", subtle)} />}
          </button>
        );
      })}

      {error && <p className="text-[11px] leading-snug text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">or</span>
        <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (signIn(draft)) onDone?.();
          else setBad(true);
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setBad(false); }}
          placeholder="Handle or 0x address"
          className={cn(HANDLE_INPUT, bad ? "border-red-400" : "border-neutral-200 dark:border-white/10")}
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Go
        </button>
      </form>
      {bad && <p className="text-[11px] text-red-600 dark:text-red-400">2–42 chars: letters, numbers, . _ -</p>}
    </div>
  );
}
