# The Buyer Agent — "The Manager"

> Design doc for Handshake's core agent.
> Mental model: the Buyer Agent is not a chatbot. It is a **Manager / Owner** who
> posts a job, hires competing contractors (the Seller Agents), delegates the work,
> **inspects it before paying**, and remembers who did well for next time.
>
> This is the *supervisor–worker* multi-agent pattern: one agent that owns the
> decision, several worker agents that do the labour, and a hard rule that the
> manager **trusts nothing until verified.**

---

## Part A — The Manager's Operating Principles

Each principle is a skill a great manager has, paired with the exact technical
mechanism that gives our agent that skill, and why it matters.

### 1. Writes a crisp brief before hiring anyone
**Manager:** knows precisely what they want and puts it in writing so there's no ambiguity.
**Agent:** every job is a strict `JobSpec` (task, requirements checklist, budget, priorities). It is the single source of truth every later step is checked against.
**Why:** vague briefs produce vague work and unwinnable disputes. The checklist *is* the acceptance criteria.

### 2. Sets a budget and ranked priorities up front
**Manager:** "I'll pay up to X, and I care about quality first, speed second, price third."
**Agent:** `budget` + `priorities {quality, speed, price}` (weights summing to 100), decided *before* seeing any bid.
**Why:** deciding your priorities *after* offers arrive is how you get talked into a bad deal. Fixed weights keep the manager honest and consistent.

### 3. Runs a competitive process, never a single quote
**Manager:** always gets multiple bids so no one contractor has leverage.
**Agent:** broadcasts the job to all Seller Agents in parallel; collects several `Offer`s per round.
**Why:** competition is what drives the price down and quality up — it's the whole point of the market.

### 4. Requires skin in the game
**Manager:** serious contractors put down a deposit; tyre-kickers don't.
**Agent:** each seller stakes a **bond** on-chain to be allowed to bid; the bond is slashed if they win and deliver bad work.
**Why:** filters out spam/lowball bluffing and makes every bid a real commitment, enforced by the contract, not trust.

### 5. Evaluates on a scorecard, not on gut feel
**Manager:** scores each bid against the same objective rubric.
**Agent:** a pure-code **scoring function** turns each `Offer` (+ the seller's reputation) into a single 0–100 number using the priority weights. No AI, no vibes — exact math.
**Why:** consistent, explainable, tamper-proof decisions. You can always say *why* a bid won.

### 6. Negotiates — plays contractors against each other
**Manager:** "Your competitor quoted less — can you do better?" Pushes across a few rounds.
**Agent:** a bounded **negotiation loop** (exactly 3 rounds): score → push the leaders for better terms → re-score.
**Why:** extracts a better deal than accepting first offers, while a hard round-limit keeps it from looping forever.

### 7. Delegates the doing, but owns the decision
**Manager:** hands the work to the winner but keeps accountability for the outcome.
**Agent:** the winning Seller Agent produces the `Deliverable`; the Buyer Agent never does the labour itself — but it, and only it, decides pass/fail and release of funds.
**Why:** clean separation of responsibility. Workers work; the manager judges.

### 8. Trust, but verify — inspects work before paying  ★ the most important one
**Manager:** never pays an invoice without checking the work is actually done.
**Agent:** a **verifier** step produces a `Verdict`:
  - SQL job → *actually runs the query* against a real database and checks the rows. Objective.
  - Landing page → an AI judge scores it against the requirements checklist, forced into a strict `{pass, score, notes}` shape.
**Why:** this is what makes reputation *mean* something. Without independent verification, "reputation" is just marketing. The manager's power comes from being able to re-check the employee's work.

### 9. Pays for good work, withholds for bad
**Manager:** releases payment on acceptance; disputes or refuses on failure.
**Agent:** `Verdict.pass === true` → escrow releases funds + reputation goes up. `false` → refund the buyer, slash the seller's bond, reputation goes down.
**Why:** consequences are what align the workers' incentives with the manager's goals.

### 10. Keeps a performance record for next time
**Manager:** remembers who delivered and who flaked; favours proven contractors.
**Agent:** every outcome writes to an on-chain **reputation** record `{jobs, successes, score}`, which feeds straight back into the scoring function (Principle 5) on the next job.
**Why:** turns a one-off market into a self-improving economy — good workers earn trust and win more; bad ones get priced out.

### 11. Separates exact rules from judgement calls
**Manager:** does the arithmetic on a calculator; reserves human judgement for genuinely fuzzy calls.
**Agent:** **hard logic in code** (scoring, budget checks, running SQL); **AI only for the fuzzy parts** (writing negotiation messages, judging a webpage's quality). The AI never does math it could get wrong.
**Why:** this single rule is the difference between a reliable agent and a flaky one.

### 12. Has a contingency for everything
**Manager:** if a contractor no-shows, has a backup plan so the project still ships.
**Agent:** every AI call has a **deterministic fallback** (a canned message / safe default) so a slow or failing model API can never crash the market mid-run.
**Why:** demos and production both punish brittleness. The show must go on.

---

## Part B — The Build Plan (installing the Manager's competencies, in order)

We build the manager's skills from the **inside out**: the exact, testable core
first; the fuzzy AI layer last. After each step there is a concrete "done when" check.

| # | Competency we install | What it is (technical) | AI? | Done when |
|---|---|---|---|---|
| **1** | **Judgement (scoring)** | `scoreOffer(offer, priorities, reputation) → 0–100` | No | Ranks the 3 fake coffee-site offers sensibly; unit-tested |
| **2** | **Decision-making** | `pickLeaders()` / `pickWinner()` over scored offers | No | Correctly names the winner and who to push, given scores |
| **3** | **Negotiation** | `runNegotiation(job, offers)` — 3 bounded rounds | No | Full haggle runs in terminal with fake sellers (walking skeleton) |
| **4** | **Quality control (verify)** | `verify(job, deliverable) → Verdict`; SQL runs for real, landing page AI-judged | 1 call | Passes a good SQL query, fails a wrong one, objectively |
| **5** | **Communication (voice)** | mini-model turns decisions into natural feed messages, with fallback | Yes | Feed reads like a real manager talking; survives API being off |
| **6** | **Accountability (interface)** | `runMarket(job, sellers) → {winner, verdict, log}` | — | One clean call returns the winner + full decision trail |

### Guiding rules while building
- **Steps 1–3 contain no AI at all.** The manager's backbone is plain, exact code. This is deliberate — it's what makes the agent trustworthy.
- **Test each competency in isolation** before wiring the next. No big-bang integration.
- **Every decision is logged** with its reason — this log is both our debugger and the demo's negotiation feed.
- **The AI layer (4–5) is thin and contained**, always with a fallback. The agent is *mostly solid code that AI makes feel smart* — never an all-AI black box.

### The finished manager, in one line
> `runMarket(job, sellers)` → posts the brief, runs a competitive 3-round negotiation
> scored on a fixed rubric, hires the winner, **independently verifies the delivered
> work**, pays or penalises on-chain, and updates everyone's permanent record.
