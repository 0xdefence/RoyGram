# BrokR Lane C — Design Spec & Build Plan

**Source:** `lane-c-plan.md` (22 Aug 2026)
**Scope:** MVP as specified in plan §10 (one USDC vault, BTC-USD maker inventory, isolated margin, HyperEVM mainnet with testnet rehearsal)

Divergences from `lane-c-plan.md` are marked **[DIVERGENCE]** and argued in place. Everything unmarked is an implementation of the plan as written.

---

# 1. DESIGN SPEC

## System overview and core architecture

### The one problem this system exists to solve

HyperCore exposes two interfaces to HyperEVM with opposite properties:

| | Read precompiles `0x0800+` | CoreWriter `0x3333…3333` |
|---|---|---|
| Timing | Synchronous, same EVM frame | Asynchronous, delayed seconds |
| Result | Returns a value | Returns nothing |
| Failure | Reverts (and burns the frame's gas) | Silent |
| Truth | Authoritative | A request, not an outcome |

Every architectural decision below follows from one consequence of that table: **an EVM transaction can never learn the outcome of a Core action it just requested.** The outcome is only knowable by a *later* read, performed by a *different* transaction, against state that has also been moved by fills, funding, ADL, and liquidation in the meantime.

So the system is not a contract that trades. It is a **reconciliation loop with a contract-enforced safety envelope**, where the contract is the only party that can touch money and the loop is the only party that can tell whether anything worked.

### Components

```
                        ┌──────────────────────────────────────────┐
                        │  App (Next.js, read-only)                │
                        │  NAV · mandate · action log · pending     │
                        └───────────────────┬──────────────────────┘
                                            │ HTTP
                        ┌───────────────────▼──────────────────────┐
                        │  Indexer  [ADDED, see divergence D5]     │
                        │  EVM logs + periodic Core snapshots       │
                        │  → reproducible public action log         │
                        └───────────────────▲──────────────────────┘
                                            │ eth_getLogs / eth_call at block N
  ┌─────────────────────────────────────────┴──────────────────────────────────┐
  │                                HyperEVM                                     │
  │  ┌────────────────────────────┐        ┌───────────────────────────────┐   │
  │  │ BrokRVault.sol             │        │ Guardian / Watchdog           │   │
  │  │  ERC-4626 + ERC-7540(redeem)│       │  halt() and cancelAll() only  │   │
  │  │  share ledger              │◄───────┤  independent host, no keys    │   │
  │  │  redeem epochs             │ halt   │  to trade                     │   │
  │  │  hard caps (on-chain)      │        └───────────────────────────────┘   │
  │  │  execute(actions,…)        │◄──────────────────┐                        │
  │  │  reconcile(seq[],verdict[])│◄──────────────┐   │                        │
  │  │  uses SafeL1Read (view)    │               │   │                        │
  │  │  uses CoreWriterLib        │               │   │                        │
  │  └────┬───────────────────┬───┘               │   │                        │
  └───────┼───────────────────┼───────────────────┼───┼────────────────────────┘
          │ sendRawAction     │ staticcall        │   │ signed txs
          ▼                   ▼                   │   │
   CoreWriter 0x333…    L1Read 0x800+             │   │
          │                   ▲                   │   │
          │ delayed           │ authoritative     │   │
          ▼                   │                   │   │
  ┌───────────────────────────┴───┐    ┌──────────┴───┴──────────────────────┐
  │  HyperCore                    │    │  Keeper (TypeScript)                │
  │  spot USDC (transit corridor) │    │  1 observe (precompile @ block N)   │
  │  perp margin (value lives here)│───►│  2 target inventory + quotes        │
  │  BTC-USD order book           │    │  3 policy gate (off-chain)          │
  └───────────────────────────────┘    │  4 submit → vault.execute()         │
                    │                  │  5 wait deadline                    │
                    │ Info API (WS)    │  6 observe again, diff, verdict     │
                    └─────────────────►│  7 reconcile() or halt              │
                       advisory only   └─────────────────────────────────────┘
```

Five components, two of which the plan's §15 team split does not staff (Indexer, Watchdog). See D5 and D6.

### Where state lives

This is the part that decides whether the system is correct, so it is enumerated exhaustively.

| State | Physical home | Source of truth | Can it be rebuilt if lost? |
|---|---|---|---|
| Share balances, `totalSupply` | Vault storage | Vault | No. Only persistent authoritative state in the system. |
| Redeem requests, redeem epochs | Vault storage | Vault | No. |
| `inflightOut` (value that left EVM, not yet seen on Core) | Vault storage | Vault | No. Must be crash-durable because it is part of NAV. |
| On-chain hard caps, policy hash, halt flag, `quoteEpoch` | Vault storage | Vault | No. |
| EVM cash | `USDC.balanceOf(vault)` | USDC contract | N/A |
| Core spot USDC | HyperCore | `spotBalance` precompile | N/A. **Never cached.** |
| Core perp account value, position, leverage | HyperCore | `accountMarginSummary` / `position` precompiles | N/A. **Never cached.** |
| Mark / oracle / BBO | HyperCore | `markPx` / `oraclePx` / `bbo` precompiles | N/A |
| Open orders (oids, resting sizes) | HyperCore | **No precompile exists.** Info API only. | Yes, via deterministic cloid space. See below. |
| Intent → cloid → expectation mapping | Vault events (canonical) + keeper DB (cache) | Vault events | Yes, by log replay. |
| Action verdicts (the public log) | Vault events + indexer DB | Vault events | Yes, by log replay. |
| Policy document (expressive tier) | JSON on IPFS | Hash on-chain | Yes, from hash + pin. |
| Keeper's in-memory quote ladder | Keeper process | Derivable from Core + policy | Yes, discarded on restart by design. |

**The keeper is deliberately stateless-recoverable.** Nothing the keeper knows is load-bearing. On restart it reads the vault (epoch, caps, halt flag), reads Core, and rebuilds. The justification is that a keeper that must persist state correctly has a second durable-storage failure domain, and `lane-c-plan.md` §4.1 already cites Precipitate's stalled state file as exactly this bug.

### The open-orders gap and how the design routes around it

The documented read precompiles cover balances, positions, margin, prices, and block height. **They do not enumerate open orders.** The keeper can list resting orders only through the off-chain Info API (`openOrders`, `orderUpdates`, `userFills`), which is a trusted, non-verifiable, occasionally-unavailable source.

`lane-c-plan.md` §7 invariant 1 says "no cached Core state as source of truth" and invariant 4 says recovery is "cancel every cloid we issued." Taken literally, invariant 4 requires a durable list of issued cloids, which contradicts invariant 1's spirit and reintroduces the Precipitate failure. The design resolves this by making cloids **derivable rather than recorded**:

```
cloid = uint128( keccak256(abi.encode(vault, quoteEpoch, assetId, side, levelIndex)) )
```

`quoteEpoch` is a `uint32` in vault storage, incremented on every keeper start, every halt, and every policy change. `levelIndex` is bounded by `maxLevelsPerSide` (a hard cap, MVP: 3).

Consequences:
- Crash recovery with **zero** local state: read `quoteEpoch` from the vault, regenerate every cloid for epochs `[epoch − K, epoch]` (K = 2 covers a crash mid-rotation), issue `cancelByCloid` for all of them. That is `2 sides × 3 levels × 3 epochs = 18` cancels, a bounded and affordable sweep.
- Cancel-by-cloid on a cloid that never existed is a no-op, so the sweep is safe to run blindly.
- Anyone (including a depositor, or the watchdog) can compute the vault's full cloid space from public data and verify that the book is clear. That is a real auditability property, not a claim.
- Cost: no more than `maxLevelsPerSide` quotes per side per epoch. Accepted; MVP is a 3-level ladder on one market.

**Split of authority between the two read sources:**

> Precompiles are authoritative for anything that moves NAV or solvency. The Info API is authoritative for order lifecycle only, and the system must remain safe when it is wrong or absent.

Safety when the Info API is wrong is provided by three things: on-chain notional caps checked *before* the send bound the worst case; the cloid sweep clears the book without needing to know what is on it; and NAV is computed only from precompiles, so a phantom order cannot mis-price a share.

### Two-phase commit, restated

`lane-c-plan.md` §7 gives the state machine as `idle → encoded → submitted → enqueued → executed_or_rejected → verified`. Two of those transitions are not observable and one critical state is missing.

**[DIVERGENCE D1] Replace the state machine with:**

```
INTENT ──► SUBMITTED ──► OBSERVING ──┬──► CONFIRMED
                                     ├──► REFUTED
                                     └──► INDETERMINATE ──► (resolution depends on action class)
```

- `submitted` and `enqueued` collapse. Both correspond to the same EVM transaction being mined; the explorer's two-line display is a Core-side rendering, not a second signal available to us.
- `executed_or_rejected` is deleted. There is no receipt. What exists is a state *diff* observed later.
- **`INDETERMINATE` is added and is the state that matters.** When the verification deadline passes and the expected delta has not appeared, the only sound conclusion is "not yet observed." Concluding "failed" and retrying is precisely how a single deposit becomes a double transfer.

**Action classes, by idempotency, because the resolution of INDETERMINATE differs entirely:**

| Class | Actions | Idempotent? | INDETERMINATE resolution |
|---|---|---|---|
| **Order** | 1 (limit), 10/11 (cancel) | Yes, keyed by cloid | Issue `cancelByCloid`. This is the key trick: **an indeterminate order can always be converted into a determinate absence by cancelling it.** Cheap, safe, repeatable. |
| **Value transfer** | 7 (USD class), 13 (send asset) | **No** | **Never retry.** Hold, keep the inflight buffer standing, escalate to a human. Recovery is convergence (below), never repetition. |

**[DIVERGENCE D2] Value transfers are expressed as convergence to a target balance, never as a retryable command.** The keeper does not "resend the failed 1,000 USDC transfer." It re-reads Core, computes `desired_core_balance − observed_core_balance`, and sends that difference. A transfer that lands late is therefore absorbed by the next convergence step rather than doubled. This is the single most important correctness rule in the system and `lane-c-plan.md` §7's "retry / reclaim" branch does not distinguish it from the order case.

### The reconciliation model

Verification is a comparison of an **expected-state model** against an **observed-state read**, not a per-action lookup. It exploits a structural fact: the vault contract is the only entity authorized to act on its Core account, so *every* change to that account is either ours or exogenous, and exogenous changes are exactly the events we need to detect.

| Quantity | Model type | Why | Unexplained delta means |
|---|---|---|---|
| Core spot USDC | **Exact** | Spot is used as a transit corridor only. It changes solely from our own actions 7 and 13. No spot trading in MVP. | Bug or an unexpected inbound. Halt. |
| Perp position size | **Band**, width = sum of our resting order sizes | Can only move by our own fills, liquidation, or ADL | Movement beyond the band with no matching fill = liquidation/ADL. Halt, re-derive, review. |
| Perp account value | **Tolerance band** | Moves continuously from PnL, funding, fees | Jump beyond tolerance = ADL, liquidation, or oracle event. Halt. |
| Resting cloid set | **Advisory** (Info API) | No precompile | Divergence from expectation → sweep and rebuild. |

**[ADDITION] Spot as a transit-only corridor is a design invariant, not an accident.** Keeping all trading in perp margin and using spot purely as the EVM↔Core corridor is what makes exact delta attribution possible on the one balance where non-idempotent transfers land. `lane-c-plan.md` §11 item 3 proposes putting idle USDC into Core spot post-MVP; that change deletes this invariant and must be accompanied by a replacement attribution scheme.

### NAV

```
totalAssets() =
      USDC.balanceOf(vault)                          // EVM cash
    + toEvm( spotBalance(vault, USDC) )              // Core spot corridor
    + toEvm( accountMarginSummary(vault).accountValue ) // perp equity incl. unrealised PnL
    + inflightOut                                    // left EVM, not yet observed on Core
    - reservedForClaimedRedeems                      // fulfilled but unclaimed
```

Properties that must hold and are property-tested:
1. No term is a cached Core value. (plan invariant 1)
2. `inflightOut` is monotonically decreasing except when a transfer is submitted, and is settled FIFO against observed spot-balance deltas.
3. `totalAssets()` tolerates `position.szi == 0` without reverting or dividing by zero. (plan invariant 7)
4. `totalAssets()` never reverts on a single precompile failure; a failed read halts the vault into withdraw-only rather than bricking it. See F11.
5. Double-count is impossible by construction because each dollar is in exactly one of: EVM balance, Core spot, perp equity, or `inflightOut`.

**Open measurement, Phase 0:** whether `inflightOut` is needed at all depends on whether the EVM-side debit for an EVM→Core transfer happens at enqueue time or at Core execution time. If both legs move atomically at execution, the dark window does not exist and the buffer is dead code. The two candidate mechanisms (CoreWriter action 13 vs. ERC-20 transfer to the token's system address) may differ on exactly this. Build the buffer, measure, then delete it if measurement says so.

### Deposits: the largest divergence

**[DIVERGENCE D3] Deposits mint shares synchronously against EVM cash. Only *redemption* is ERC-7540 async. `lane-c-plan.md` §6 and §10 specify async on both sides ("Shares mint only after Core margin is confirmed").**

The argument:

The plan's stated rationale is "the textbook death: EVM deposit succeeds, hedge never lands." That failure is real, and it is the correct model for a **delta-neutral** vault: the depositor contributes a long asset on EVM, the vault owes a short leg on Core, and if the short never lands the depositor is silently long. BrokR's MVP is not that shape. It takes USDC, and it deploys USDC as maker inventory. There is no per-deposit hedge obligation. If the Core deployment never lands, the depositor holds shares backed by USDC sitting in the vault contract on HyperEVM: fully solvent, correctly priced, merely undeployed.

Meanwhile the async-deposit path buys a concrete new hazard. If USDC is debited from EVM, sent toward Core, and then `reclaimPending()` refunds the depositor after a timeout, the refund is paid out of *other shareholders'* EVM cash, and if the transfer later lands the depositor has taken a free option (full refund, zero exposure, at LP expense). Building a refund path for a non-idempotent transfer is exactly the trap D2 warns about, applied to user money.

What the design keeps from the plan's intent:
- The two-phase machinery is fully built and fully exercised, on the **deployment** path (vault-level EVM→Core) and the **redeem** path. Those are where the risk actually is.
- The pending state stays publicly visible, which is what §17's distribution thesis needs. The depositor UI shows "shares minted; vault has deployed X% to Core; Y in flight," which is a *more* honest picture than "your deposit is pending" because it distinguishes solvency from deployment.
- Deployment risk is borne pro-rata by all shareholders, which is correct: it is an operational risk of the strategy, not of an individual deposit.

Two mitigations replace what async deposit was providing incidentally:
- **Halt-gated deposits.** `deposit()` reverts while halted or while any NAV input is stale. Removes the "deposit into a mispriced NAV" attack that async settlement would have blunted.
- **Entry/exit fee band** (MVP: 0 bps entry, 0 bps exit, mechanism present and set to zero). This is the standard defence against NAV-timing extraction and is cheaper and less gameable than keeper-chosen settlement NAV, which introduces keeper trust that async deposit would have required.

**If the team rejects D3**, the async deposit path must additionally specify: which pool funds a reclaim, what happens when a reclaimed transfer subsequently lands, and why the depositor's free option over the delay window is acceptable. Those three questions have no answer in the current plan.

**[DIVERGENCE D4] Redemptions are batched into epochs rather than processed per request.** One de-risking decision, one perp→spot transfer, and one spot→EVM transfer per epoch, instead of per redeemer. This cuts the number of non-idempotent value transfers (the dangerous class) by the number of concurrent redeemers, and makes pro-rata inventory reduction a single computation. Redeem price is struck at **fulfilment**, after de-risking, not at request: pricing at request time hands the redeemer a free option over the delay window and pushes their exit slippage onto remaining LPs.

Redeem sequence per epoch:
```
close epoch → cancel all quotes (cloid sweep) → reduce position by redeemed fraction f
→ confirm position via precompile → action 7 perp→spot → confirm → action 13 spot→EVM
→ confirm EVM arrival → strike NAV → fulfillRedeem(epoch) → users claim
```
Every arrow is a two-phase transition with its own INDETERMINATE branch.

### Policy: three tiers, not one

`lane-c-plan.md` §9 describes a YAML mandate plus "on-chain hard caps." Making the tiering explicit matters because the tiers have different trust models and different change latencies.

| Tier | Lives | Enforces | Changeable by | Latency |
|---|---|---|---|---|
| **Hard caps** | Vault storage, checked in `execute()` | asset allowlist, `maxNotionalPerAsset`, `maxLeverage`, `maxLevelsPerSide`, `maxActionsPerTx`, `maxTotalAssets`, keeper allowlist, epoch drawdown limit | Owner; **tightening is instant, loosening requires timelock** | Tighten: 1 block. Loosen: timelock. |
| **Committed policy** | JSON on IPFS, `keccak256` on-chain; keeper refuses to run if the hash mismatches | spread curve, inventory skew multiplier, share-of-book, oracle-halt thresholds, flatten behaviour | Owner posts new hash | 1 block + keeper reload |
| **Keeper heuristics** | Keeper config | quote refresh cadence, backoff, RPC endpoints | Operator | Immediate |

The asymmetric timelock (tighten now, loosen slowly) is the non-obvious piece. It means the correct response to any incident is always available instantly and the response that could be used to extract value is not, so a compromised owner key cannot widen the risk envelope faster than depositors can exit.

Gated verbs from plan §9 map to:
- `gatedDeposit` → `deposit()` with `maxTotalAssets`, per-address cap, halt gate
- `gatedQuote` → `execute()` per-action + per-tx validation
- `gatedFlatten` → `flattenStep()`, reduce-only enforced on-chain, **allowed while halted**
- `gatedRedeem` → `requestRedeem()` / `fulfillRedeem()`, confirmed shares only

**[ADDITION] Epoch drawdown breaker.** On-chain caps bound *size* and *leverage* but not *rate of loss*. A compromised or malfunctioning keeper that can only trade (which is the whole point of the phase-2 API wallet) can still bleed the vault by quoting badly and being adversely selected, indefinitely, within every cap. `execute()` therefore records `totalAssets()` at the start of each epoch and reverts on any action once cumulative epoch drawdown exceeds `maxEpochDrawdownBps`. Halting on loss rate is the only cap that binds an attacker whose every individual action is legal.

### On the policy example in plan §9

`max_oracle_move_bps: 150 # halt if mark jumps 1.5% vs last confirm` is ambiguous in a way that decides whether the vault works. Measured **per Core block** (~0.1s), 150 bps is a genuine tail event and a correct breaker. Measured **"vs last confirm"** (seconds to tens of seconds), BTC clears 150 bps routinely in a live session and the vault will spend the canary halted. See Q7.

Separately, one threshold is doing two jobs. The SK Hynix event cited in plan §2 was an *oracle print diverging from reality*, not volatility. Two independent breakers are needed:
- **Velocity breaker:** `|markPx(t) − markPx(t−1 block)|` over a rolling window. Catches flash moves.
- **Divergence breaker:** `|markPx − oraclePx|` and `|markPx − mid(bbo)|`. Catches bad prints, which is the SK Hynix class and the HIP-3 risk that plan §11 item 2 defers to phase 2.

---

## Interfaces/contracts between components

### `SafeL1Read` (library, `internal view`)

The only place in the codebase where a precompile address appears.

```solidity
library SafeL1Read {
    error PrecompileFailed(address precompile);
    error AssetNotAllowlisted(uint32 asset);

    uint256 constant READ_GAS = 60_000;   // measured in Phase 0, not guessed

    function markPx(uint32 asset)  internal view returns (uint64);
    function oraclePx(uint32 asset) internal view returns (uint64);
    function bbo(uint32 asset)     internal view returns (uint64 bid, uint64 ask);
    function spotBalance(address u, uint64 token) internal view returns (uint64 total, uint64 hold, uint64 entryNtl);
    function position(address u, uint16 perp) internal view returns (int64 szi, uint64 entryNtl, int64 uPnl, uint32 lev, bool iso);
    function accountMarginSummary(address u, uint32 dex) internal view returns (int64 accountValue, uint64 marginUsed, uint64 ntlPos, int64 rawUsd);
    function withdrawable(address u) internal view returns (uint64);
    function l1BlockNumber()        internal view returns (uint64);
    function coreUserExists(address u) internal view returns (bool);
}
```

Three non-negotiable properties, each answering a specific plan invariant:
1. **Gas-capped `staticcall`.** Plan invariant 3 notes a failed precompile consumes all gas in its frame. Forwarding a fixed `READ_GAS` stipend caps the loss at the stipend and lets the caller handle failure instead of losing the transaction. `READ_GAS` is measured, not guessed, because a stipend below the real cost turns every read into a failure.
2. **Allowlist before call.** Asset ids are validated against vault storage before the precompile is touched, so a bad id is a cheap revert rather than a burned frame.
3. **All decimal conversion here.** HyperEVM USDC (6 dp), Core `szDecimals`/`weiDecimals` per token, and price decimals per asset all differ. One conversion module, fuzz-tested for round-trip and overflow. This is plan §10 week 1 as written and it is correct; the addition is that conversion is *fuzz-tested*, because a silent truncation on a size is indistinguishable from a rejected order at the log level.

### `CoreWriterLib` (library, `internal`)

```solidity
library CoreWriterLib {
    address constant CORE_WRITER = 0x3333333333333333333333333333333333333333;
    bytes1  constant VERSION     = 0x01;

    function limitOrder(uint32 asset, bool isBuy, uint64 limitPx, uint64 sz,
                        bool reduceOnly, uint8 tif, uint128 cloid) internal;   // action 1
    function usdClassTransfer(uint64 ntl, bool toPerp) internal;               // action 7
    function cancelByOid(uint32 asset, uint64 oid) internal;                   // action 10
    function cancelByCloid(uint32 asset, uint128 cloid) internal;              // action 11
    function sendAsset(address dest, uint32 srcDex, uint32 dstDex,
                       uint64 token, uint64 amountWei) internal;               // action 13
}
```

Encoding is `[VERSION][actionId:3][abi.encode(args)]`. **Action ids and argument encodings are transcribed from live docs and verified byte-for-byte against a testnet execution in Phase 0, not from memory.** A wrong action id or a wrong version byte produces exactly the silent failure this product exists to eliminate, and there is no test short of a live execution that catches it.

### Vault ↔ Keeper: the execution interface

```solidity
struct Action {
    uint8   kind;        // ORDER | CANCEL | XFER_CLASS | XFER_ASSET
    uint32  asset;
    bool    isBuy;
    uint64  limitPx;
    uint64  sz;
    bool    reduceOnly;
    uint8   levelIndex;  // cloid is derived, never supplied
    uint64  amount;      // transfers only
}

function execute(
    Action[] calldata actions,
    uint64  observedL1Block,   // the block the keeper's decision was computed against
    bytes32 policyHash         // the policy version the keeper computed under
) external onlyKeeper notHalted returns (uint64 firstSeq);
```

Three parameters do work that is easy to omit:

- **`observedL1Block`** reverts if `l1BlockNumber() − observedL1Block > maxL1Drift`. This converts "the keeper was quoting off a stale book" from a bad fill into a revert. Without it, a keeper that stalls for 40 seconds behind a slow RPC posts quotes priced to a book that no longer exists, and nothing in the system notices.
- **`policyHash`** reverts on mismatch with on-chain state, so a policy update cannot race in-flight decisions computed under the old policy.
- **Derived, not supplied, cloids.** The keeper passes `levelIndex`; the vault computes the cloid from `(vault, quoteEpoch, asset, side, levelIndex)`. A compromised keeper cannot issue orders outside the sweepable cloid space, which is what makes the recovery guarantee hold even under key compromise.

Per-action validation inside `execute()`: asset allowlisted; `sz × limitPx ≤ maxNotionalPerAsset`; `limitPx` within `maxPriceBandBps` of `oraclePx`; resulting leverage `≤ maxLeverage` read live from `accountMarginSummary`; `tif == ALO` for any non-reduce-only order (see below); `levelIndex < maxLevelsPerSide`.
Per-transaction validation: `actions.length ≤ maxActionsPerTx` (small-block gas budget, F7); epoch drawdown check; action-budget reserve check (F8).

**[DIVERGENCE D7] ALO is mandatory for non-reduce-only orders in MVP. Plan §10 week 5 permits "`tif = Alo` or `Gtc`."** An order priced at submission executes seconds later against a book that has moved. Under `Gtc` that is a silent adverse fill at a stale price, which is the exact failure class this product claims to eliminate. Under `ALO`, an order that would cross is *rejected*, which the state machine already handles as REFUTED. ALO converts delay-window adverse selection from an invisible loss into a visible, countable event. The cost is a higher reject rate and thinner fills, and that cost is the honest price of the delay.

### Vault ↔ Keeper: the verification interface

```solidity
event ActionSubmitted(uint64 indexed seq, uint8 kind, uint32 asset,
                      bytes32 payloadHash, uint128 cloid,
                      uint64 l1BlockAtSubmit, bytes32 expectationHash, uint64 deadlineL1Block);
event Reconciled(uint64 indexed seq, uint8 verdict, uint64 l1BlockObserved, bytes32 observedHash);
event Halted(bytes32 reason, uint64 l1Block);
event EpochAdvanced(uint32 quoteEpoch, bytes32 cause);

function reconcile(uint64[] calldata seqs, uint8[] calldata verdicts,
                   uint64 l1BlockObserved) external onlyKeeper;
```

The vault records both the **intent with its expectation** and the **later observation**, on-chain, so the public action log in plan §7 is chain-derived rather than a database assertion. Batched to one `reconcile` per loop tick to keep gas sane.

Honest limitation: `Reconciled` is the keeper's *claim* about what it observed. It is verifiable (anyone can `eth_call` the same precompiles at `l1BlockObserved` and check), and the indexer does verify it independently, but the chain does not enforce it. Making the vault self-verify would require the vault to re-read at reconcile time, which is affordable and should be done for the expensive verdicts (transfers) and skipped for cheap ones (order cancels). MVP: self-verify transfers on-chain, accept keeper claims for orders, mark the distinction in the public log.

### Safety verbs: available when everything else is broken

```solidity
function halt(bytes32 reason) external onlyGuardian;               // no reads, no external calls
function cancelSweep(uint32 asset, uint32 fromEpoch, uint32 toEpoch) external;  // permissionless when halted
function flattenStep(uint32 asset, uint64 px, uint64 sz) external onlyKeeperOrGuardian; // reduce-only, allowed while halted
```

`halt()` performs **no precompile reads and no external calls**. If it read NAV, a precompile outage would disable the kill switch at the exact moment it is needed. `cancelSweep()` is **permissionless once halted**: anyone may pay gas to clear the vault's book, so the kill switch does not depend on the keeper being alive, reachable, or honest. Both properties follow from plan §13's kill criterion "we cannot halt inside one delay window."

### Keeper ↔ HyperCore Info API

WebSocket `orderUpdates`, `userFills`, `webData2`; REST `openOrders` on reconnect. **Advisory tier.** Loss of this feed degrades the system to: cannot confirm individual order lifecycle, can still confirm inventory and NAV from precompiles, can still sweep and halt. Policy: Info API unavailable for more than `T_info` → halt quoting, keep sweep and redeem paths live.

### Guardian / Watchdog ↔ Vault

An independent process on separate infrastructure holding a key authorized **only** for `halt()`. It monitors: keeper heartbeat, NAV velocity, mark-vs-oracle divergence, and resting-order count vs. expected. It cannot trade, cannot withdraw, cannot loosen anything.

The design choice is a passive watchdog rather than a hot-standby keeper. Two active keepers can both decide to send the same non-idempotent transfer, which is a split-brain that produces a double transfer. A process whose only verb is the safe one has no split-brain failure mode. Availability of quoting is sacrificed for the impossibility of duplicate value movement, which is the correct trade for a vault whose entire pitch is correctness.

### Policy document contract

Canonical JSON (sorted keys, no floats, integer bps throughout), `policyHash = keccak256(bytes)`, pinned to IPFS, hash written on-chain. Keeper refuses to start if its local hash ≠ on-chain hash. A shared TypeScript validator and a Solidity cap-mirror are generated from one schema so the two tiers cannot drift.

### Indexer ↔ App

Indexer replays `ActionSubmitted` / `Reconciled` / `Halted` / `EpochAdvanced` and stores a Core-state snapshot every N blocks (`totalAssets()` components, position, mark, oracle). It **independently re-verifies** a sample of keeper verdicts by `eth_call` at the historical block. App is read-only over that. Deposits, redeems, and the kill switch button are direct wallet transactions from the browser, never routed through the indexer.

---

## Failure taxonomy

Ordered by whether they can silently make a depositor poorer. Plan §10 week 6 lists seven; F8 through F14 are additions grounded in specific plan claims.

### F1. CoreWriter action rejected (size, margin, tick, lot, min notional, ALO-would-cross)
*Plan week-6 item 1.*
- **Detection:** primary, expected-state diff at deadline (no position change, no spot delta, cloid absent from `openOrders`). Secondary, Info API `orderUpdates` rejection message. Rejection is the *expected* outcome for a meaningful share of ALO orders (D7) and must be a routine counted metric, not an alert.
- **Recovery:** verdict REFUTED. Orders: recompute from live state, re-quote at the next tick, no retry of the identical order. Transfers: never retried; next convergence step recomputes the delta (D2).
- **Trip:** reject rate above `maxRejectRateBps` over a rolling window → halt. A sustained reject storm means the keeper's model of Core's validation rules is wrong, and continuing to send is how a wrong model becomes a large loss.

### F2. User redeems while quotes are live and inventory is deployed
*Plan week-6 item 2.*
- **Detection:** structural, not detected. `requestRedeem()` is always accepted.
- **Recovery:** redeem epoch closes → cloid sweep → reduce position pro-rata by fraction `f` → confirm → transfer chain → strike NAV at fulfilment (D4). The redeemer bears the exit cost they caused; remaining LPs keep the same leverage they had.
- **Failure of the recovery:** if the position cannot be reduced (halted book, no liquidity), the epoch does not fulfil and stays open with the redeemer's shares escrowed. **This is a real liveness limit and must be stated in the mandate in plain language**, because "your redemption may not settle while the market is dislocated" is exactly the sentence plan §6 forbids hiding.

### F3. Keeper crash with open cloids
*Plan week-6 item 3.*
- **Detection:** watchdog heartbeat timeout. Independently, deposit/redeem UI shows a stale `l1BlockAtSubmit`.
- **Recovery:** watchdog `halt()` after `T_heartbeat`. On restart the keeper reads `quoteEpoch`, sweeps epochs `[epoch−2, epoch]` by derived cloid, increments `quoteEpoch`, re-reads Core, rebuilds. **No local state is consulted**, which is what makes this recoverable from a wiped host.
- **Residual:** orders submitted in the final unmined transaction before the crash land afterward and rest. They are inside the swept cloid space by construction, so the sweep catches them. Their notional was capped on-chain before the send, so the exposure window is bounded and known.

### F4. Oracle jump beyond threshold
*Plan week-6 item 4, plan §7 invariant 6.*
- **Detection:** two independent breakers (see §"On the policy example"). Velocity: `|markPx` delta per Core block| over a rolling window. Divergence: `|markPx − oraclePx|` and `|markPx − mid(bbo)|`. Evaluated by the keeper every tick, by the watchdog independently, and by `execute()` as a pre-send check so a stale keeper cannot post into a dislocation.
- **Recovery:** halt → cloid sweep (free, immediate, always correct) → **staged** flatten. Stage 1: reduce-only limit orders at a bounded distance from mid, `T_flatten` seconds. Stage 2: reduce-only IOC.
- **[DIVERGENCE D8]** Plan §9 has `flatten_on_halt: true` as a boolean. A boolean flatten means market-exiting into the dislocated book that triggered the halt, which is when exiting is most expensive and most likely to be exiting into a bad print rather than a real move. Staging separates the free action (cancel) from the costly one (flatten) and buys time to learn whether the print was real. Cancel is unconditional and instant; flatten is staged and bounded.
- **Kill criterion inherited from plan §13:** if halt cannot complete inside one Core delay window, the product does not ship.

### F5. ADL or liquidation zeroes / shrinks a position
*Plan week-6 item 5, plan §7 invariant 7.*
- **Detection:** position delta outside the band explainable by our own fills. ADL and liquidation fills are distinguishable in `userFills`, and the reconciler must not require that feed to detect it: a position that moved with no fill of ours is sufficient evidence.
- **Recovery:** NAV math tolerates `szi == 0` (no division by size, no `entryNtl / szi`, signed arithmetic throughout). Quote loop is target-seeking from actual state, so it self-heals. Any ADL event halts for human review regardless of size, because ADL means the counterparty side of the book was in stress and the next tick is not a normal tick.
- **Test:** property test asserting `totalAssets()` and `convertToShares()` are total functions over `szi ∈ {negative, 0, positive}` and `accountValue ≤ 0`.

### F6. Invalid asset id or precompile failure burning the frame
*Plan week-6 item 6, plan §7 invariant 3.*
- **Detection:** allowlist check before the call; gas-capped `staticcall` returning `success == false`.
- **Recovery:** typed revert on the pre-check. A genuine precompile failure costs `READ_GAS`, not the transaction.
- **Test:** a Foundry mock precompile that consumes all supplied gas, asserting the caller survives with enough gas to revert cleanly and to execute `halt()`.

### F7. Small-block gas limit exceeded
*Plan week-6 item 7, plan §7 invariant 8.*
- **Detection:** `maxActionsPerTx` enforced on-chain from a measured per-action gas cost with margin; simulation before send; observed `gasUsed` tracked per action kind.
- **Recovery:** keeper splits into multiple transactions across consecutive small blocks, priority-ordered: cancels first, then reduce-only, then new quotes. If a batch cannot fit, the *quotes* are dropped, never the cancels.
- **[ADDITION] F7b, big-block routing.** Big-block mode is a per-address setting. The vault deployment needs ~30M gas and therefore big blocks (~1 min cadence); the keeper needs small blocks (~1s). If the keeper's address is ever flipped to big-block mode, every quote and every cancel inherits ~60s latency and the kill switch misses its delay-window budget. **Mitigation: deployer and keeper are permanently separate addresses, the keeper address is never flipped, and the keeper asserts its own block-mode at startup and refuses to run otherwise.** This is a one-line operational mistake that silently disables the product's core safety claim.

### F8. Core action rate-limit exhaustion  **[ADDITION]**
HyperCore rate-limits requests per address as a function of cumulative traded volume. A maker quote loop is the highest action-rate workload that exists, and a fresh vault has near-zero volume and therefore near-minimum allowance.
- **Why this is the most dangerous omission in the plan:** the entire product claim is "a kill switch that actually flattens." A vault that has spent its action allowance on quote replacement **cannot cancel**. The safety mechanism fails exactly when the vault has been most active, which correlates with volatility, which correlates with when it is needed.
- **Detection:** keeper maintains a local estimate of (actions sent, volume traded, allowance remaining); rejections attributable to rate limiting are counted and treated as a hard trip, not a retry.
- **Recovery / prevention:** a **cancel reserve**. `execute()` refuses new non-reduce-only orders unless the estimated remaining action allowance exceeds `maxLevelsPerSide × 2 × reserveMultiple`. Quoting is throttled to preserve enough allowance to cancel everything outstanding, always. Quote refresh cadence is tuned against the measured allowance, not against a latency target.
- **Phase 0 requirement:** the allowance formula and its refill behaviour must be *measured* on testnet before the quote loop is designed, because cadence is the primary design input for the quote loop and it is downstream of this number.

### F9. INDETERMINATE plus non-idempotent retry equals double transfer  **[ADDITION]**
The failure mode implied by plan §7's undifferentiated "retry / reclaim."
- **Detection:** Core spot balance exceeds the exact expected-state model (the corridor invariant makes this detectable and attributable, which is the payoff for keeping spot transit-only).
- **Prevention:** structural. Transfers have no retry path in the code at all (D2). The keeper cannot express "resend that transfer." It can only express "converge to this target balance," computed from a fresh read.
- **Recovery if it happens anyway:** halt, converge back, publish. Doubling a transfer is not a loss to the vault (both dollars are still the vault's), but it is a NAV mis-statement while it stands, and any share minted or burned in that window was mispriced.

### F10. Deposit-time NAV manipulation  **[ADDITION, consequence of D3]**
Synchronous deposits mint at a NAV read live from precompiles.
- **Detection:** deposits during halt or during price-input staleness.
- **Prevention:** `deposit()` reverts while halted, while mark/oracle divergence exceeds threshold, or while `inflightOut > maxInflightForDeposit`. Entry/exit fee band available and set to zero in MVP. Per-address and global deposit caps.
- **Also:** ERC-4626 first-depositor share inflation, handled with virtual shares plus a seeded dead-share position at deployment. Standard, listed for completeness.

### F11. NAV read failure bricking the vault  **[ADDITION]**
If `totalAssets()` reverts, every ERC-4626 entry point reverts with it: deposits, redeems, and any safety verb that touches NAV.
- **Detection:** `SafeL1Read` returns a failure flag rather than reverting; the vault counts consecutive read failures.
- **Recovery:** `staleReads > N` → auto-halt into **withdraw-only-when-readable** mode. `halt()` and `cancelSweep()` never touch NAV (see safety verbs) so they remain callable through a total precompile outage. Redemptions queue and fulfil when reads recover.

### F12. Keeper key compromise within all caps  **[EXTENDS plan §13]**
Plan §13 covers "a leaked key can drain EVM USDC" via caps and the future action-9 API wallet. It does not cover an attacker who never breaks a cap.
- **Attack:** quote deliberately badly, get adversely selected, repeat. Every action legal, every cap respected, vault bleeds.
- **Detection / prevention:** the epoch drawdown breaker (see Policy). It is the only on-chain constraint that binds an attacker whose individual actions are all compliant.
- **Also:** keeper key is never the withdrawer; withdrawal authority is the redeem path only, addressed to the requesting shareholder.

### F13. Info API and precompile divergence  **[ADDITION]**
Off-chain order view disagrees with precompile-derived reality.
- **Detection:** reconciliation mismatch, or Info API silence past `T_info`.
- **Recovery:** precompile wins, unconditionally. Sweep, increment epoch, rebuild. If the Info API is unavailable, quoting halts while NAV, redeem, and sweep continue, because none of those depend on it.

### F14. ALO reject storm producing silent non-participation  **[ADDITION]**
A latency or volatility regime where nearly every ALO order is rejected. The vault looks live on every dashboard, is halted on nothing, and is quoting nothing.
- **Why it matters:** this is an availability failure, not a solvency failure, and it is the single most likely reason the week-8 canary looks broken. It is invisible to every safety mechanism in the plan.
- **Detection:** time-weighted resting-quote coverage, tracked as a first-class metric: what fraction of the last hour did the vault have live quotes on both sides.
- **Recovery:** widen spread by the policy's `inventory_mult` ladder; if coverage stays below `minCoverageBps` for `T`, halt and alert. A vault that cannot quote should say so publicly rather than sit idle looking healthy.

### F15. Core account does not yet exist  **[ADDITION]**
A newly deployed vault contract has no HyperCore account until one is created, and transfers to a non-existent Core user have their own rules and minimums.
- **Detection:** `coreUserExists(vault)` precompile, checked before the first transfer and asserted in the deployment runbook.
- **Recovery:** account bootstrap is an explicit, human-run deployment step with its own verification, not something the keeper discovers at 3am.

---

## Explicit assumptions and open questions

### Assumptions made where the plan is silent

| # | Assumption | Why | Cost if wrong |
|---|---|---|---|
| A1 | The vault contract itself is the HyperCore account; all CoreWriter actions originate from it, all reads target its address. | One account means one `accountValue`, one `withdrawable`, one reconciliation surface. Multiple Core accounts multiply the attribution problem for no MVP benefit. | Moderate. Multi-account NAV aggregation is additive work, not a rewrite. |
| A2 | Spot is a transit corridor only; all value lives in perp margin. | Makes exact delta attribution possible on the balance where non-idempotent transfers land. | High. Losing exact attribution on spot is losing F9 detection. |
| A3 | `CoreWriterLib` is a Solidity `library` (internal / delegatecall), so `msg.sender` at CoreWriter is the vault. | A separate contract would be a separate Core account. | High if wrong; caught immediately in Phase 0. |
| A4 | MVP charges zero management and zero performance fees. Mechanism present, parameters zero. | Fee accrual couples to NAV and high-water-mark math and adds a share-price bug surface. The canary's purpose is proving CoreWriter correctness, and a fee bug would be indistinguishable from a reconciliation bug in the logs. | Low. Revenue is deferred, not lost. |
| A5 | Vault is **non-upgradeable**. Policy hash, caps, and keeper address are mutable; contract logic is not. Migration is deploy-new + `sunset()` on old (flatten, withdraw-only, no new deposits). | A proxy over a contract that is simultaneously a live Core account with resting orders and open positions is a much larger risk than a migration. | Moderate. Migration is operationally heavier than an upgrade. |
| A6 | Any single guardian can `halt()`; resuming requires the owner multisig plus a timelock. Loosening any cap requires a timelock; tightening is instant. | The safe action must be maximally available and the dangerous one maximally slow. | Low. |
| A7 | `maxTotalAssets` is enforced on-chain at the canary target from plan §10 ($25k–$100k), with a per-address cap. No allowlist. | Plan §10 caps capital socially ("team + friends"); a social cap is not a cap. | Low. |
| A8 | One keeper process, one passive watchdog. No hot standby. | Two active keepers can double-send a non-idempotent transfer. Quoting uptime is sacrificed for the impossibility of duplicate value movement. | Moderate. Quoting downtime on keeper failure. |
| A9 | Redeem NAV is struck at fulfilment, after de-risking. | Striking at request hands the redeemer a free option over the delay window. | Moderate; it is a fairness question the mandate must state either way. |
| A10 | Dedicated RPC node per plan §12, plus a second independent provider used **only** as a divergence check on reads, never for submission. | Two submitters means duplicate transactions. Two readers means detecting a lying or lagging node. | Low. |
| A11 | Testnet asset ids, token ids, decimals, and min-notional values are read from chain at deploy, never hardcoded per environment. | A hardcoded testnet asset id reaching mainnet quotes the wrong market. | High. |

### Open questions requiring a decision before build starts

**Q1. Does the async-deposit requirement survive D3?** This is the largest single divergence and it changes the vault interface, the UI, and the demo narrative. It must be settled in week 0 because Phase 2 cannot start without it. If the plan's position holds, the three unanswered questions in D3 (which pool funds a reclaim; what happens when a reclaimed transfer lands; why the free option is acceptable) need answers before `reclaimPending()` is written.

**Q2. Which EVM→Core transfer mechanism, and does the dark window exist?** CoreWriter action 13 versus ERC-20 transfer to the token system address. These may differ on whether the EVM debit and the Core credit happen at the same instant. The answer determines whether `inflightOut` is load-bearing NAV machinery or dead code. Phase 0 measurement, blocking for Phase 2.

**Q3. What is the actual Core action allowance and refill rate for a fresh account?** This is the primary input to quote cadence and to the F8 cancel reserve, and quote-loop design cannot start without a number. Phase 0 measurement, blocking for Phase 3.

**Q4. Is an ALO rejection observable to the keeper at all, and with what latency?** If rejections are only inferable by absence-after-timeout, the verification deadline becomes the dominant loop latency and the whole cadence changes. Phase 0 measurement, blocking for Phase 3.

**Q5. What is the delay distribution, not the delay?** Plan says "delayed a few seconds." The verification deadline must be set from a measured p99, and everything downstream (quote cadence, redeem epoch length, watchdog timeout) is derived from it. A deadline set from the mean produces a steady stream of false INDETERMINATE verdicts.

**Q6. Are the action ids and encodings in plan §4.1 current?** Specifically action 13 `sendAsset` and the `uint32.max` spot-dex convention. Verified against live docs and a live execution in Phase 0. A wrong id is a silent failure, which is the failure this product exists to prevent, so it cannot be assumed.

**Q7. Is `max_oracle_move_bps` per Core block or per confirmation interval?** Per block, 150 bps is a correct tail-event breaker. Per confirmation interval, BTC clears it routinely and the vault spends the canary halted. Also: does the plan accept splitting this into separate velocity and divergence breakers (F4)?

**Q8. What does "flatten" mean concretely, and who decides to resume?** D8 proposes staged reduce-only rather than a boolean. Related: after any halt, is resume automatic on condition-clear or manual? Recommendation for the canary is **manual with a written note per plan §10 week 8**, because an auto-resume into a still-bad print is how one incident becomes two, and 7 days is short enough that manual is affordable.

**Q9. Who owns the indexer and the operator runbook?** Plan §15 has three seats and neither of these components has an owner. See D5, D6.

**Q10. What is the redeem epoch length, and is there an emergency single-redeemer path?** Epoch batching (D4) trades redemption latency for a smaller non-idempotent-transfer surface. The mandate must state the number.

**Q11. Legal wrapper before the mainnet canary.** Plan §13 defers this ("until that's a real company problem"). Taking $25k of other people's money on mainnet with a public page arguably makes it one. Flagged as a decision, not a recommendation; it does not block Phases 0 through 4 and does block Phase 6.

### Divergence index

| ID | Divergence from `lane-c-plan.md` | Section |
|---|---|---|
| D1 | State machine replaced; `submitted`/`enqueued` collapse, `executed_or_rejected` deleted, `INDETERMINATE` added | §7 |
| D2 | Value transfers are convergence-to-target and are **never** retried; only orders retry | §7 |
| D3 | Deposits synchronous against EVM cash; ERC-7540 async on **redeem only** | §6, §10 |
| D4 | Redemptions batched into epochs; NAV struck at fulfilment | §10 |
| D5 | Indexer added as a fifth component with an owner | §7, §15 |
| D6 | Passive watchdog added as a sixth component; explicitly **not** a hot-standby keeper | §15 |
| D7 | ALO mandatory for non-reduce-only orders; `Gtc` removed from MVP | §10 wk5 |
| D8 | `flatten_on_halt` boolean replaced with staged reduce-only escalation | §9 |
| D9 | Oracle breaker split into velocity and divergence; `max_oracle_move_bps` window disambiguated | §9 |
| D10 | Epoch drawdown breaker added to on-chain caps | §9 |
| D11 | Cloids derived, not recorded; vault computes them, keeper cannot choose them | §7 inv. 4 |
| D12 | Cap changes asymmetric: tighten instantly, loosen through timelock | §9 |
| D13 | Zero fees in MVP | §12 |
| D14 | Failure catalog built as a harness in Phase 1, executed continuously, not run once in week 6 | §10 wk6 |

---

# 2. BUILD PLAN

Seven phases against the plan's eight weeks. The reordering is one substantive change: plan §16's week-0 checklist is promoted from a checklist into **Phase 0, a gating phase whose output the contract design is written against**. Justification: at least six design parameters (Q2 through Q7) are empirical properties of a live system with no fork available (plan §12: "there is no good HyperCore fork"), and writing the vault before measuring them means writing it against guesses and rewriting it in week 5.

## Manual vs. autonomous agent: the general rule

Applied per phase below, derived once here:

> **An agent owns work whose correctness oracle is local, cheap, and repeatable.** Unit and property tests, encoders and decoders, schema-derived validators, indexer plumbing, UI, documentation, and test harnesses all qualify: the agent can tell whether it succeeded without asking anyone.
>
> **A human owns work whose correctness oracle is a live external system you can only sample, or where a mistake is irreversible.** Live-network empiricism, byte-level encoding verified against a real execution, key handling, mainnet deployment, money movement, policy loosening, and every judgement call about whether a canary incident means stop.

The sharp edge: **an agent must never be the party that concludes a live measurement means what it appears to mean.** The failure this product exists to eliminate is a system confidently reporting success it cannot verify, and an agent reading explorer output is that system.

---

## Phased milestones

### Phase 0 — Ground truth (week 0 to mid-week 1). Blocking for everything.

**Built:** a throwaway `Prober.sol` on HyperEVM testnet plus a scripted TypeScript driver. No vault, no shares, no policy. The only deliverable is measurement.

**Measured, each producing a number that a later phase consumes:**

| Measurement | Consumed by |
|---|---|
| Delay distribution p50/p95/p99, per action type (Q5) | verification deadline, quote cadence, watchdog timeout |
| Action allowance formula and refill rate for a fresh account (Q3) | F8 cancel reserve, quote cadence |
| Is an ALO rejection observable, and how (Q4) | keeper verification design |
| Byte-exact encodings for actions 1, 7, 10, 11, 13, confirmed by execution (Q6) | `CoreWriterLib` |
| EVM→Core transfer: which mechanism, and does the debit/credit dark window exist (Q2) | whether `inflightOut` is real |
| Precompile gas cost per read; behaviour of a bad asset id; does a failed read really consume the frame | `READ_GAS`, F6 |
| Big-block flag: per-address scope, effect on a keeper EOA's latency | F7b |
| Min order notional, tick size, lot size, `szDecimals` per market | decimals module, F1 |
| `coreUserExists` bootstrap: what it takes to create the vault's Core account | F15, deployment runbook |
| Duplicate-cloid behaviour: does HyperCore reject a repeat, and is that observable | D11, order idempotency claim |

**Done looks like:** `CORE_BEHAVIOR.md` committed, every row above filled with a measured number and a link to a testnet transaction, plus a replayable script that reproduces every measurement. Every assumption in the design spec is either measured or explicitly labelled unmeasured with its blast radius.

**What could go wrong:** a measurement contradicts the architecture. The most likely candidates, in order: the action allowance makes a 3-level two-sided ladder with meaningful refresh cadence infeasible (forces wider spreads and slower quoting, changes the product's competitive claim); ALO rejections are wholly unobservable (forces deadline-driven verification and roughly doubles loop latency); the EVM→Core mechanism has no attributable delta (breaks A2 and F9 detection).

**Evidence to advance:** every row measured. **A single unmeasured row in the encoding or transfer group blocks Phase 1**, because those are the ones where being wrong is silent.

**Manual vs. agent:** agent writes the prober contract, the driver, the report scaffold, and the replay script. **Human runs every live execution and interprets every result.** Reading an explorer to decide whether an action landed is the exact judgement this product claims machines cannot make, and it would be self-defeating to delegate it here.

---

### Phase 1 — Kernel primitives and the fault harness (mid-week 1 to week 2). Depends on Phase 0.

**Built:** `SafeL1Read` (gas-capped, allowlisted, single decimals module). `CoreWriterLib` (five actions, byte-exact per Phase 0). `ActionTracker` (sequence numbers, derived cloids, expectations, deadlines). `ReconcileEngine` (expected-state model: exact on spot, banded on position and equity).

**Also built, and this is the reordering:** the **fault-injection harness itself**, as a Foundry `CoreSim` mock plus a testnet chaos driver. `CoreSim` can, on command: accept a write and then report no state change (the silent-fail case); consume all gas on a read; reject on min notional; return `szi == 0` mid-sequence; and delay a credit past the deadline.

**[DIVERGENCE D14] The plan runs the failure catalog once in week 6. Here the harness is built in week 1 and runs in CI from then on.** Observability for silent failure cannot be retrofitted: if the harness arrives after the vault, the vault gets written in a shape that is hard to fault-inject, and week 6 becomes a redesign rather than a validation.

**Done looks like:** the harness reproduces F1, F6, F9, and the plan's own week-1 exit check ("write succeeds, later read shows no fill / no balance"), all green in CI. Fuzz tests on decimals prove round-trip and no silent truncation. A test proves the derived cloid space is complete, meaning a sweep over `[epoch−2, epoch]` provably covers every cloid the contract can emit.

**What could go wrong:** `CoreSim` encodes the team's beliefs about Core rather than Core's behaviour, producing a suite that is green and wrong. Mitigation: every `CoreSim` behaviour cites a specific `CORE_BEHAVIOR.md` measurement, and behaviours without a citation are marked speculative and cannot gate a phase.

**Evidence to advance:** CI green including fault injection; the cloid completeness proof; a live testnet run of `CoreWriterLib`'s five encodings with matching observed effects.

**Manual vs. agent:** **agent-heavy, the strongest fit in the project.** Dense, spec'd, locally testable Solidity with an explicit oracle. Human owns exactly one thing: byte-for-byte review of the five encodings against the live executions, because that is where an agent's confident-and-wrong output is invisible to every test.

---

### Phase 2 — Vault, accounting, caps (weeks 3 to 4). Depends on Phase 1 and Q1, Q2.

**Built:** `BrokRVault.sol`. ERC-4626 core with ERC-7540 async redeem, epoch-batched (D4). Synchronous deposit against EVM cash, halt-gated (D3, subject to Q1). `totalAssets()` with the five terms and `inflightOut`. On-chain hard caps and the three-tier policy plumbing. `execute()` with `observedL1Block` and `policyHash` guards. Safety verbs: `halt()` with no reads, `cancelSweep()` permissionless-when-halted, `flattenStep()` reduce-only. Epoch drawdown breaker. Watchdog process (halt-only key). Deployment runbook including Core account bootstrap (F15) and the deployer/keeper address separation (F7b).

**Done looks like:** plan §10 week-4 exit check passes on testnet, deposit → deploy to Core → confirm → redeem round trip, with the RPC killed mid-flight and the system recovering to a correct NAV. Beyond that: invariant tests proving no deposit/redeem sequence lets any actor extract value from another (the property, not a list of examples); `totalAssets()` proven total over `szi ∈ {−, 0, +}` and `accountValue ≤ 0`; `halt()` proven callable with all precompiles failing; `cancelSweep()` proven callable by a random address once halted.

**What could go wrong:** the accounting for `inflightOut` interacts with epoch redemption in a way unit tests miss. Mitigation is invariant testing over random operation sequences (deposit / redeem-request / execute / reconcile / fulfil / fault) rather than scenario tests, since the bug class here is ordering, and ordering bugs are found by fuzzers and missed by scenarios.

Second risk: Q1 remains unresolved and the vault interface gets built twice. It must be settled in week 0.

**Evidence to advance:** invariant suite green over long random sequences; the testnet round trip with induced failure at each of the six two-phase transition points, each producing a correct NAV and no stuck user funds. **Plan §13's kill criterion applies here and is the hardest gate in the project: demonstrate "EVM says pending, Core says no, user got USDC back" on testnet, or the project stops.**

**Manual vs. agent:** agent writes the ERC-4626/7540 mechanics, the invariant suite, and the caps. **Human owns the NAV composition and the accounting invariants**, because those are the specification, and an agent that writes both the spec and its test writes a consistent pair that can be jointly wrong. Human owns key generation, address separation, and the runbook.

---

### Phase 3 — Quote loop (week 5). Depends on Phase 2 and Q3, Q4, Q5.

**Built:** keeper state machine over `INTENT → SUBMITTED → OBSERVING → {CONFIRMED, REFUTED, INDETERMINATE}`, with the two INDETERMINATE resolutions (cancel for orders, convergence for transfers). Inventory-skew spread model, in the keeper, per plan §10 week 5. Policy gate before every send. F8 cancel reserve with measured allowance. Crash recovery by derived-cloid sweep. Info API client, advisory tier, with the degradation path.

**Done looks like:** plan §10 week-5 exit check, quotes both sides, a fill moves inventory, the spread widens on the heavy side, NAV updates from the precompile. Plus: the keeper process is killed at each state-machine state and recovers with zero local state, and the F14 coverage metric is being recorded from day one.

**What could go wrong:** the ALO reject rate under real testnet conditions makes the vault effectively non-quoting (F14), and it is discovered here rather than in week 8. Detection is the coverage metric, which is why it is instrumented at the start of this phase and not at the start of Phase 5.

Second risk: quote cadence and the cancel reserve are in direct tension. If the measured allowance from Q3 is tight, the achievable refresh rate may be too slow for a competitive spread. That is a product finding, not a bug, and it needs to reach the operator conversations in week 3 rather than week 8.

**Evidence to advance:** 48 continuous hours on testnet with quote coverage above target, zero INDETERMINATE transfers, every keeper kill recovering cleanly, and the action budget never dropping below the cancel reserve.

**Manual vs. agent:** agent writes the state machine, the reconciler, the recovery path, and their tests. **Human owns the spread and skew model and the cadence parameters**, because those are the trading judgement the vault exists to express, and because an agent optimising a spread model against a backtest will overfit to testnet's thin book.

---

### Phase 4 — Failure catalog execution (week 6). Depends on Phase 3.

**Built:** nothing new. The Phase 1 harness is driven against the full testnet system, and the run is documented.

**Executed:** all fifteen entries F1 through F15 in the taxonomy. Plan §10 lists seven; the additional eight are the ones this design added, and F8 (rate-limit exhaustion disabling the kill switch) is the single highest-value entry because it is the failure that breaks the product's core claim.

**Done looks like:** each entry has a reproducible run, an observed detection latency, an observed recovery outcome, and a verdict. Plan §10's gate stands unchanged and is the right one: **if any of these leaves unhedged confirmed shares, we do not ship.** Extended by two: if F8 leaves the vault unable to cancel, we do not ship; if halt cannot complete inside one delay window (plan §13), we do not ship.

The published writeup is drafted here. Plan §17 is correct that "CoreWriter will fail; here is the state machine" is the distribution asset, and the catalog is that post's content, so it is written while the runs are fresh.

**What could go wrong:** the failures the catalog does not contain. Mitigation: an explicit adversarial pass asking what happens when two of these occur at once. The realistic compound cases are F4 with F8 (oracle shock during a high-action-rate session, so the halt fires exactly when the allowance is thinnest) and F3 with F2 (keeper dies mid-redeem-epoch). Both are worth an explicit run.

**Evidence to advance:** fifteen documented runs, three ship gates clear, compound cases run, writeup drafted.

**Manual vs. agent:** agent drives the deterministic injections and collects artifacts. **Human runs every ambiguous case and writes every verdict.** A phase whose entire output is a judgement about whether a failure was survived cannot have that judgement delegated to a system that also produced the run.

---

### Phase 5 — App, public log, indexer (week 7). Depends on Phase 2 for events; parallelisable from Phase 2 onward.

**Built:** indexer replaying `ActionSubmitted` / `Reconciled` / `Halted` / `EpochAdvanced`, storing periodic Core snapshots, and independently re-verifying a sample of keeper verdicts. Next.js app per plan §10 week 7: deposit and redeem with pending states visible, live quotes, fills, leverage, oracle-vs-mark, the last 50 CoreWriter actions with enqueue and execute distinguished, the mandate rendered in English, and the kill switch button. Builder code present and defaulted off.

Two additions to the plan's page: **quote coverage** from F14 (the honest answer to "is this vault actually working"), and **deployment ratio** (EVM cash versus Core margin), which is what D3 makes visible in place of a per-deposit pending state.

**Done looks like:** the log reproduces from chain data alone on a clean database. Every number on the page traces to either a chain event or an `eth_call` at a stated block. The kill switch button works from a guardian wallet with the indexer down.

**What could go wrong:** the app becomes the trusted source and quietly re-introduces the mirror the whole design forbids. Mitigation, stated as a rule: **the indexer is a cache and is provably rebuildable from chain state; the app never writes; deposits, redeems, and halt are direct wallet transactions that never route through the indexer.**

**Evidence to advance:** clean-database rebuild produces a byte-identical log; a full user journey executed from the UI against testnet; the kill switch demonstrated with the indexer stopped.

**Manual vs. agent:** **agent-heavy, second-strongest fit after Phase 1.** Schema, indexer, components, and the verification sampler are all locally testable. Human owns the mandate's English, because plan §14's messaging constraints are a judgement about what can be honestly claimed, and human owns the decision about which numbers are shown at all, since a number on a public page is a claim.

---

### Phase 6 — Mainnet canary (week 8). Depends on Phases 2 through 5 and on Q11.

**Built:** nothing. Deployed, seeded, and operated.

**Executed:** deploy vault, post policy hash, bootstrap the Core account, start keeper and watchdog on separate infrastructure, seed $25k per plan §10, run 7 days of quoting with a written incident note every day whether or not anything happened.

**Done looks like:** plan §10's ship gate verbatim, no silent unhedged interval longer than one Core delay window, no policy breach, and a redemption of 10% of TVL completing. Plus: quote coverage above target for the week, and every halt that fired accounted for in writing with its cause.

**What could go wrong:** a mainnet-only behaviour absent on testnet. Real book depth, real adverse selection, real competing makers, and a real action allowance that grows with volume in a way testnet never exercised. Mitigation is the plan's own capital discipline (§10, "not $150k of strangers"), plus a hard on-chain `maxTotalAssets` so the social cap is an enforced one (A7).

Second risk, and the more likely one: the vault is safe and boring, quotes little, earns nothing, and the week looks like a failure. That is a **correct** outcome for a canary whose thesis is correctness, and it needs to be pre-agreed before the week starts, or the pressure to loosen policy mid-canary will win. Pre-committing to the criteria is what the asymmetric timelock (D12) enforces mechanically: loosening a cap during the canary is not fast enough to be a panic response.

**Evidence to advance to the plan's §11 post-MVP list:** the three ship-gate conditions, plus plan §17's 30-day bar before any factory work.

**Manual vs. agent:** **almost entirely manual.** Deployment, key handling, seeding, and every incident judgement. Agent's role is bounded to monitoring, report generation, and drafting the daily incident note from telemetry for a human to verify and sign. No agent holds a key, and no agent decides whether an incident is an incident.

---

## Parallel non-blocking track: operator conversations

Plan §13's kill criterion "no operator will even look at a testnet deposit" is tested in week 3, per plan §16 item 5. That is correct and it should not slip, because the finding from Phase 3 (achievable quote cadence given the measured action allowance, Q3) is exactly what an operator will ask about, and it arrives in week 5. An operator who has been in the conversation since week 3 can tell the team whether that number kills the product two weeks before the canary would.

Human-owned end to end.

---

## Critical path

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 6
   │                       └────────────────► Phase 5 ──────┘
   │
   └── Q1 (async deposit) must resolve before Phase 2
   └── Q2 (transfer mechanism) must resolve before Phase 2
   └── Q3, Q4, Q5 must resolve before Phase 3
```

Phase 5 parallelises off Phase 2's event interface, which is the reason `ActionSubmitted` and `Reconciled` are specified in Phase 2 and frozen there.

## Staffing against plan §15

Plan §15 defines three seats: Contracts, Keeper, App/operator. Two components in this design have no owner in that split:

- **Indexer (D5).** Nearest fit is App/operator, but that seat is already carrying pending-state UX, the public log, the mandate copy, and canary ops. Recommend the indexer be explicitly scoped into the App seat with the Contracts seat owning the event schema, and that it be built in Phase 2 rather than Phase 5 so it is not the thing that slips.
- **Watchdog (D6) and the operational runbook.** Nearest fit is Keeper, but the watchdog must be independent of the keeper in infrastructure and, ideally, in authorship. Recommend the Contracts seat writes it, since its only verb is a contract call and its independence from keeper code is the point.

Plan §15's closing rule holds unchanged and is the most important sentence in that section: **nobody ships quotes without the failure catalog.**
