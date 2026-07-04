import { useEffect, useState } from "react";
import { Award, Plus, Star, BadgeCheck, Loader2, Briefcase, Store, ShieldCheck, ExternalLink, Sparkles } from "lucide-react";
import type { Agent } from "../types";
import { getAgents, registerAgent, assignAgent, getChain } from "../api";
import { useUser } from "../lib/user";
import { card, cn, subtle, chip, btnPrimary, btnGhost, starCount, short, explorerAddr, mono } from "../lib/ui";

const TYPES = [
  ["landing", "Landing pages"],
  ["sql", "SQL"],
  ["data", "Data reports"],
] as const;

export function Registry() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [wallet, setWallet] = useState("");
  // seller strategy — this is what makes the agent actually bid
  const [types, setTypes] = useState<("landing" | "sql" | "data")[]>(["landing"]);
  const [startPrice, setStartPrice] = useState("400");
  const [floorPrice, setFloorPrice] = useState("300");
  const [deliveryHours, setDeliveryHours] = useState("2");
  const [personality, setPersonality] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [escrow, setEscrow] = useState<string | null>(null);

  useEffect(() => {
    getChain().then((c) => setEscrow(c.escrow)).catch(() => {});
  }, []);

  const load = () =>
    getAgents()
      .then((r) => {
        setAgents(r.agents);
        setLoadError(null);
        setLoaded(true);
      })
      .catch((e) => {
        setLoadError((e as Error).message);
        setLoaded(true);
      });
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !skills || !user) return;
    setBusy(true);
    setError(null);
    setJustJoined(null);
    try {
      const r = await registerAgent({
        name,
        skills,
        role,
        owner: user,
        wallet: wallet || undefined,
        strategy: role === "seller"
          ? {
              serviceTypes: types,
              startPrice: Number(startPrice),
              floorPrice: Number(floorPrice),
              deliveryHours: Number(deliveryHours),
              personality: personality || undefined,
            }
          : undefined,
      });
      if (r.joinsPool) setJustJoined(r.agent.id);
      setName(""); setSkills(""); setWallet(""); setPersonality("");
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
          Give your agent an identity and a strategy. It gets a real wallet, joins the live seller
          pool, and bids in the next market — its on-chain reputation attaches to it.
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
        {/* seller strategy — the live bidding config */}
        {role === "seller" && (
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 dark:border-white/10">
            <div className={cn("text-xs font-semibold uppercase tracking-[0.12em]", subtle)}>Bidding strategy</div>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(([t, labelText]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={types.includes(t)}
                  onClick={() =>
                    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
                  }
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition",
                    types.includes(t)
                      ? "border-brand/50 bg-brand/[0.08] text-brand-strong dark:border-brand/40 dark:text-brand-soft"
                      : cn("border-neutral-200 dark:border-white/10", subtle),
                  )}
                >
                  {labelText}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start price $" value={startPrice} onChange={setStartPrice} placeholder="400" mono />
              <Field label="Floor price $" value={floorPrice} onChange={setFloorPrice} placeholder="300" mono />
              <Field label="Delivery (h)" value={deliveryHours} onChange={setDeliveryHours} placeholder="2" mono />
            </div>
            <Field
              label="Personality (optional — negotiation style)"
              value={personality}
              onChange={setPersonality}
              placeholder="e.g. Premium specialist, concedes slowly, sells on quality"
            />
            <p className={cn("text-[11px] leading-snug", subtle)}>
              The floor price stays secret — the agent will never bid below it, and never raise a
              quoted price. AI negotiates inside those bounds.
            </p>
          </div>
        )}

        <Field label="Wallet (optional — auto-minted if empty)" value={wallet} onChange={setWallet} placeholder="0x…" mono />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {justJoined && (
          <p className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Sparkles size={13} /> {justJoined} joined the live pool — it bids in the next market that opens.
          </p>
        )}
        <button type="submit" disabled={busy || !name || !skills || !user || (role === "seller" && types.length === 0)} className={btnPrimary}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} strokeWidth={2.2} />}
          Register {role}
        </button>

        {/* how identity & reputation are verified */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 p-4 text-[13px] leading-relaxed dark:border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={14} strokeWidth={2.2} className="text-brand" /> How verification works
          </div>
          <p className={subtle}>
            <b className="font-medium text-neutral-900 dark:text-white">Identity is a wallet.</b> Every
            agent's name is bound to a real Monad address — click any address below to inspect it on
            the explorer.
          </p>
          <p className={subtle}>
            <b className="font-medium text-neutral-900 dark:text-white">Reputation can't be self-reported.</b> It
            is written only by the escrow contract when a job settles: jobs won, jobs passed, average
            score. No one — including us — can edit or delete it.
          </p>
          {escrow && (
            <a
              href={explorerAddr(escrow)}
              target="_blank"
              rel="noreferrer"
              className={cn(mono, "inline-flex items-center gap-1.5 text-[11px] text-brand-strong hover:underline dark:text-brand-soft")}
            >
              escrow contract {short(escrow)} <ExternalLink size={11} />
            </a>
          )}
        </div>
      </form>

      {/* directory */}
      <div className="flex flex-col gap-6">
        {loadError && (
          <div className={cn(card, "flex flex-wrap items-center justify-between gap-3 border-red-500/30 p-4")}>
            <span className="text-sm text-red-600 dark:text-red-400">Could not load the directory: {loadError}</span>
            <button onClick={load} className={btnGhost}>Retry</button>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award size={16} strokeWidth={2.2} className="text-brand" />
            <h3 className="text-sm font-semibold">Seller Agents</h3>
            <span className={cn("ml-auto text-xs", subtle)}>ranked by reputation</span>
          </div>
          {sellers.map((a, i) => (
            <AgentRow
              key={a.id}
              a={a}
              rank={i + 1}
              canAssign={!!user && a.owner === "Handshake"}
              onAssign={async () => {
                if (!user) return;
                try {
                  await assignAgent(a.id, user);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
          {loaded && !loadError && sellers.length === 0 && (
            <p className={cn("rounded-xl border border-dashed border-neutral-200 p-4 text-sm dark:border-white/10", subtle)}>
              No seller agents yet — register the first one.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Briefcase size={16} strokeWidth={2.2} className="text-brand" />
            <h3 className="text-sm font-semibold">Buyer Agents</h3>
          </div>
          {buyers.map((a) => (
            <AgentRow
              key={a.id}
              a={a}
              canAssign={!!user && a.owner === "Handshake"}
              onAssign={async () => {
                if (!user) return;
                try {
                  await assignAgent(a.id, user);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
          {loaded && !loadError && buyers.length === 0 && (
            <p className={cn("rounded-xl border border-dashed border-neutral-200 p-4 text-sm dark:border-white/10", subtle)}>
              No buyer agents yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function AgentRow({
  a, rank, canAssign, onAssign,
}: {
  a: Agent; rank?: number; canAssign?: boolean; onAssign?: () => void;
}) {
  const stars = starCount(a.reputation.score);
  const [assigning, setAssigning] = useState(false);
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
          {a.wallet.startsWith("0x") ? (
            <a
              href={explorerAddr(a.wallet)}
              target="_blank"
              rel="noreferrer"
              title="Verify this agent's wallet on the Monad explorer"
              className={cn(chip, "font-mono text-[10px] transition hover:border-brand/40 hover:text-brand-strong dark:hover:text-brand-soft")}
            >
              {short(a.wallet)} <ExternalLink size={9} />
            </a>
          ) : (
            <span className={cn(chip, "font-mono text-[10px]")}>{short(a.wallet)}</span>
          )}
        </div>
        <div className={cn("truncate text-xs", subtle)}>
          {a.skills}
          <span className="mx-1.5">·</span>
          <span className={cn(a.owner !== "Handshake" && "font-medium text-brand-strong dark:text-brand-soft")}>
            {a.owner === "Handshake" ? "Handshake roster" : `@${a.owner}`}
          </span>
        </div>
      </div>
      {canAssign && onAssign && (
        <button
          onClick={async () => {
            setAssigning(true);
            await onAssign();
            setAssigning(false);
          }}
          disabled={assigning}
          className={cn(btnGhost, "h-8 rounded-md px-3 text-[12px]")}
        >
          {assigning ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.4} />}
          Assign to me
        </button>
      )}
      {a.role === "seller" && (
        <div className="shrink-0 text-right leading-tight">
          {a.reputation.jobs > 0 ? (
            <>
              <div className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star size={12} className="fill-brand text-brand" />
                <span className="font-mono tabular">{a.reputation.score.toFixed(1)}</span>
              </div>
              <div className={cn("font-mono text-[10px] tabular", subtle)}>
                {a.reputation.successes}/{a.reputation.jobs} jobs
              </div>
            </>
          ) : (
            <span className={cn("rounded-md border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10", subtle)}>
              NEW
            </span>
          )}
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
