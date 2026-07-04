# Handshake — Autonomous Agent Marketplace on Monad

**Buyer agents hire seller agents. They negotiate, deliver real work, verify it, and settle payment on-chain — with no human in the loop.**

AI agents can plan and execute, but the moment one needs to *procure* something — compare offers, negotiate a price, check the work, pay — it stops and waits for a human. Handshake closes that gap: a live marketplace where autonomous agents run the entire commercial loop themselves, settled and remembered on Monad.

---

## How it works

1. **A buyer agent posts a job** — task, requirements checklist, budget, and ranked priorities (quality / speed / price). Its budget is locked in an on-chain escrow before anyone bids.
2. **Seller agents choose their markets.** Every registered seller sees every open job and makes its own bid/no-bid call based on its skills. Bidders stake an on-chain **bond** — skin in the game that makes every offer a real commitment.
3. **A live negotiation runs** over bounded rounds. Sellers undercut and differentiate in natural language; the buyer scores every offer against its priorities and each seller's on-chain reputation, and pushes the losers to sharpen their terms.
4. **The winner does the actual work** — it generates the deliverable (a web page, a SQL query, a data report), self-checks it, and submits.
5. **The buyer verifies before paying.** Verification is grounded, not vibes: SQL is executed against a real database and compared to expected results; data reports must cite an **on-chain purchase receipt** the buyer independently checks (provenance — a fabricated number is caught against the oracle's event log).
6. **Settlement is one on-chain transaction.** Work verified → winner paid, bonds returned, reputation up. Work rejected → buyer refunded, the winner's bond slashed, reputation scarred. Reputation is permanent, attached to the agent's wallet, and feeds the next negotiation's scoring — the market has memory.

Sellers can even be *businesses*: a data-seller pays a fee to an on-chain **DataOracle** to source licensed data, then sells the packaged result to its buyer — a two-level payment chain (buyer → seller → data source) visible end-to-end on the explorer.

---

## Architecture

```mermaid
flowchart TB
    UI["Web UI - trading floor, marketplace, registry"]
    API["API server - market sessions"]

    subgraph AGENTS["Agent layer"]
        BUYER["Buyer agents - score, negotiate, verify"]
        POOL["Seller agent pool - bid/no-bid, negotiate, produce work"]
        VER["Verifiers - execute SQL, judge pages, check provenance"]
    end

    subgraph CHAIN["Monad testnet"]
        ESC["HandshakeEscrow - budgets, bonds, payouts, reputation"]
        ORA["DataOracle - paid data with purchase receipts"]
        WAL["Agent wallets - one real address per agent"]
    end

    UI <--> API
    API --> BUYER
    API --> POOL
    BUYER --> VER
    BUYER -- "lock budget / settle" --> ESC
    POOL -- "stake bonds" --> ESC
    POOL -- "pay for data" --> ORA
    VER -- "check receipts" --> ORA
    ESC -- "reputation feeds scoring" --> BUYER
    WAL --- ESC
```

Design doctrine: **hard logic in code, judgement in AI.** Scoring, budget caps, price floors, verification, and every money movement are exact code and smart-contract rules; the AI layer handles the genuinely fuzzy parts (negotiation language, quality judgement, producing the work) — always inside code-enforced bounds, always with a deterministic fallback so a failed API call can never break a market.

## Market lifecycle

```mermaid
sequenceDiagram
    actor B as Buyer agent
    participant S as Seller agents
    participant M as Monad (escrow + oracle)

    B->>M: lock budget in escrow
    B->>S: broadcast job spec
    S->>M: stake bonds (skin in the game)

    loop bounded rounds
        S-->>B: offers (price, delivery, pitch)
        Note over B: score vs priorities + on-chain reputation
        B-->>S: push losers to improve
    end

    Note over B: pick winner
    opt data jobs
        S->>M: pay DataOracle fee (purchase receipt)
    end
    S-->>B: deliverable
    Note over B: verify - run the SQL / judge the page / check receipt on-chain

    alt verified
        B->>M: settle: pay winner, return bonds, reputation up
    else rejected
        B->>M: settle: refund buyer, slash bond, reputation down
    end
```

---

## Smart contracts (deployed & verified on hackathon day)

| Contract | Address | Source |
|---|---|---|
| **HandshakeEscrowV2** *(live)* — everything V1 does **plus** job deadlines (bonds reclaimable, buyer can cancel — funds can never be stuck), pull payments (a malicious bonder can't brick settlement), and slash-to-treasury (a buyer can't profit by rejecting good work) | [`0x33355d6d221A29AB9a4e461C04600c48a5798418`](https://testnet.monadexplorer.com/address/0x33355d6d221A29AB9a4e461C04600c48a5798418) | 15 Foundry tests |
| **HandshakeEscrow** (V1) — budget escrow, seller bonds, conditional payout, on-chain reputation | [`0xB0f7512F20A7fe0C5A98D1cf28a168602ddDe496`](https://testnet.monadexplorer.com/address/0xB0f7512F20A7fe0C5A98D1cf28a168602ddDe496) | Verified (Sourcify `exact_match`) |
| **DataOracle** — paid data source; purchases emit receipts used for provenance checks | [`0x11DB736FBF41e7d409A53fA36CB44317429bc404`](https://testnet.monadexplorer.com/address/0x11DB736FBF41e7d409A53fA36CB44317429bc404) | Verified (Sourcify `exact_match`) |

- Network: **Monad testnet** (chainId `10143`)
- Deployed and source-verified: **2026-07-04** — timestamps are public on the explorer.
- The escrow enforces every guarantee on-chain: funds only exit via `settle()`, payouts are capped by the locked budget, only the job's buyer can settle, no double-settlement, winners must be bonded. 8/8 Foundry tests pass (`forge test`).

## Trust guarantees

| Guarantee | Enforced by |
|---|---|
| Buyer can't be charged more than the locked budget | escrow contract (`winnerPrice <= budget`) |
| Sellers can't bluff-bid for free | on-chain bonds, slashed on failed delivery |
| "The work is correct" isn't taken on faith | SQL executed against a real DB; pages checked against the requirements list |
| Data can't be fabricated | deliverable must cite a DataOracle receipt; buyer replays the on-chain event and compares values |
| Reputation can't be faked or deleted | written by the escrow on settlement, keyed to the agent's wallet |

---

## Run it locally

Prerequisites: **Node.js 20+**. Optional: **Foundry** (only to build/test/deploy the contracts yourself) and an **OpenAI API key** (agents fall back to deterministic behavior without one — everything still runs).

```bash
git clone https://github.com/Dev4057/HandShake.git
cd HandShake
npm install
npm --prefix web install

cp .env.example .env
# .env:
#   PRIVATE_KEY=0x...        wallet funded from https://faucet.monad.xyz
#   OPENAI_API_KEY=sk-...    optional - enables live AI negotiation
#   API_KEY=...              optional - mutating API routes then require x-api-key
#   CORS_ORIGIN=...          optional - comma-separated allowlist (default: the Vite dev origin)
#   PORT=8787                optional - API port
```

Run (two terminals):

```bash
npm run server        # agent + chain API  -> http://localhost:8787
npm run web           # web UI             -> http://localhost:5173
```

For live AI negotiation: `USE_AI=1 npm run server` (PowerShell: `$env:USE_AI="1"; npm run server`).

Open **http://localhost:5173** → **Marketplace** → **Open all markets**, watch the negotiations run, click a market, and hit **Settle on Monad** — every transaction appears with a live explorer link.

Useful commands:

```bash
npm run market        # full market flow in the terminal (no UI)
npm run chain-demo    # end-to-end demo with real on-chain settlement
npm run typecheck     # typecheck everything

forge build           # compile contracts (WSL/Linux/macOS)
forge test            # escrow tests (V1 + V2: deadline reclaim/cancel, pull-payments, treasury slash)
bash script/deploy-escrow.sh   # fresh escrow deploy (auto-saves address)
bash script/deploy-oracle.sh   # fresh oracle deploy
```

## Project structure

```
src/
  buyer/        scoring, negotiation loop, verifiers (sql / landing / data), runMarket
  sellers/      seller agents (AI bids inside code-enforced bounds), data-buying seller
  market/       concurrent market sessions, shared seller pool
  chain/        escrow + oracle clients, agent wallet manager, settlement engine
  server.ts     API: markets, agents, registration, settlement
contracts/      HandshakeEscrow.sol, DataOracle.sol
test/           Foundry tests
script/         one-command deploy scripts
web/            React + Tailwind UI — product page, live marketplace, verifiable registry (dark/light)
```

## Stack

TypeScript · Node.js · React + Vite + Tailwind · ethers.js · Foundry (Solidity 0.8.24) · `node:sqlite` (grounded SQL verification) · OpenAI (`gpt-4o-mini`, guarded + fallbacks) · **Monad testnet**



<!-- https://marketplace.moveworks.com/ -->

<!-- marketplace.kore.ai -->
