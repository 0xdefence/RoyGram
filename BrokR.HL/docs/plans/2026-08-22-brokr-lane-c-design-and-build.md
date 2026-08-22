# BrokR — Design Spec & Build Plan

**Working name:** BrokR
**Lane:** C — HyperEVM vault that mirrors inventory onto the HyperCore orderbook
**Date:** 22 Aug 2026
**Source of truth:** `lane-c-plan.md`
**Companions:** `hl-product-demand-research.md`, `monsoonbrief.md`

Product: an ERC-4626 HyperEVM vault that holds user USDC, posts maker inventory onto HyperCore with two-phase commit, and enforces hard policy before any CoreWriter action. Shares mint only after Core margin is confirmed. This is the CoreWriter correctness kernel, not a factory, not a chat agent, not a Valantis AMM.

If a design choice below contradicts or tightens `lane-c-plan.md`, it is marked **divergence** and justified in 1–2 sentences.

---

# DESIGN SPEC

## System overview and core architecture

BrokR is a dual-engine system. HyperEVM holds the tokenized vault and the policy caps. HyperCore holds the real book, balances, and oracle. They share consensus but **not** atomicity: a successful EVM transaction does not mean the Core action landed. That gap is the product.

```
User / operator
    │
    ▼
Next.js app  ──reads──►  vault events, SafeL1Read, Hyperscan
    │ writes (deposit / redeem / kill)
    ▼
Policy kernel ──off-chain full mandate──► Keeper
    │            on-chain hard caps   ──► BrokRVault
    ▼
BrokRVault.sol  (sole CoreWriter caller in MVP)
    │ sendRawAction (version 0x01)
    ▼
CoreWriter 0x333…3333  ──delayed enqueue──► HyperCore (spot, BTC isolated-by-construction, book)
    ▲                                          │
    │                                          ▼
Keeper (crank + quote loop)  ◄──read──  L1Read 0x800+ (via SafeL1Read)
```

### Components

| Component | Job | Does not do |
|---|---|---|
| **BrokRVault.sol** | ERC-4626 + ERC-7540 async deposit/redeem; pending maps; on-chain caps; cloid cursor; encode+send CoreWriter actions 1, 7, 10, 11, 13; permissionless `confirm*` / `reclaimPending` that re-read precompiles | Quote model, share-price cache, assuming a write landed |
| **SafeL1Read.sol** | Allowlisted asset ids / vault address; gas-capped precompile frames; one-place decimal conversion | Unbounded `call` into `0x800+` |
| **CoreWriterLib.sol** | Encode version `0x01` + action id + ABI payload for 1, 7, 10, 11, 13 | Sending; never talks to `0x333` itself |
| **ActionTracker** | On-chain: sequential `cloid` allocator (`≠ 0`), pending-action map, timeout. Off-chain: replica of `idle → encoded → submitted → enqueued → executed_or_rejected → verified \| retry/reclaim` | Collapsing `submitted` into `executed` |
| **Keeper** | Event listener + quote loop: read → target inventory/quotes → policy gate → call vault → wait delay → verify → retry/reclaim. Crash path: cancel issued cloid range, rebuild | Withdraw EVM USDC; mint/burn shares; be source of NAV |
| **Policy kernel** | Off-chain YAML (Salt productionized: Deposit, Rebalance, OBOrder, OracleHalt, Leverage, KillSwitch). On-chain hash + hard caps | Chat intents; NL “buy $100 ETH” |
| **App** | Deposit/redeem pending UX, live book, mandate in English, last 50 CoreWriter actions (hash, action id, enqueue vs execute), owner kill switch | Pretending atomicity; APR screenshots |

Monsoon reuse is surgical: Salt policy names, executor loop shape, `HyperCoreQuoter.getMidPrice()` via `0x800` wrapped in `SafeL1Read`, dashboard shell minus Agent/Trade. Hackathon contracts at `0x77259d…` stay a museum.

### Where state lives

**HyperCore (source of truth for money and book).** Spot USDC, perp account value, open orders, fills, oracle/mark, L1 block. Never mirrored into vault storage as NAV.

**BrokRVault storage (source of truth for claims and pending).** ERC-20 shares; `pendingDeposits[]` / `pendingRedeems[]`; reserved EVM USDC that is **not** yet shareholder assets; `mandateHash`; caps (max leverage, max notional, asset allowlist, authorized keeper, `maxPendingCoreActions`, `maxInflightUsd`); `killSwitch`; `cloidCursor` and `pendingActions[cloid]`; `lastAcceptedOraclePx` **only** as a halt watermark, not as a price cache.

**Keeper process memory / disk (disposable).** Mandate YAML; per-action state machine; last Core snapshot used to *compute* quotes. After a crash this store is untrusted. Recovery is: on-chain cloid range + precompile open-orders + vault events.

**App (no authority).** Renders precompiles, events, Hyperscan. A stale UI cannot mint shares or pay a redeem.

**Why vault is the only CoreWriter caller (diagram shows a second arrow from the keeper).** CoreWriter executes as the calling EVM address’s Core identity. A keeper EOA would be a different Core account, so on-chain caps would not bind the book. Action 9 (API wallet) is how we later delegate trading without withdrawal; the plan already puts that in phase 2. Until then the keeper is an authorized *EVM caller of vault methods*, not a Core signer. This is an explicit tightening of the architecture diagram, not a change of intent. **Divergence:** the lane-C diagram draws CoreWriter arrows from both vault and keeper.

### Data flows

**Deposit (two-phase, shares after Core confirm).**
1. User `requestDeposit(usdc)` → vault pulls USDC, records pending, **does not mint**. Pending USDC is excluded from `totalAssets()`.
2. Crank (keeper or anyone) `bridgeDeposit(id)` → vault sends action 13 (EVM USDC → Core spot for `address(this)`). Action marked inflight. This tx succeeding is not confirmation.
3. After delay: crank `confirmDeposit(id)` reads spot (then action 7 into perp margin if policy says so) via `SafeL1Read`. Only then mint shares at the live share price.
4. If timeout and Core credit is absent and EVM funds are still reclaimable → `reclaimPending(id)` returns USDC. If Core *did* credit, reclaim is forbidden; confirm instead.

**Quote loop (maker inventory, not a hedge-on-deposit).**
1. Keeper reads Core NAV, position, open orders, oracle/mark.
2. Computes inventory-skew bid/ask (this ALM idea lives **only** in the keeper).
3. Off-chain policy gate (`gatedQuote`).
4. Vault `submitQuotes` re-checks on-chain caps, allocates cloids, action 11 cancel old range + action 1 new `tif = Alo` (maker-only). `Gtc` is allowed by the plan; defaulting to Alo is a specialization so a stale quote cannot take.
5. Wait delay. Verify open orders by cloid via precompile. Mismatch → retry/cancel-all/rebuild. Never mark “on the book” from the send receipt.

**Redeem (ERC-7540; sync `redeem()` in the same tx is a bug).**
1. `requestRedeem(shares)` locks confirmed shares.
2. Keeper cancels live cloids, flatten if policy requires (`gatedFlatten` always allowed to reduce), action 7 perp→spot if needed, action 13 Core→EVM.
3. `confirmRedeem` only after EVM USDC is actually back and reserved for that request. Then user claims. Pending state is visible the whole time.

**Kill / halt.** Owner kill switch or oracle-halt: stop quotes, cancel cloid range, flatten if `flatten_on_halt`. Flatten txs are still CoreWriter and still verified. The switch is a latch, not a fire-and-forget.

**NAV.** `totalAssets() = evmConfirmedCash + coreNAV(precompile) + inflightOfConfirmedShares − fees`. No cached Core NAV. `size == 0` (ADL) must not revert; share price moves with live Core equity.

---

## Interfaces/contracts between components

### CoreWriter (system, `0x333…3333`)

`sendRawAction(bytes)` — burns ~25k, emits a log, **does not revert if HyperCore later rejects**. Encoding: byte0 = `0x01`; bytes1–3 = action id; rest = ABI payload.

MVP actions only:

| ID | Action | Payload | Used for |
|---|---|---|---|
| 1 | Limit order | `(uint32 asset, bool isBuy, uint64 limitPx, uint64 sz, bool reduceOnly, uint8 tif, uint128 cloid)` | Quotes. `tif`: 1 Alo (default), 2 Gtc, 3 Ioc (flatten). `limitPx`/`sz` = `10^8 * human`. `cloid = 0` forbidden |
| 7 | USD class transfer | `(uint64 ntl, bool toPerp)` | Spot USDC ↔ perp margin |
| 10 | Cancel by oid | `(uint32 asset, uint64 oid)` | Reconcile when cloid missing |
| 11 | Cancel by cloid | `(uint32 asset, uint128 cloid)` | Crash recovery, replace, kill |
| 13 | Send asset | `(address dest, address sub, uint32 srcDex, uint32 dstDex, uint64 token, uint64 wei)` | EVM↔Core USDC; `uint32.max` = spot |

Orders and vault transfers are delayed “a few seconds” and show twice on explorers (enqueue, then execute). The keeper state machine **must** keep those as distinct states.

Not in MVP (plan phase 2+): 9 API wallet, 12 builder fee, 16 abstraction, 2 vault transfer, 17 HIP-3 outcomes, 3/4/5 staking.

Official TIF encoding from HL docs: `1` Alo, `2` Gtc, `3` Ioc. Cloid encoding: `0` means no cloid; we never send `0`.

### SafeL1Read → precompiles (`0x800+`)

Calls are to an allowlist: BTC perp id, USDC token id, `address(this)` as Core user. Gas stipend per frame so an invalid id cannot OOG the whole tx (precompiles consume **all gas in that frame** on bad input). Decimal conversion lives here only: perps `/ 10^(6-szDecimals)`, spot `/ 10^(8-base szDecimals)`, plus the USDC EVM-vs-Core wei table discovered in week 0.

Reads used: spot balance, perp position (tolerate `size == 0`), account value / isolated margin, oracle px, mark px, L1 block, open orders by cloid if exposed (else reconstruct from action log + oid cancels).

Precompiles have a gas cost of `2000 + 65 * (input_len + output_len)` on valid input. Invalid input still burns the entire stipend of that frame.

### BrokRVault surface (minimum)

```solidity
// 7540-style; 4626 deposit()/redeem() revert or proxy to request*
function requestDeposit(uint256 assets, address controller) external returns (uint256 requestId);
function bridgeDeposit(uint256 requestId) external;          // permissionless crank
function confirmDeposit(uint256 requestId) external;         // permissionless; precompile-gated
function reclaimPending(uint256 requestId) external;         // timeout + Core-not-credited

function requestRedeem(uint256 shares, address controller) external returns (uint256 requestId);
function confirmRedeem(uint256 requestId) external;          // EVM cash actually reserved
function claimRedeem(uint256 requestId, address receiver) external;

function submitQuotes(Quote[] calldata qs) external onlyKeeper whenNotKilled;
function cancelByCloid(uint128[] calldata cloids) external;  // keeper; anyone if killed
function flatten(Flatten[] calldata f) external;             // reduce-only; always allowed
function kill(bool on) external onlyKillOwner;

function totalAssets() public view returns (uint256);        // live, no Core cache
function mandateHash() external view returns (bytes32);
```

`confirm*` / `reclaimPending` are permissionless **because** the check is the precompile, not the keeper’s honesty. The plan assigns verify to the keeper operationally; making the function permissionless is how a dead keeper does not strand deposits. That is a divergence of *who may call*, not of *what counts as confirmed*.

On-chain caps (bind even if keeper key leaks): `assetAllowlist`, `maxLeverage`, `maxNotionalUsd`, `maxPendingCoreActions`, `maxInflightUsd`, `authorizedKeepers`, `killOwners`. Keeper cannot withdraw EVM USDC except by driving the 7540 path, which still requires Core confirm.

### Keeper ↔ vault

Keeper never calls `0x333` itself. It submits vault functions, then watches: (1) vault events (`ActionSubmitted(cloid, actionId, dataHash)`), (2) Hyperscan/explorer enqueue vs execute, (3) precompile verify. Off-chain mandate YAML must hash to `mandateHash`. Mismatch → refuse to quote (fail closed).

Off-chain gated verbs (plan): `gatedDeposit`, `gatedQuote`, `gatedFlatten` (always allow reduce), `gatedRedeem` (confirmed shares only).

Keeper state machine, never collapsed:

```
idle → encoded → submitted → enqueued → executed_or_rejected → verified
                                                              ↘ retry / reclaim
```

### Mandate contract

Versioned YAML/JSON, IPFS (or equivalent), `keccak256` posted on-chain by vault owner. UI renders English. Canary defaults from the plan (`brokr-core-mm-v1`):

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

`max_share_of_book` and inventory-skew are **keeper-only**. Enforcing book share on-chain would require a deep book read inside a small-block quote tx; we keep absolute notional on-chain and book-share off-chain. That split is the only way the 2M-gas small-block invariant survives.

### App ↔ chain

Read: vault, SafeL1Read, Hyperscan for CoreWriter log. Write: user deposit/redeem; owner kill. Never show “live on the book this transaction.” Last 50 actions: tx hash, action id, enqueue vs execute, verify result.

### Dual-block rule

- Quoting and cancels: small blocks (~1s, 2M gas).
- Vault deploy / batch settle: large blocks (~1 min, 30M gas).
- A quote tx that needs large-block cadence is a kill criterion.

---

## Failure taxonomy

Grounded in the week-6 catalog, the non-negotiable invariants, and the §13 risk table — not a generic DeFi list. **Ship gate:** any of these leaving *unhedged confirmed shares* is a do-not-ship.

### F1 — CoreWriter silent reject (size too small, insufficient margin, delist)

**Why it exists:** `sendRawAction` succeeds on EVM even when Core drops the action. Textbook death: EVM deposit/hedge “sent,” Core unchanged.

**Detect:** After the delay window, precompile (spot/position/open order by cloid) does not match the pending action. Explorer shows enqueue without execute, or execute with reject. Never treat the EVM receipt as evidence.

**Recover:** Do not mint, do not mark quotes on, do not pay redeem. Retry with a new cloid if policy still allows; else `reclaimPending` (deposits) or cancel-all + hold redeem in pending (exits). Public log records fail. **Kill the project** if reclaim cannot be demonstrated on testnet.

### F2 — Delay window: withdraw clicked while quotes still live

**Why it exists:** Orders are delayed a few seconds; EVM cannot be atomic with the book. A naive 4626 `redeem()` would pay out cash that still backs resting orders.

**Detect:** `requestRedeem` sees `pendingActions != 0` or precompile open orders for our cloid range.

**Recover:** Accept the redeem request (pending UX, not instant). Keeper must cancel (action 11) and verify cancels **before** action 13 Core→EVM and before `confirmRedeem`. If cancels fail, request stays pending; user is not paid from uncancelled inventory. Flatten if policy requires before bridging out.

### F3 — Keeper crash with open cloids (Precipitate: stalled state file)

**Detect:** Process gone; on-chain `cloidCursor` and `pendingActions` still populated; precompile still shows those cloids (or oids).

**Recover:** On restart, ignore local state. Cancel every cloid in `[lastReconciled, cursor]` (plan: “cancel every cloid we issued, then rebuild”). Then rebuild quotes only if not killed / not oracle-halted. Flatten if policy says unmanaged inventory is forbidden. This is why cloids are sequential and on-chain: an off-chain-only tracker *is* the stalled state file.

### F4 — Oracle jump > `max_oracle_move_bps` (SK Hynix class; validator/HIP-3 updater)

**Detect:** `SafeL1Read` mark/mid vs `lastAcceptedOraclePx` exceeds 150 bps (canary default) in one Core block (or since last accepted confirm — see assumptions). HIP-3 single-key `oracleUpdater` is why we do not quote HIP-3 in MVP.

**Recover:** Halt quoting immediately. Cancel cloids. If `flatten_on_halt`, reduce-only flatten and verify. Do not mint or redeem through the jump; NAV still follows live Core (depositors see the mark). **Kill if we cannot halt inside one delay window.** Resume only by owner after watermark reset, not automatically.

### F5 — ADL zeroes a position between blocks

**Detect:** Position precompile returns `size == 0` (or shrinks) without a fill/cancel we issued. Account value drops at oracle.

**Recover:** Inventory math and `totalAssets()` tolerate zero size without revert. Share price moves; do not freeze, do not underpay by using a stale position cache. Cancel resting quotes that assumed the old inventory, rebuild around remaining USDC. No “restore the hedge” fantasy — ADL is Core’s call.

### F6 — Invalid precompile input (bad asset id / vault address)

**Detect:** Precompile frame reverts and consumes all gas **in that frame**.

**Recover:** `SafeL1Read` allowlist + gas cap on an isolated call so the parent tx survives and returns a typed failure. Never forward user-supplied asset ids. Quote/confirm functions fail closed (no mint, no new orders). If this OOGs the whole tx in tests, we do not ship.

### F7 — Small-block gas limit exceeded (~1s, 2M gas)

**Detect:** Quote/cancel tx fails to include on small blocks, or simulated gas ≥ 2M.

**Recover:** Quotes and cancels only on small blocks, batched to cancel-2 + place-2 (both sides). Vault deploy / batch settle on large blocks (~1 min, 30M). If a quote path *requires* large-block cadence, the quoting loop is wrong — that is a kill criterion in the plan.

### F8 — Replace window: cancel+place both delayed (no modify action on CoreWriter)

**Why it exists:** Action 1 has no amend. Replace is cancel-by-cloid + new order. During delay we can be double-quoted, or quoted on neither side.

**Detect:** Precompile open orders ≠ intended set after delay (two cloids live, or zero).

**Recover:** Same as crash: cancel issued range, wait verify, place once. `max_pending_core_actions: 8` bounds how wide this window can get. Do not stack replaces while previous are unverified.

### F9 — Action 13 in-flight vs reclaim (EVM USDC already gone)

**Why it exists:** If sendAsset consumes EVM USDC before Core credits, `reclaimPending` cannot `transfer` what the vault no longer holds. Naive QuillAudits sample reclaim assumes the hedge did not take the ERC-20.

**Detect:** Pending timeout *and* (EVM balance of pending id is 0) *and* Core spot did or did not increase.

**Recover:** If Core credited → confirm, never reclaim (else double-pay). If Core did not credit and EVM cash is still in the vault → reclaim. If neither (true silent bridge loss) → halt deposits, public incident, do not mint; this is the week-3/4 empirical gate. **Do not ship until this case is observed on testnet and the winner path is coded, not assumed.**

### F10 — Keeper key leak

**Detect:** Unexpected `submitQuotes` from the keeper address; policy-breaking order attempts.

**Recover:** On-chain caps must make drain-via-trade the worst case (size/leverage/venue), not `transfer` of EVM USDC. Owner kill + cancel-all. Rotate keeper. Action 9 later so the leaked key cannot be a withdrawer. **Kill if a leaked key can drain EVM USDC.**

### F11 — Unhedged confirmed shares (the actual product-failure)

This is the composition of F1+F5+F9: shares exist, Core inventory does not match mandate.

**Detect:** Invariant monitor each Core block: `confirmedShares > 0` ⇒ Core USDC + position equity + inflight ≈ `totalAssets` within dust; no interval longer than one delay window where confirmed shares have no Core backing.

**Recover:** Halt, flatten/reclaim as above, incident note. Week-8 ship gate: **no silent unhedged interval > 1 Core delay window.** 90-day success: zero silent unhedged confirmed shares.

Not in this taxonomy (plan risks, but not runtime survive-modes): Buoy narrative, operators never migrate, US solicitation, HIP-3 deployer concentration (we simply do not deploy).

---

## Explicit assumptions and open questions

### Assumptions (plan was silent or internally tense)

1. **Vault is the sole CoreWriter caller in MVP.** Diagram shows keeper also sending; see architecture. Action 9 is how that changes.

2. **`confirm*` / `reclaimPending` are permissionless cranks.** Plan describes the keeper verifying; the *predicate* is a precompile read, so anyone can crank. Keeper liveness is operational, not a trust assumption for mint/burn.

3. **Pending deposits/redeems are excluded from `totalAssets()`.** The plan writes `totalAssets() = evm + coreNAV + inflight − fees`. Counting pending-but-unminted USDC in `evm` inflates share price for existing holders, then minting dilutes them — an inflation/donation bug. **This is a divergence from the formula as written, in service of invariant 1 (live precompile NAV for *shareholders*).** `inflight` means only in-transit funds that already belong to confirmed shares.

4. **Confirm = Core USDC credited, not `position.size != 0`.** QuillAudits’ sample `confirmDeposit` requires a hedge size. BrokR is a maker-inventory vault; a deposit should not require a directional position. We follow the plan’s “shares mint when Core margin is confirmed.”

5. **“Isolated-only in MVP” without action 16.** Action 16 is phase 2, but invariant 5 demands isolated. Reconciliation: one market (BTC), one quote asset (USDC) — contagion-by-construction is avoided even if the Core account is default cross. True protocol isolated / abstraction comes with action 16. We will not send action 16 in MVP.

6. **Default quote TIF is Alo, not Gtc.** Plan says “Alo or Gtc.” Alo prevents a delayed order from taking after the book moves. Flatten uses Ioc + `reduceOnly`.

7. **Canary fees = 0.** Plan subtracts fees in NAV but never specifies a rake. Charging 10% would look like Vault 1.0; advertising APR is forbidden. Performance fee is a later operator ask, not a week-8 feature.

8. **`PENDING_TIMEOUT` = 15 minutes for deposit/redeem, 60 seconds for quote verify.** Must be ≫ “a few seconds” Core delay plus retries, short enough that users are not stranded. Exact numbers are canary knobs.

9. **`lastAcceptedOraclePx` is stored.** Invariant 1 forbids cached Core NAV. A halt watermark is a different object: without it, a keeper that was down during the jump has no baseline. It is not used in `totalAssets()`.

10. **Cloid space is a monotonic on-chain cursor**, starting at 1. Recovery is a range cancel. Off-chain ActionTracker is a cache.

11. **No ERC-7887 in MVP** (hypurrquant has cancel-redeem). Plan does not mention it. Users wait in pending; they do not get a cancel-claim path until we have seen redeem latency on testnet. Adding 7887 now would steal week-4 budget from reclaim, which is the actual product.

12. **USDC is the linked HyperEVM token** whose Core index we discover in week 0. We do not invent token ids in this spec.

13. **Inventory-skew lives only in the keeper.** On-chain Sovereign Pool is out of scope even as an implementation detail.

14. **Dedicated mainnet RPC, no Anvil fork as the real harness.** Foundry mocks exist for encoding and “write succeeded, read empty”; live testnet is the gate.

### Open questions (need a decision before build, or in week 0 before vault code)

**Q1. Action 13 token movement and bounce.** If Core rejects sendAsset, does ERC-20 return to the vault automatically, stay locked in a system account, or vanish until support? Reclaim implementation is blocked on an observed testnet answer. Do not code reclaim as `transfer(user, amount)` until that experiment.

**Q2. How open orders are read on-chain.** If there is no precompile for “orders by cloid,” verification is explorer/API + cancel-by-cloid (idempotent). That weakens on-chain `confirmQuotes` and pushes verify fully off-chain. Week 0 must print the L1Read method table and say which.

**Q3. Isolated margin mechanics without action 16.** Confirm with HL docs/testnet whether a one-market account can liquidate against unused spot, and whether we must call an undocumented isolated-margin action. If yes, it is an MVP action and the phase-2 list is wrong.

**Q4. Share price at `confirmDeposit`.** Mint at confirm-time live NAV (depositor takes delay-window P&L) vs mint at request-time snapshot (existing holders take it). Plan is silent. Recommendation: **confirm-time live NAV**, because a snapshot would put unconfirmed capital in the pool’s P&L and fights assumption 3.

**Q5. Kill-switch cooldown.** YAML has `cooldown_sec: 0`. Is that time-to-activate, min time before resume, or something else? Recommendation: kill is latching; resume is an explicit owner call; 0 means no extra wait.

**Q6. Who is `authorizedKeeper` for the canary — EOA vs timelocked multisig.** Plan allows one person in two seats. A hot EOA is acceptable for $25k iff on-chain caps are live; still needs a second key on `killOwners`.

**Q7. ERC-7540 operator / controller.** Plan does not say whether a router can deposit on behalf of a user. Recommendation: controller = `msg.sender` only in MVP; no operator approvals until we have a depositor who needs them.

**Q8. Testnet BTC asset id, USDC token id, szDecimals, and whether testnet delay matches mainnet.** Blocks encoding tests.

**Q9. Design partner.** Week 0 item 5: will a Vault 1.0 operator deposit $1k on testnet? If nobody will even look, the plan’s kill criterion on operator migration starts now, not week 8.

Until Q1 and Q2 are answered on testnet, vault Solidity should not be considered specified enough to freeze.

---

# BUILD PLAN

The plan’s 8-week shape is kept. Phases are dependency-ordered. Near-term is **Phase 0 (week 0)** — empirical CoreWriter facts the rest of the spec is waiting on. Nobody ships quotes without the failure catalog (Phase 4). Do not add a factory, agent chat, HIP-3, or action 9 until the kernel has a silent-fail-free canary.

Tech stack (from the plan, unchanged): Foundry / Solidity on HyperEVM (chain id 999); TypeScript keeper (`nktkas` / official HL SDK + viem); direct precompile reads, Hyperscan for humans; Next.js app; JSON mandate on IPFS + hash on-chain + TS validator + Solidity caps; testnet `https://rpc.hyperliquid-testnet.xyz/evm`; dedicated mainnet RPC.

---

## Phased milestones

### Phase 0 — Week 0 rehearsal (near-term deliverable)

**Depends on:** nothing. **Blocks:** every later phase.

**Build / do:**
1. Read HL vaults + CoreWriter docs end to end; print the action table (already partially in this spec).
2. Clone `L1Read.sol` / `CoreWriter.sol` into `contracts/src/hypercore/` (not the museum ALM).
3. Stand up `https://rpc.hyperliquid-testnet.xyz/evm` + a funded test account.
4. Throwaway contract: one action 13 (sendAsset USDC) and one action 1 (limit order). Watch enqueue vs execute on Hyperscan/explorer. Record: delay seconds, what happens to ERC-20 on reject, which precompile shows spot and open orders, asset/token ids, decimals.
5. Operator outreach: public reply / DM that we are building the HyperEVM vault they asked for; testnet in 6 weeks; $1k testnet deposit = design partner.
6. Freeze scope: BTC, USDC, isolated-by-construction, no factory, no agent chat, no Valantis.

**Measure:** a written lab note with: delay distribution; reject bounce behavior (Q1); precompile method list (Q2); token/asset ids (Q8).

**Done:** those six boxes ticked; Q1/Q2 answered empirically; scope freeze committed in-repo; throwaway addresses recorded as disposable.

**What could go wrong:** testnet USDC faucet/bridge missing; sendAsset semantics not what docs imply; no open-order precompile; nobody answers the operator ping.

**Evidence to leave Phase 0:** a replayable script and explorer links for enqueue→execute *and* at least one reject; a one-pager on reclaim implications; ids in a constants file. If Q1 is “funds can vanish,” stop and redesign reclaim before Phase 2.

**Manual vs agent:** **Human-led.** Watching enqueue vs execute, judging bounce behavior, and talking to operators are judgment calls. An agent may scaffold the throwaway contract and `cast` scripts, but a human must sign the lab note. Docs-clone is agent-fine.

---

### Phase 1 — Weeks 1–2: kernel

**Depends on:** Phase 0 ids, encoding, gas behavior.

**Build:** `SafeL1Read.sol` (allowlist, gas-capped frames, decimal table). `CoreWriterLib.sol` (actions 1, 7, 10, 11, 13, version `0x01`). `ActionTracker` (on-chain cloid cursor + pending map + timeout). Foundry mocks of `0x800` / `0x333` including **“write succeeds, later read shows no fill / no balance.”**

**Deploy:** testnet throwaway using the libs, not the vault yet.

**Measure:** mock coverage of F1, F6; live script: deposit mock USDC → action 13 → wait → read spot; fail path reclaims *as Phase 0 taught us*.

**Done (plan exit check):** that script is green on testnet, including reclaim.

**What could go wrong:** decimal footgun (EVM 6 vs Core 8); gas cap still OOGs parent; mock too weak so tests pass and live fails.

**Evidence to leave Phase 1:** CI green on the silent-fail mock; testnet tx hashes for success + reclaim; no unbounded precompile call in the diff.

**Manual vs agent:** **Agent implements, human reviews SafeL1Read gas and decimals.** Encoding is mechanical. The live reclaim script should be run by a human once even if the agent wrote it — this is the product’s existence proof.

---

### Phase 2 — Weeks 3–4: vault

**Depends on:** kernel libs; Q1 reclaim path.

**Build:** `BrokRVault.sol` ERC-4626 + ERC-7540 async deposit/redeem. Two-phase + `reclaimPending` after `PENDING_TIMEOUT`. `totalAssets()` per assumption 3 (exclude unminted pending). Isolated-by-construction, BTC only. On-chain caps + `mandateHash` + kill latch. Permissionless confirm/reclaim.

**Deploy:** HyperEVM testnet vault + policy hash.

**Measure:** deposit 1,000 USDC → Core USDC appears → shares mint. Kill RPC mid-flight → reclaim (or confirm-if-credited) works. Share price does not include pending USDC.

**Done:** that exit check, plus a unit test that 4626 sync `redeem()` cannot pay during live cloids.

**What could go wrong:** minting on send instead of confirm (hypurrquant-shaped regression); pending included in NAV; confirm requires a perp position (QuillAudits sample cargo-cult); bytecode over 24,576 — split libs like hypurrquant if needed, that’s an implementation tactic, not a product change.

**Evidence to leave Phase 2:** testnet deposit/mint/reclaim traces; invariant tests for ADL `size == 0` and pending-excluded NAV; operator (if any) can read the mandate hash.

**Manual vs agent:** **Agent writes the vault; Contracts seat (human) owns share math.** An autonomous agent should not be allowed to “simplify” deposit into single-tx mint. Human review of `totalAssets` and reclaim is mandatory. Bytecode-splitting is agent-fine.

---

### Phase 3 — Week 5: quoting loop

**Depends on:** vault confirm path; cloid tracker; policy gate.

**Build:** Keeper in TypeScript (`nktkas` / official HL SDK + viem), from Monsoon executor. Inventory-skew spreads. `submitQuotes` with Alo + unique cloid. Replace = cancel range + place, never stacked on unverified pendings. Policy gate before every send. Flatten/kill paths.

**Deploy:** keeper against testnet vault, small size.

**Measure (plan exit check):** vault quotes both sides; a fill moves inventory; spread widens on the heavy side; NAV updates from precompile (not from fill websocket).

**Done:** that, plus crash-restart once with live cloids (F3 rehearsal, cheaper here than week 6).

**What could go wrong:** quotes need large-block gas (kill); Gtc takes accidentally; double-quote in replace window; keeper uses REST API as a side door around caps.

**Evidence to leave Phase 3:** small-block gas reports under 2M; Hyperscan log of action 1/11 with enqueue≠execute states; a fill whose NAV change matches precompile equity; no REST-signed orders from the keeper key.

**Manual vs agent:** **Agent builds the state machine and encoding; human owns spread parameters and watches the first live quotes.** Quote model is strategy (Keeper seat). Wiring and cloid reconcile are agent-appropriate. Do not let an agent “just use the HL API, it’s easier” — that bypasses on-chain caps.

---

### Phase 4 — Week 6: failure catalog (before mainnet, before polishing the app)

**Depends on:** Phases 1–3 working on testnet.

**Build:** Replay scripts, in this order: (1) CoreWriter reject, (2) withdraw while quotes live, (3) keeper crash with open cloids, (4) oracle jump > 150 bps, (5) ADL / forced `size == 0`, (6) invalid asset id precompile, (7) small-block 2M overflow. Plus F8 replace-window and F9 action-13/reclaim from this spec.

**Deploy:** nothing new; attack the testnet vault.

**Measure:** for each, confirmed shares never unhedged; reclaim or flatten as specified; public-log shaped events exist even if the UI does not.

**Done:** written catalog with tx hashes. **If any case leaves unhedged confirmed shares, we do not ship — and we do not start the app week as a consolation prize.**

**What could go wrong:** cannot induce ADL or oracle jump on testnet (document the mock + the closest live proxy); catalog becomes a slide deck without hashes.

**Evidence to leave Phase 4:** seven-plus incident writeups with hashes; invariant monitor script that would have caught each; human sign-off from Contracts + Keeper seats.

**Manual vs agent:** **Human-led, agent-scripted.** Agents are good at writing the replay harness. Only a human can judge “this would have been unhedged in production.” The plan’s “nobody ships quotes without the failure catalog” is a people rule.

---

### Phase 5 — Week 7: app + mandate page

**Depends on:** vault + keeper events stable enough to render; catalog not necessarily “pretty,” but the log schema frozen.

**Build:** Next.js from Monsoon dashboard shell. Deposit/redeem pending states. Live quotes, fills, leverage, oracle vs mark, last 50 CoreWriter actions (hash, action id, enqueue vs execute). Mandate in English. Owner kill button. Builder code optional, **default off**.

**Deploy:** public testnet UI, no APR widget.

**Measure:** a stranger can see pending vs confirmed; kill is one click and produces cancels on the log.

**Done:** UX never claims atomicity; mandate readable; kill exercised from the button (not only from `cast`).

**What could go wrong:** UI reads keeper memory instead of precompiles; “you’re live” copy sneaks in; week 7 eats week 6 time.

**Evidence to leave Phase 5:** screenshot/script of pending deposit, failed CoreWriter row, kill→flatten. App is not a ship gate; the catalog is.

**Manual vs agent:** **Agent implements UI; human writes English mandate copy and reviews the log semantics.** Messaging constraints (“do not say atomic hedge / AI agent / 56% APR”) are a human checklist.

---

### Phase 6 — Week 8: mainnet canary

**Depends on:** Phase 4 green; dedicated mainnet RPC; seed capital.

**Build/deploy:** vault, policy hash, keeper, app pointed at mainnet. Seed **$25k** (plan range $25–100k team+friends, not $150k+ strangers). Public wallet, public mandate, public log.

**Measure:** 7 days quoting; daily written incident notes; redeem of 10% of TVL completes; no silent unhedged interval > 1 delay window; no policy breach.

**Done (ship gate):** those four. Then we have earned talking to operators as a product, not as a promise.

**What could go wrong:** public RPC rate-limit (Trading Strategy lesson); seed size too small to sit on the book; first incident handled by “restart the keeper” without a note; legal/US solicitation creep.

**Evidence to leave Phase 6 / start After-MVP:** 7 daily notes; redeem tx; monitor showing zero unhedged gaps; kill drill on mainnet at least once (tiny size).

**Manual vs agent:** **Manual ops, agent monitors.** Capital, kill, incident judgment, and the public post are human. An agent may run the invariant monitor and draft incident notes from logs; a human publishes them. Do not autonomous-trade the canary.

---

### Phase 7 — After MVP (only if week 8 is green)

Order from the plan, unchanged: (1) action 9 agent wallet — keeper trades, contract remains only withdrawer; (2) ETH, then one HIP-3 name with tight oracle-halt (not SK Hynix-class); (3) spot inventory so idle USDC sits on Core spot; (4) HIP-3 quoting-as-a-service; (5) policy-as-a-service for agent teams. **No vault factory until 30 days mainnet without a silent-fail incident.**

**90-day success (plan):** zero silent unhedged confirmed shares; public BTC maker vault $100–500k redeemable; at least one external operator on our keeper or a written “no”; published post “CoreWriter will fail; here is the state machine.”

---

## Phase risks and evidence gates

| Phase | Worst failure | Gate to proceed |
|---|---|---|
| 0 | Mis-read sendAsset bounce | Lab note + explorer links answering Q1/Q2 |
| 1 | Decimals / OOG | Silent-fail mock + live reclaim script |
| 2 | Shares minted unhedged | 1,000 USDC testnet mint-after-confirm; RPC-kill reclaim |
| 3 | Quotes on large blocks / cap bypass | <2M gas; fills; NAV from precompile; no REST orders |
| 4 | Catalog item leaves unhedged shares | Hashed replays; **stop ship** |
| 5 | UI lies about atomicity | Pending + fail row + kill visible |
| 6 | Silent unhedged on mainnet | 7-day notes; 10% redeem; delay-window invariant |
| 7 | Surface area before kernel is proven | 30 silent-fail-free days |

---

## Manual vs autonomous agent

Use an agent where the spec is closed and the test is mechanical: encoding, Foundry mocks, vault boilerplate, keeper state machine, UI scaffolding, replay harnesses, invariant monitors.

Keep a human on the loop wherever **the plan’s product is a judgment about Core reality**: week-0 explorer reading, decimal/token identity, share math, reclaim when funds might be in neither place, first live quotes, failure-catalog “would this have been unhedged,” canary capital, kill switch, operator conversation, and the public post.

That split matches the three seats (Contracts, Keeper, App/operator). One person can wear two seats for the canary. An agent can wear none of them for ship gates.

---

## Divergences from `lane-c-plan.md` (index)

| # | Plan says | This spec | Why |
|---|---|---|---|
| D1 | Architecture diagram: keeper and vault both call CoreWriter | Vault is sole CoreWriter caller in MVP | CoreWriter identity is the calling EVM address; otherwise on-chain caps do not bind the book. Action 9 is the later escape. |
| D2 | Keeper verifies | `confirm*` / `reclaimPending` are permissionless; predicate is the precompile | Dead keeper must not strand deposits. Same confirmation rule, different caller set. |
| D3 | `totalAssets() = evm + coreNAV + inflight − fees` | Pending unminted USDC excluded from `evm`; inflight is confirmed-share transit only | Including pending inflates then dilutes share price. |
| D4 | “Alo or Gtc” | Default Alo; Ioc+reduceOnly for flatten | Delayed Gtc can take after the book moves. |
| D5 | Isolated-only in MVP *and* action 16 in phase 2 | Isolated-by-construction (BTC + USDC only); no action 16 in MVP | Resolves the plan’s internal tension without pulling phase-2 surface into the canary. |
| D6 | Fees subtracted in NAV, rake unspecified | Canary fees = 0 | Avoid Vault 1.0 10% and APR theater. |
| D7 | (silent) | No ERC-7887 in MVP | Reclaim is the product; cancel-redeem is week-4 budget theft. |
