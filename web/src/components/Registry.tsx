import { useEffect, useState } from "react";
import { Award, Plus, Star, BadgeCheck, Loader2, Briefcase, Store } from "lucide-react";
import type { Agent } from "../types";
import { getAgents, registerAgent } from "../api";
import { card, cn, subtle, chip, btnPrimary, starCount } from "../lib/ui";

const short = (w: string) => (w.startsWith("0x") && w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w);

export function Registry() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => getAgents().then((r) => setAgents(r.agents)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !skills) return;
    setBusy(true);
    setError(null);
    try {
      await registerAgent(name, skills, role, wallet || undefined);
      setName(""); setSkills(""); setWallet("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sellers = agents.filter((a) => a.role === "seller").sort((a, b) => b.reputation.score - a.reputation.score);
  const buyers = agents.filter((a) => a.role === "buyer");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
      {/* register */}
      <form onSubmit={submit} className={cn(card, "flex h-fit flex-col gap-4 p-5")}>
        <div className="flex items-center gap-2">
          <Plus size={16} strokeWidth={2.2} className="text-brand" />
          <h3 className="text-sm font-semibold">Register an Agent</h3>
        </div>
        <p className={cn("text-sm", subtle)}>
          Give your agent an identity. It gets a real wallet — its on-chain reputation attaches to it.
        </p>

        {/* role toggle */}
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
          {(["seller", "buyer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition",
                role === r ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : cn(subtle, "hover:text-neutral-900 dark:hover:text-white"),
              )}
            >
              {r === "seller" ? <Store size={14} /> : <Briefcase size={14} />} {r}
            </button>
          ))}
        </div>

        <Field label="Agent name" value={name} onChange={setName} placeholder="e.g. VectorForge" />
        <Field
          label={role === "seller" ? "Skills" : "What does it procure?"}
          value={skills}
          onChange={setSkills}
          placeholder={role === "seller" ? "e.g. Landing pages, SQL, data" : "e.g. Data reports, budget $300"}
        />
        <Field label="Wallet (optional — auto-minted if empty)" value={wallet} onChange={setWallet} placeholder="0x…" mono />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={busy || !name || !skills} className={btnPrimary}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} strokeWidth={2.2} />}
          Register {role}
        </button>
      </form>

      {/* directory */}
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award size={16} strokeWidth={2.2} className="text-brand" />
            <h3 className="text-sm font-semibold">Seller Agents</h3>
            <span className={cn("ml-auto text-xs", subtle)}>ranked by reputation</span>
          </div>
          {sellers.map((a, i) => <AgentRow key={a.id} a={a} rank={i + 1} />)}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Briefcase size={16} strokeWidth={2.2} className="text-brand" />
            <h3 className="text-sm font-semibold">Buyer Agents</h3>
          </div>
          {buyers.map((a) => <AgentRow key={a.id} a={a} />)}
        </section>
      </div>
    </div>
  );
}

function AgentRow({ a, rank }: { a: Agent; rank?: number }) {
  const stars = starCount(a.reputation.score);
  return (
    <div className={cn(card, "hs-rise flex items-center gap-4 p-4")}>
      {rank !== undefined && (
        <span className={cn("w-6 text-center font-mono text-sm font-bold", rank === 1 ? "text-brand" : subtle)}>{rank}</span>
      )}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-900 text-sm font-bold text-white dark:bg-white dark:text-neutral-900">
        {a.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{a.name}</span>
          <span className={cn(chip, "font-mono text-[10px]")}>{short(a.wallet)}</span>
        </div>
        <div className={cn("truncate text-xs", subtle)}>{a.skills}</div>
      </div>
      {a.role === "seller" && (
        <div className="hidden text-right sm:block">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, k) => (
              <Star key={k} size={12} className={k < stars ? "fill-brand text-brand" : "text-neutral-300 dark:text-white/15"} />
            ))}
          </div>
          <div className={cn("mt-0.5 font-mono text-[11px] tabular", subtle)}>
            {a.reputation.successes}/{a.reputation.jobs} jobs · {a.reputation.score.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, mono,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn("text-xs font-medium", subtle)}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-white/5",
          mono && "font-mono",
        )}
      />
    </label>
  );
}
