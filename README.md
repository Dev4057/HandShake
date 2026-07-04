# 🤝 Handshake


**One buyer agent, many seller agents, one autonomous market — settled on Monad.**

A single **buyer agent** opens a job, runs a live bidding war between multiple **seller agents**,
negotiates them down over several rounds, **independently verifies** the delivered work, and settles
with the winner on-chain — with **no human in the loop**.

> The gap we close: AI agents can plan and execute, but the moment one needs to *procure* something —
> compare offers, negotiate, and pay — it stops and waits for a human. Handshake lets an agent run the
> whole market itself.

---

## The idea in one picture

Follow the numbers — this is the whole market as a single story. The buyer agent acts like a **Manager**:
it hires competing contractors, delegates the work, and refuses to pay until it has re-checked what they
delivered.

```mermaid
flowchart TB
    A1["1️⃣ Buyer posts a job<br/><i>budget + ranked priorities</i>"]
    A2["2️⃣ Sellers compete<br/><i>bid · undercut · differentiate</i>"]
    A3["3️⃣ Buyer negotiates<br/><i>score every offer, push over 3 rounds</i>"]
    A4["4️⃣ Winner delivers the work<br/><i>a landing page or a SQL query</i>"]
    A5["5️⃣ Buyer verifies the work<br/><i>runs the SQL for real / judges the page</i>"]
    OK{"Work good?"}
    PAY["✅ Monad pays the winner<br/>reputation ⬆"]
    SLASH["❌ Monad refunds the buyer<br/>bond slashed · reputation ⬇"]

    A1 --> A2 --> A3 --> A4 --> A5 --> OK
    OK -- yes --> PAY
    OK -- no --> SLASH
    PAY -. "reputation shapes who wins the next job" .-> A1
    SLASH -. "reputation shapes who wins the next job" .-> A1

    classDef step fill:#0b3d2e,color:#eafff2,stroke:#22c55e,stroke-width:2px;
    classDef good fill:#14532d,color:#eafff2,stroke:#22c55e,stroke-width:2px;
    classDef bad fill:#4c1d1d,color:#ffe4e4,stroke:#ef4444,stroke-width:2px;
    class A1,A2,A3,A4,A5 step;
    class PAY good;
    class SLASH bad;
```

**Read it as:** the buyer opens a job → sellers fight over it → the buyer haggles and picks a winner →
the winner does the work → the buyer **checks the work itself** → the chain pays or punishes accordingly →
and everyone's reputation carries into the next job. No human touches any step.

---

## The market lifecycle

The full runtime flow, start to finish — every arrow either moves one of the 4 data shapes or touches
the chain.

```mermaid
sequenceDiagram
    actor B as 🧑‍💼 Buyer Agent
    participant S as 🏷️ Seller Agents
    participant C as ⛓️ Monad

    B->>C: lock budget in escrow
    B->>S: broadcast JobSpec (the brief)
    S->>C: stake bonds (skin in the game)

    loop 3 rounds
        S-->>B: Offer (price · delivery · pitch)
        Note over B: score every offer<br/>(rubric + reputation)
        B-->>S: push the losers to sharpen their offer
    end

    Note over B: pick the highest-scoring offer
    S-->>B: Deliverable (HTML page / SQL query)
    Note over B: VERIFY — run the SQL for real,<br/>or AI-judge the page

    alt Verdict = PASS ✅
        B->>C: release payment · reputation ++
    else Verdict = FAIL ❌
        B->>C: refund buyer · slash bond · reputation --
    end
```

---

## The Manager's competencies (what's built)

Each is a management skill backed by an exact mechanism. See [docs/buyer-agent-design.md](docs/buyer-agent-design.md).

| # | Competency | Mechanism | AI? | Status |
|---|-----------|-----------|:---:|:---:|
| 1 | **Judgement** | scoring function → 0–100 | ❌ | ✅ |
| 2 | **Decision** | pick leader / who to push | ❌ | ✅ |
| 3 | **Negotiation** | bounded 3-round loop | ❌ | ✅ |
| 4 | **Quality control** | run SQL for real · check landing page | ⚠️ opt | ✅ |
| 5 | **Voice** | `gpt-4o-mini` commentary + fallback | ✅ | ✅ |
| 6 | **Accountability** | one `runMarket()` call | — | ✅ |

> Design principle: a solid, exact-code backbone (1–3) with a **thin, contained AI layer** (4–5) on top —
> never an all-AI black box. AI is **off by default** (dev costs $0) and every call has a deterministic fallback.

---

## Build roadmap

```mermaid
flowchart LR
    P0["Phase 0<br/>Data shapes"] --> P05["Phase 0.5<br/>On-chain spike"]
    P05 --> P1["Phase 1<br/>Buyer Agent"]
    P1 --> P2["Phase 2<br/>Real Seller Agents"]
    P1 --> P4["Phase 4<br/>On-chain contract"]
    P4 --> P5["Phase 5<br/>Frontend"]

    classDef done fill:#14532d,color:#eafff2,stroke:#22c55e,stroke-width:2px;
    classDef todo fill:#1f2937,color:#cbd5e1,stroke:#475569,stroke-width:1px;
    class P0,P05,P1 done;
    class P2,P4,P5 todo;
```

**✅ Done:** data shapes · on-chain spike (live on Monad testnet) · full Buyer Agent.
**⬜ Next:** on-chain escrow/bonds/reputation contract → live trading-floor UI.

---

## Run it

```bash
npm install

npm run demo          # watch the 3-round negotiation
npm run verify-demo   # watch the manager catch bad work
npm run market        # full flow (negotiate → hire → verify), both job types
npm run ai-demo       # the manager negotiating out loud   (AI off = free)
USE_AI=1 npm run ai-demo   # ...with real gpt-4o-mini commentary (~4 calls, ~800 tokens)

npm run typecheck
```

**Contracts (Foundry, via WSL):**
```bash
forge build
bash script/deploy-monad.sh   # deploys Hello.sol to Monad testnet (needs PRIVATE_KEY in .env)
```

---

## Project structure

```
src/
  types.ts            the 4 shared data shapes (JobSpec · Offer · Deliverable · Verdict)
  fixtures.ts         sample landing + SQL jobs
  reputation.ts       seller track records (→ on-chain in Phase 4)
  llm.ts              guarded gpt-4o-mini client (caps · fallback · off by default)
  buyer/
    scoring.ts        Competency 1 — the rubric
    decision.ts       Competency 2 — winner / who to push
    negotiate.ts      Competency 3 — the 3-round loop
    verify/           Competency 4 — sql.ts (runs it for real) · landing.ts (checks + AI judge)
    voice.ts          Competency 5 — natural-language commentary
    runMarket.ts      Competency 6 — the whole job in one call
  sellers/
    mockSeller.ts     deterministic stand-in sellers (Phase 2 makes them real)
contracts/Hello.sol   on-chain spike (real escrow contract lands in Phase 4)
script/deploy-monad.sh
docs/buyer-agent-design.md
```

---

## Stack

TypeScript · tsx · **Foundry** (forge/cast/anvil, run via WSL) · ethers.js · `node:sqlite` ·
OpenAI `gpt-4o-mini` · **Monad testnet**.
