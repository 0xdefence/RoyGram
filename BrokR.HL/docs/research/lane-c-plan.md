# BrokR — Lane C plan

**Working name:** BrokR
**Lane:** C — HyperEVM vault that mirrors inventory onto the HyperCore orderbook
**Date:** 22 Aug 2026
**Status:** Build this. Do not ship Lane A or Lane B as specified.
**Companion:** `hl-product-demand-research.md`, `monsoonbrief.md`

This is the plan a small team can run. It maps Jeff’s building blocks and current X sentiment onto a product, an architecture, and an 8-week MVP.

---

## 1. One-sentence product

**An ERC-4626 HyperEVM vault that holds user USDC, posts maker inventory onto HyperCore with two-phase commit, and enforces hard policy before any CoreWriter action — so depositors get a live, auditable book instead of a silent-fail hedge.**

Not a chat agent. Not a Valantis AMM. Not a $1 vault factory.

The factory (Buoy) and the fee OS (rini) are racing the *wrapper*. Trading Strategy already said the *kernel* is broken: you cannot tell if a CoreWriter action landed. That kernel is the product.

---

## 2. Why this, why now

Jeff named the category. Operators are already bleeding on the paper cuts. Legacy vaults are being deprecated. HIP-3 volume is the book we want to quote, and Vault 1.0 cannot touch it.

| Signal | Who | What it means for us |
|---|---|---|
| Custom vaults added to the HyperEVM architecture diagram | Jeff / HL docs, 19 Aug | The protocol is telling builders to leave Vault 1.0. Category is open. |
| “Vaults are a general case of CoreWriter + precompiles… ERC-4626… trade onchain or delegate agents… spot and HIP-3 in all quote assets. Strict improvement over legacy HyperCore vaults.” | [HL vaults docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults) | Spec is written. We implement it correctly. |
| “The sky is the limit with vault” | Jeff, quoted by Buoy | Labs will not enshrine the app layer. Community builds it. |
| “HyperEVM as a permissionless interface into HyperCore” | Jeff, Bell Curve | The interface *is* the product surface. |
| “I’m disappointed they abandoned the vault and we are now waiting for a non native HyperEVM vault.” | @pathtolibero, 19 Aug | Existing vault operators are the first customers. |
| “The category is named. Who’s building the system to run it seriously?” | @rini_xyz, 19 Aug | Positioning: the serious runtime, not the $1 create button. |
| 1,057,498 CoreWriter actions since launch | Hyperscan / @hl_eco, 2 Aug | Writes are happening. Correctness is not. |
| 500+ rebalances, 4,000+ Core↔EVM txs, still cannot confirm a CoreWriter action succeeded | [Trading Strategy, 13 Aug](https://tradingstrategy.ai/blog/hyperliquid-vault-of-vaults) | This is the unsolved job. |
| 350+ vaults, ~$100M user-vault TVL, ~$300M including HLP; Growi ~$100M / 30% lifetime | Trading Strategy | Demand for *vault exposure* is real. Demand for a reliable Core mirror is unmet. |
| May 2026: a Sharpe>3 vault erased gains on a discretionary HYPE bet | Trading Strategy / @hyperbulla | Policy / mandate enforcement is the other half of the product. |
| SK Hynix oracle print, −18% mark, ~$60M liquidations, reimbursed “as designed” | Coin Bureau, 29 Jul | Quote engine must have oracle-deviation circuit breakers. |
| Vault 1.0: fixed 10% profit share, no HIP-3, no spot, no custom fees | HL docs + rini | Do not build against 1.0. |

---

## 3. Who we sell to (in order)

1. **Existing HL vault operators** who are being pushed off Vault 1.0 and do not want to reinvent CoreWriter. (@pathtolibero class)
2. **HIP-3 market makers** who need an on-chain inventory object that can quote trade.xyz names without being the 500k-HYPE deployer.
3. **Depositors** who want HIP-3/spot-capable vaults with a public book, a kill switch, and no silent unhedged state.
4. **Later:** agent runtimes (Senpi, Nansen, AgentArcade) that keep over-levering — they buy the *policy kernel*, not a chat UI.

Do not start with retail NL trading. Do not start with “anyone creates a vault for $1.” That is Buoy’s race.

---

## 4. Building blocks we attack

Jeff’s stack, in the order we actually use them. Everything else is out of MVP.

### 4.1 Must-win (MVP)

| Block | Address / ID | Job in BrokR | Sentiment it answers |
|---|---|---|---|
| **Read precompiles** | `0x0000…0800+` | Live NAV, positions, spot balances, oracle, L1 block. Never mirror Core state in storage. | Trading Strategy: “impossible to know whether a bridged deposit reached Hyperliquid.” We verify by read, not by hope. |
| **CoreWriter** | `0x3333…3333` | All Core mutations. Treat as eventually-consistent, possibly-failing. | QuillAudits silent-fail. Trading Strategy paper cuts. |
| **Action 1 — Limit order** | delayed a few seconds | Post / replace maker quotes from vault inventory. | Lane C as specified: mirror reserves onto the book. |
| **Action 10/11 — Cancel by oid/cloid** | — | Reconcile after crash, kill switch, inventory flatten. | Precipitate: stalled state file leaves a position unmanaged. |
| **Action 7 — USD class transfer** | — | Move USDC between spot and perp margin on Core. | Vault that actually trades perps, not just holds ERC-20. |
| **Action 13 — Send asset** | `uint32.max` = spot | Move tokens between HyperEVM and HyperCore (and HIP-3 dex ids). | Unified-state claim Jeff made. This is the “bridge” that isn’t a bridge. |
| **ERC-4626 vault on HyperEVM** | our contract | Tokenized shares, custom accounting, deposit/redeem. | Official vault docs: “follow EIP-4626 with trustless read/write on HyperCore.” |
| **Two-phase commit** | our pattern | `pending → CoreWriter → precompile verify → confirmed` plus reclaim. | The textbook death: EVM deposit succeeds, hedge never lands. |
| **Salt-style policy kernel** | off-chain + on-chain caps | Max leverage, max size, spread, venue allowlist, oracle-deviation halt, kill switch. | Ghola pause (abnormal leverage). Nansen: “Qwen bets bigger.” Growi-class blowup. |

### 4.2 Phase 2 (after first live quotes)

| Block | Why later |
|---|---|
| **Action 9 — Add API wallet** | Delegate a keeper / agent without giving it withdrawal rights. Buoy already does “restricted agent wallet.” We need it once a human is not the only signer. |
| **Action 12 — Approve builder fee** | Monetize flow if we ever expose a frontend. Distribution, not moat. |
| **Action 16 — Set abstraction** | Isolated vs unified vs portfolio margin. Isolated-only in MVP. Cross-margin is how the $200M ETH exploit worked. |
| **Action 2 — Vault transfer** | Only if we still talk to a *legacy* Core vault. Prefer not to. Vault 1.0 is the sunset. |
| **HIP-3 asset ids / HIP-4 outcomes (action 17)** | After BTC/ETH core book is green. HIP-3 is where the volume is, but oracle risk is higher (SK Hynix). |
| **Onchain TWAP** | Jeff’s 19 Aug paper: visible TWAPs tighten liquidity. Use for de-risking large inventory, not for the quoting loop. |
| **Action 3/4/5 — staking** | Idle HYPE later. Do not compete with Kinetiq/Valantis in v1. |

### 4.3 Explicitly do not attack

- HIP-3 **deployer** (500k HYPE ≈ $28–40M bond). Quote their books, don’t launch one.
- Valantis Sovereign Pool / inventory-skew AMM on HyperEVM. Valantis sunset kHYPE AMM. Yield is Kinetiq/HyperLend.
- NL agent frontend. Senpi/Nansen/AgentArcade already occupy it; volume collapsed.
- Vault-of-vaults allocator. Trading Strategy shipped it; their bottleneck is our kernel.
- Native Vault 1.0 features (fixed 10% rake, no HIP-3). Building on a sunset.

---

## 5. Competitive map — take the hole, not the race

```
                    permissionless create
                           ▲
                           │  Buoy ($1 vault, HIP-3/4, perf fee)
                           │
     factory UX            │            allocator
     rini (custom fees) ───┼──────── Trading Strategy (vault-of-vaults)
                           │
                           │
     ◄─────────────────────┼─────────────────────►  strategy quality
                           │
                           │
                           │         BrokR  ← we live here
                           │         (sync kernel + policy +
                           │          one honest MM vault)
                           │
                           ▼
                    CoreWriter correctness
```

**Buoy** wins “anyone can launch.” Isolated ERC-20, manager cannot withdraw, agent wallet, 0.01 HYPE per request, manager-set performance fee above HWM. They advertise a 56.84% APR stock/FX MM vault with no public risk framework.

**rini** wins “custom fee structure, $0 setup, HIP-3/4.” Private beta.

**Trading Strategy** wins allocation across 350 vaults. They told the world CoreWriter confirmation does not exist.

**Growi** wins TVL with a black-box strategy on the old vault object.

**BrokR wins the thing none of them own:** EVM inventory and Core book stay consistent, every Core action is verified or rolled back, and the mandate cannot silently become a directional HYPE bet.

If Buoy or rini want to license the kernel later, that is a feature, not a threat.

---

## 6. Product shape

### What a depositor sees

1. Deposit USDC on HyperEVM. Shares mint only after Core margin is confirmed.
2. Live page: NAV, inventory, open quotes, fills, leverage, oracle vs mark, last CoreWriter success/fail.
3. Withdraw: quotes cancelled, inventory flattened or transferred, USDC back on EVM after Core confirm. Not instant. Show the pending state. Never pretend atomicity.
4. Mandate in plain language: “maker inventory on {markets}, max {X}x, max {Y}% of book, halt if oracle moves >Z% in one Core block.”

### What an operator sees

1. Policy file (the Salt layer, productionized): leverage, size, spread, venues, oracle halt, max inventory skew, kill switch.
2. Keeper that: reads Core via precompile, computes target quotes, encodes CoreWriter actions, submits, waits delay, verifies, retries or reclaims.
3. Crash path: on restart, reconcile by cloid, cancel unknowns, flatten if policy requires.

### What we never show

- “Deposit and you’re live on the book this transaction.”
- APR screenshots without a public wallet.
- NL chat.

---

## 7. Architecture

```
                    ┌─────────────────────────────────┐
                    │  App (Next.js)                  │
                    │  deposit / redeem / mandate /   │
                    │  live book / CoreWriter log     │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │  Policy kernel (Salt, upgraded) │
                    │  DepositPolicy                  │
                    │  RebalancePolicy                │
                    │  OBOrderPolicy                  │
                    │  OracleHaltPolicy               │
                    │  LeveragePolicy                 │
                    │  KillSwitch                     │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
┌─────────────────────────────┐           ┌─────────────────────────────┐
│  BrokRVault.sol (HyperEVM)  │           │  Keeper / executor          │
│  ERC-4626 + ERC-7540 async  │           │  (TypeScript, from Monsoon) │
│  pendingDeposits[]          │  events   │                             │
│  confirmedShares[]          │◄──────────┤  1. read precompiles        │
│  totalAssets() =            │  verify   │  2. target inventory/quotes │
│    evm + coreNAV + inflight │           │  3. policy gate             │
│    − fees                   │           │  4. CoreWriter send         │
│  CoreWriter encode          │──────────►│  5. wait delay              │
│  reclaimPending()           │           │  6. verify or retry/reclaim │
└────────────┬────────────────┘           └────────────┬────────────────┘
             │                                         │
             │  sendRawAction                          │  read 0x800+
             ▼                                         ▼
        CoreWriter 0x333…                         L1Read precompiles
             │                                         │
             │  delayed: orders, vault transfers       │
             ▼                                         │
        HyperCore: spot, perps, HIP-3 book  ◄──────────┘
```

### Non-negotiable invariants

1. `totalAssets()` is a live precompile read plus EVM cash plus an inflight buffer. No cached Core NAV in storage as source of truth.
2. A CoreWriter send never finalizes shares, never marks a hedge “on”, never pays a withdraw. Only a later precompile read does.
3. Invalid precompile inputs are allowlisted. Never forward unbounded gas. Failed precompile consumes all gas in that frame.
4. Quotes carry a `cloid` we own. Crash recovery is “cancel every cloid we issued, then rebuild.”
5. Isolated margin only in MVP. One market cluster, one quote asset (USDC).
6. If oracle (precompile mid/mark) moves more than policy `maxOracleMoveBps` vs last confirmed, halt quoting and flatten if `flattenOnHalt`.
7. ADL: a position can disappear between blocks. Share price and inventory math must tolerate `size == 0` without reverting.
8. Dual blocks: quoting and cancels on small blocks (~1s, 2M gas). Vault deploy / batch settle on large blocks (~1 min, 30M gas).

### CoreWriter delay

Orders and vault transfers are delayed a few seconds so EVM cannot skip the L1 mempool. They show twice on explorers (enqueue, then execute). The keeper’s state machine is:

```
idle → encoded → submitted → enqueued → executed_or_rejected → verified
                                                              ↘ retry / reclaim
```

Never collapse `submitted` into `executed`.

---

## 8. What we steal from Monsoon (and what we throw away)

**Keep**

| Monsoon piece | New job |
|---|---|
| `MonsoonALM` deposit / withdraw / allocateToOB / deallocateFromOB | Rewrite as ERC-4626 + two-phase + CoreWriter. Same verbs, different engine. |
| `HyperCoreQuoter.getMidPrice()` via `0x800` | Keep, wrap in allowlisted `SafeL1Read`. |
| `src/executor/index.ts` | Becomes the keeper: event listener + quote loop + verify. |
| Salt `DepositPolicy`, `RebalancePolicy`, `OBOrderPolicy` | Productionize. Add `OracleHaltPolicy`, `LeveragePolicy`, `KillSwitch`. |
| Dashboard pages: Vault, Guardians | Vault + mandate + CoreWriter log. Drop Agent/Trade chat. |

**Throw away**

- Pear Protocol NL “Buy $100 ETH”
- OpenRouter agent chat
- Valantis Sovereign Pool, MockFactory, mUSDC/mWETH
- Chorus One / Aave idle-yield adapters
- Arbitrum Sepolia as the home chain — this ships on HyperEVM mainnet (and testnet for rehearsal)

Hackathon contracts at `0x77259d…` stay as a museum. Do not extend them.

---

## 9. Policy kernel (the Lane A steal)

This is the only piece we take from Lane A, and it is not a chatbot.

Mandate is a versioned YAML/JSON the vault owner posts onchain as a hash, keeper enforces, UI renders.

```yaml
mandate_id: brokr-core-mm-v1
quote_asset: USDC
markets:
  - { asset: BTC, max_leverage: 3, max_notional_usd: 250000, max_inventory_skew: 0.25 }
spread_bps: { min: 2, max: 25, inventory_mult: 1.5 }
max_share_of_book: 0.08
max_oracle_move_bps: 150          # halt if mark jumps 1.5% vs last confirm
flatten_on_halt: true
max_pending_core_actions: 8
max_inflight_usd: 50000
kill_switch: { owners: [0xabc...], cooldown_sec: 0 }
venues_allow: [hypercore-perp]
venues_deny: [hip3-until-phase2]
```

Gated actions, same idea as Monsoon:

- `gatedDeposit` — size + daily + pending cap
- `gatedQuote` — spread, size, leverage, venue, oracle
- `gatedFlatten` — always allowed to reduce
- `gatedRedeem` — only from confirmed shares

On-chain hard caps exist even if the keeper is compromised: max leverage, max notional, asset allowlist, authorized keeper. The keeper is an API wallet (action 9, phase 2) that can trade, not withdraw.

This is the answer to Ghola’s pause, Nansen’s Qwen leverage, and the May 2026 vault that decided to long HYPE.

---

## 10. MVP — 8 weeks, one market, real money small

Goal at week 8: **one public USDC vault quoting BTC-USD on HyperCore, deposits that only mint after Core confirm, a public CoreWriter log, a kill switch that actually flattens.**

Capital target: $25k–$100k of team + friends, not $150k+ of strangers. Trading Strategy throttled $5k/day for the same reason.

### Week 1–2 — kernel

- `SafeL1Read.sol`: allowlisted asset ids, gas-capped precompile calls, decimal conversion in one place.
- `CoreWriterLib.sol`: encode actions 1, 7, 10, 11, 13. Version byte `0x01`.
- `ActionTracker`: cloid allocator, pending map, timeout.
- Tests: foundry mocks of `0x800` / `0x333` behavior — especially “write succeeds, later read shows no fill / no balance.”
- **Exit check:** a script deposits mock USDC, sends action 13, waits, reads spot balance. Fail path reclaims.

### Week 3–4 — vault

- `BrokRVault.sol`: ERC-4626 + ERC-7540 async redeem (Core delay makes sync redeem a lie).
- Two-phase deposit / redeem. `reclaimPending()` after `PENDING_TIMEOUT`.
- `totalAssets()` = EVM + Core NAV + inflight − fees.
- Isolated margin, BTC only.
- **Exit check:** deposit 1,000 USDC on HyperEVM testnet → Core USDC appears → shares mint. Kill RPC mid-flight → reclaim works.

### Week 5 — quoting loop

- Inventory-skew spreads (this is the only ALM idea we keep, and it lives in the keeper, not a Sovereign Pool).
- Maker quotes via action 1, `tif = Alo` or `Gtc`, unique cloid.
- Replace on inventory change; cancel on halt.
- Policy gate before every send.
- **Exit check:** vault quotes both sides, fill moves inventory, spread widens on the heavy side, NAV updates from precompile.

### Week 6 — failure catalog (do this before mainnet)

Replay, in this order:

1. CoreWriter reject (size too small, insufficient margin)
2. Delay window: user clicks withdraw while quotes still live
3. Keeper crash with open cloids
4. Oracle jump > `max_oracle_move_bps`
5. ADL zeroes a position
6. Invalid asset id precompile (must not OOG the whole tx)
7. Small-block gas limit exceeded

If any of these leave unhedged confirmed shares, we do not ship.

### Week 7 — app + mandate page

- Deposit / redeem with pending states visible.
- Live quotes, fills, leverage, oracle, last 50 CoreWriter actions (hash, action id, enqueue vs execute).
- Mandate rendered in English. Kill switch button (owner).
- Builder code optional, default off.

### Week 8 — mainnet canary

- Deploy vault, policy hash, keeper.
- Seed $25k.
- Public wallet, public mandate, public log.
- 7 days of quoting with daily written incident notes.
- **Ship gate:** no silent unhedged interval > 1 Core delay window; no policy breach; redeem of 10% of TVL completes.

---

## 11. After MVP

Only if week 8 is green.

1. **Agent wallet (action 9).** Keeper is a Core API wallet. Contract remains the only withdrawer.
2. **Second market** — ETH, then *one* HIP-3 name with a tight oracle-halt (do not start with SK Hynix-class single-name equity).
3. **Spot inventory** — action 13 + spot book, so idle USDC can sit in Core spot instead of dead EVM cash.
4. **HIP-3 quoting as a service** — sell the kernel to a trade.xyz MM who does not want to write CoreWriter themselves.
5. **Policy-as-a-service** for agent teams. They keep their UI; we are the off switch Nansen/Ghola don’t have.

Do not add a vault factory until the kernel has 30 days of mainnet without a silent-fail incident. Buoy can have the $1 button.

---

## 12. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Contracts | Foundry, Solidity, HyperEVM (chain id 999) | HL docs, ERC-4626, existing Monsoon Foundry layout |
| Keeper | TypeScript, `nktkas` / official HL SDK + viem | Monsoon executor is already TS |
| Reads | Direct precompile calls, Hyperscan for humans | Do not trust our own mirror |
| App | Next.js (reuse dashboard shell) | Already there |
| Policy | JSON on IPFS/hash onchain + TS validator + Solidity caps | Salt pattern |
| Testnet | `https://rpc.hyperliquid-testnet.xyz/evm` | Official |
| Mainnet RPC | Dedicated node, not a public rate-limit | Trading Strategy: no Anvil forks; live is the test |
| Accounting | ERC-7540 async redeem | Core delay makes 4626 `redeem()` in the same tx a bug |

There is no good HyperCore fork. Budget calendar time for live testnet as the real test harness. That is not optional.

---

## 13. Risks and kill criteria

| Risk | Mitigation | Kill if |
|---|---|---|
| CoreWriter silent fail | Two-phase + reclaim + public log | We cannot demonstrate reclaim on testnet |
| Oracle shock (SK Hynix class) | Halt + flatten policy | We cannot halt inside one delay window |
| ADL | NAV allows zeroed size | Share price freezes or underpays redeemers |
| Keeper key leak | On-chain caps; later action-9 agent wallet; never withdrawer | A leaked key can drain EVM USDC |
| Vault 1.0 operators never migrate | Talk to @pathtolibero-class in week 3, not week 8 | No operator will even look at a testnet deposit |
| Buoy eats the narrative | We do not fight $1 create. We publish the failure catalog they don’t. | Our only differentiator becomes “another MM vault APR” |
| HIP-3 deployer concentration (trade.xyz) | Quote, don’t deploy. Circuit-break their oracle. | We depend on one builder’s `oracleUpdater` without a halt |
| Dual-block gas | Quotes on small blocks only | A quote tx needs large-block cadence |
| Legal / US | No solicitation of US depositors until that’s a real company problem | — |

**Stop the project if** after 8 weeks we still cannot prove “EVM says pending, Core says no, user got USDC back.” That is the whole product.

---

## 14. Messaging (use this, not hackathon language)

**To Jeff / HL builders:**
HyperEVM as the interface into HyperCore, implemented as an ERC-4626 vault that actually verifies CoreWriter, with isolated maker inventory on the native book.

**To vault operators:**
Vault 1.0 is being taken away. Here is HIP-3/spot-capable accounting that does not leave you unhedged when a write fails.

**To depositors:**
You can see the book, the mandate, and every Core action. Shares mint when the hedge exists. If it never does, you reclaim.

**Do not say:** AI agent, autonomous, 56% APR, “atomic hedge,” “just like ERC-4626 on Ethereum.”

---

## 15. Team split (three seats)

| Seat | Owns | Does not own |
|---|---|---|
| Contracts | Vault, SafeL1Read, CoreWriterLib, on-chain caps | Quote model |
| Keeper | State machine, policy, inventory-skew quotes, crash reconcile | Share math |
| App / operator | Pending UX, public log, mandate English, canary ops | Solidity |

One person can wear two seats for the canary. Nobody ships quotes without the failure catalog.

---

## 16. Week-0 checklist (do tomorrow)

1. Read [HL vaults](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults) and [CoreWriter](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore) end to end. Print the action table.
2. Clone L1Read.sol / CoreWriter.sol from those docs into `contracts/src/hypercore/`.
3. Stand up HyperEVM testnet RPC and a funded test account.
4. Run one action 13 (sendAsset) and one action 1 (limit order) from a throwaway contract. Watch enqueue vs execute on Hyperscan / explorer.
5. DM or publicly reply to the operator complaint: we are building the HyperEVM vault they asked for, testnet in 6 weeks. If they will deposit $1k on testnet, they become the design partner.
6. Freeze scope: BTC, USDC, isolated, no factory, no agent chat, no Valantis.

---

## 17. Success at 90 days

- Kernel: zero silent unhedged confirmed shares.
- Vault: public BTC maker vault, $100k–$500k, redeemable.
- At least one external operator running *their* mandate on our keeper, or a written “no” that tells us why.
- A published post: “CoreWriter will fail; here is the state machine.” That post *is* distribution in this ecosystem.

If those three are true, we earned the right to HIP-3 and agent-wallet. If they are not, we do not add surface area.
