# BrokR — Design Spec & Build Plan

**Working Name:** BrokR  
**Lane:** C — HyperEVM Vault Mirroring Inventory onto HyperCore Orderbook  
**Date:** 22 Aug 2026  
**Reference Document:** `lane-c-plan.md`  

---

# 1. DESIGN SPEC

---

### 1.1 System Overview and Core Architecture

BrokR is an asynchronous, policy-governed asset management system designed specifically for the dual-state Hyperliquid architecture: HyperEVM (EVM execution environment) and HyperCore (native high-performance orderbook and perpetuals engine).

Unlike standard EVM vaults where state transitions are atomic, HyperCore mutations via the `CoreWriter` precompile (`0x3333...3333`) are asynchronous and non-reverting on EVM. A transaction calling `CoreWriter` logs an intention that executes on HyperCore several seconds later; the EVM frame receives a success status even if HyperCore subsequently drops or rejects the action due to margin, lot size, or oracle conditions. 

BrokR resolves this fundamental mismatch by implementing a **Two-Phase Commit (2PC) architecture**:
1. EVM custody holds capital in pending escrow.
2. An off-chain Keeper forwards actions to HyperCore and monitors execution.
3. Share minting and redemption are finalized only after HyperCore state is verified via read precompiles (`0x0800+`).
4. Hard on-chain and off-chain policy boundaries (Salt Policy Kernel) constrain all state transitions.

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │                  BrokR Web UI (Next.js)                 │
                                  │  • Pending/Confirmed Vault UX   • Live CoreWriter Logs  │
                                  │  • Plain-English Mandate View   • Emergency Kill Switch │
                                  └────────────────────────────┬────────────────────────────┘
                                                               │
                                         ┌─────────────────────┴─────────────────────┐
                                         │ RPC / WebSocket                           │ User / Owner Tx
                                         ▼                                           ▼
┌──────────────────────────────────────────────────────────────────┐       ┌─────────────────────────────────────────────────┐
│                      Off-Chain TS Keeper                         │       │           BrokRVault.sol (HyperEVM)             │
│                                                                  │       │                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │       │  ┌───────────────────────────────────────────┐  │
│  │                     Salt Policy Engine                     │  │       │  │          ERC-4626 / ERC-7540 Engine       │  │
│  │ • OBOrderPolicy       • LeveragePolicy                     │  │       │  │ • requestDeposit()    • requestRedeem()   │  │
│  │ • OracleHaltPolicy    • DepositPolicy / KillSwitch         │  │       │  │ • fulfillDeposit()    • fulfillRedeem()   │  │
│  └─────────────────────────────┬──────────────────────────────┘  │       │  │ • reclaimPendingDeposit()                 │  │
│                                │ verified intent                 │       │  └─────────────────────┬─────────────────────┘  │
│  ┌─────────────────────────────▼──────────────────────────────┐  │       │                        │                        │
│  │                     Quoting & State Engine                 │  │       │  ┌─────────────────────▼─────────────────────┐  │
│  │ • Avellaneda-Stoikov Inventory Skew Model                  │  │       │  │             On-Chain Policy Caps          │  │
│  │ • CLOID Allocator & Pending Tracker                        │  │       │  │ • Max Leverage Cap    • Venue Allowlist   │  │
│  │ • Crash Recovery & Reconciliation Loop                     │  │       │  │ • Max Position Size   • Authorized Keeper │  │
│  └───────────────┬────────────────────────────┬───────────────┘  │       │  └─────────────────────┬─────────────────────┘  │
└──────────────────┼────────────────────────────┼──────────────────┘       └────────────────────────┼────────────────────────┘
                   │ L1 Reads                   │ Submits Core Actions                              │ Calls CoreWriter
                   │ (0x0800+)                  │ (Action 1, 7, 10, 11)                             │ (Action 13: sendAsset)
                   ▼                            ▼                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                  HyperCore Precompiles                                                     │
│                                                                                                                            │
│      ┌──────────────────────────────────┐                      ┌────────────────────────────────────────────────────┐      │
│      │    Read Precompiles (0x0800+)    │                      │             CoreWriter (0x3333...3333)             │      │
│      │  • Positions & Margin Balance    │                      │  • Action 1: Limit Order (Maker Quoting)           │      │
│      │  • Mid/Mark Oracle Prices        │                      │  • Action 7: USD Class Transfer (Spot <-> Perp)    │      │
│      │  • L1 Block Timestamp / Nonce    │                      │  • Action 10/11: Cancel Order by CLOID / OID       │      │
│      │                                  │                      │  • Action 13: Send Asset (EVM <-> HyperCore Spot)  │      │
│      └────────────────┬─────────────────┘                      └──────────────────────────┬─────────────────────────┘      │
└───────────────────────┼───────────────────────────────────────────────────────────────────┼────────────────────────────────┘
                        │ Reads live state                                                  │ Delayed batch execution (~1-3s)
                        ▼                                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              HyperCore Native Engine (L1)                                                  │
│                                                                                                                            │
│                 [ BTC-USD Perp Orderbook ]  ◄────────►  [ Vault Isolated Margin Account ]                                  │
│                 [ Live Bids / Asks / Fills]              • Collateral: USDC                                                │
│                                                          • Inventory Position: Net BTC                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### State Ownership and Localization

| State Domain | Primary Location | Authority / Source of Truth | Mutation Path |
|---|---|---|---|
| **EVM Cash & Pending Deposits** | `BrokRVault.sol` (HyperEVM) | HyperEVM Storage | User `requestDeposit()`, Keeper `fulfillDeposit()`, or User `reclaimPendingDeposit()`. |
| **Share Token Balances & Claims** | `BrokRVault.sol` (ERC-4626/7540) | HyperEVM Storage | Minted only on verified 2PC confirm; burned upon withdrawal fulfillment. |
| **Core Margin & NAV** | HyperCore L1 Account State | Precompiles `0x0800+` (Direct Read) | Mutated by HyperCore matching engine; queried dynamically on EVM via `SafeL1Read.sol`. **Never cached in EVM storage.** |
| **Active Maker Quotes & Positions**| HyperCore Orderbook / Margin Engine | HyperCore L1 State | `CoreWriterLib` -> `CoreWriter (0x3333...)` with delayed asynchronous execution. |
| **In-Flight Action Map & CLOIDs** | Keeper In-Memory + SQLite WAL | Off-Chain Keeper State | Generated deterministically per quote/transfer cycle; verified against L1 blocks. |
| **Risk Policy Mandate** | HyperEVM (`mandateHash`) & Off-Chain JSON | On-chain hash / Off-chain JSON | Set by Vault Owner; validated on-chain by `BrokRVault.sol` and off-chain by Keeper. |

---

### 1.2 Interfaces and Contracts Between Components

#### `SafeL1Read.sol`
Wraps raw precompile subcalls (`0x0800+`). HyperCore read precompiles consume all allocated gas in the call frame if supplied with an invalid asset ID, non-existent account, or unallowlisted venue. `SafeL1Read` enforces an asset allowlist and wraps the low-level `staticcall` with a strict gas stipend.

```solidity
interface ISafeL1Read {
    struct CorePosition {
        int256 szi;             // Base position size (scaled 1e6)
        uint256 entryPx;        // Entry price (scaled 1e6)
        int256 unrealizedPnl;   // Unrealized PnL in USDC (scaled 1e6)
        uint256 marginUsed;     // Margin allocated (scaled 1e6)
    }

    struct CoreAccountSummary {
        uint256 totalMarginUsd; // Total account value on HyperCore (1e6)
        uint256 spotBalanceUsd; // Unallocated spot USDC on Core (1e6)
        CorePosition btcPerp;   // Isolated BTC-USD position
    }

    function getSafeAccountSummary(address coreAccount) external view returns (bool success, CoreAccountSummary memory summary);
    function getSafeMidPrice(uint32 assetId) external view returns (bool success, uint256 midPrice, uint256 markPrice);
}
```
*Design Justification:* Wrapping precompile calls with explicit gas limits and allowlisted IDs prevents an RPC or precompile anomaly from bricking `totalAssets()` and halting vault accounting.

---

#### `CoreWriterLib.sol` & `ICoreWriter.sol`
Encodes and executes serialization for `0x3333...3333` using the wire specification (`version = 0x01`).

```solidity
interface ICoreWriter {
    function sendRawAction(bytes calldata action) external payable;
}

library CoreWriterLib {
    uint8 public constant CORE_WRITER_VERSION = 0x01;
    
    // Action 1: Limit Order
    function encodeLimitOrder(
        uint32 assetId,
        bool isBuy,
        uint64 limitPx,
        uint64 sz,
        bool reduceOnly,
        uint8 tif,           // 0: Alo (Post-Only), 1: Gtc, 2: Ioc
        uint128 cloid
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            CORE_WRITER_VERSION,
            uint8(1),        // Action ID 1
            assetId,
            isBuy,
            limitPx,
            sz,
            reduceOnly,
            tif,
            cloid
        );
    }

    // Action 7: USD Class Transfer (Spot <-> Perp)
    function encodeUsdClassTransfer(uint64 amountUsd, bool toPerp) internal pure returns (bytes memory) {
        return abi.encodePacked(CORE_WRITER_VERSION, uint8(7), amountUsd, toPerp);
    }

    // Action 10/11: Cancel Order by CLOID / OID
    function encodeCancelByCloid(uint32 assetId, uint128 cloid) internal pure returns (bytes memory) {
        return abi.encodePacked(CORE_WRITER_VERSION, uint8(11), assetId, cloid);
    }

    // Action 13: Send Asset (HyperEVM -> HyperCore Spot)
    function encodeSendAsset(uint32 assetId, address toCoreAccount, uint64 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(CORE_WRITER_VERSION, uint8(13), assetId, toCoreAccount, amount);
    }
}
```

---

#### `BrokRVault.sol` (HyperEVM Core Vault Contract)
Implements ERC-4626 with ERC-7540 asynchronous extensions for two-phase settlement.

```solidity
interface IBrokRVault {
    struct PendingDeposit {
        address receiver;
        uint256 assets;
        uint256 requestedAt;
        uint256 depositId;
    }

    struct PendingRedeem {
        address receiver;
        address owner;
        uint256 shares;
        uint256 requestedAt;
        uint256 redeemId;
    }

    event DepositRequested(uint256 indexed depositId, address indexed sender, address indexed receiver, uint256 assets);
    event DepositFulfilled(uint256 indexed depositId, address indexed receiver, uint256 sharesMinted, uint256 assetsCommitted);
    event PendingDepositReclaimed(uint256 indexed depositId, address indexed receiver, uint256 assetsRefunded);
    
    event RedeemRequested(uint256 indexed redeemId, address indexed sender, address indexed receiver, uint256 shares);
    event RedeemFulfilled(uint256 indexed redeemId, address indexed receiver, uint256 assetsPaid, uint256 sharesBurned);
    event EmergencyHaltTriggered(string reason, uint256 timestamp);

    function requestDeposit(uint256 assets, address receiver) external returns (uint256 depositId);
    function fulfillDeposit(uint256 depositId) external returns (uint256 shares);
    function reclaimPendingDeposit(uint256 depositId) external returns (uint256 assets);

    function requestRedeem(uint256 shares, address receiver, address owner) external returns (uint256 redeemId);
    function fulfillRedeem(uint256 redeemId) external returns (uint256 assets);

    function totalAssets() external view returns (uint256);
    function triggerEmergencyKillSwitch() external;
}
```

---

#### Off-Chain Keeper Interfaces (TypeScript)

```typescript
export interface MandatePolicy {
  mandateId: string;
  quoteAsset: "USDC";
  markets: [{
    asset: "BTC";
    assetId: 0;
    maxLeverage: number;         // e.g. 3.0
    maxNotionalUsd: number;      // e.g. 250_000
    maxInventorySkew: number;    // e.g. 0.25 (-25% to +25% net delta)
  }];
  spreadBps: { min: number; max: number; inventoryMult: number };
  maxShareOfBook: number;        // e.g. 0.08 (8% of top 3 levels)
  maxOracleMoveBps: number;      // e.g. 150 bps (1.5% jump halt)
  flattenOnHalt: boolean;
  maxPendingCoreActions: number; // e.g. 8
  maxInflightUsd: number;        // e.g. 50,000
  killSwitch: { owners: string[]; cooldownSec: number };
  venuesAllow: ["hypercore-perp"];
}

export type CLOID = `0x${string}`; // uint128 formatted hex string

export interface ActionRecord {
  cloid: CLOID;
  actionId: number;              // 1: Limit, 7: UsdTransfer, 11: Cancel, 13: SendAsset
  state: "ENCODED" | "SUBMITTED" | "ENQUEUED" | "EXECUTED" | "VERIFIED" | "REJECTED" | "TIMED_OUT";
  submittedTxHash: string;
  submittedBlock: number;
  expectedDeltaUsd: number;
  lastCheckedBlock: number;
}
```

---

### 1.3 Failure Taxonomy: Hyperliquid Failure Modes, Detection & Recovery

```
                             ┌───────────────────────────────────┐
                             │       Core Action Initiated       │
                             └─────────────────┬─────────────────┘
                                               │
                                               ▼
                             ┌───────────────────────────────────┐
                             │  State: SUBMITTED (Delay Window)  │
                             └─────────────────┬─────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
             [ Precompile Read Poll ]                         [ Polling Timeout ]
                       │                                               │
         ┌─────────────┴─────────────┐                                 │
         │                           │                                 ▼
   Delta Verified            No Delta Detected               ┌───────────────────┐
         │                           │                       │  State: TIMED_OUT │
         ▼                           ▼                       └─────────┬─────────┘
┌──────────────────┐       ┌──────────────────┐                        │
│ State: VERIFIED  │       │ State: REJECTED  │                        ▼
└──────────────────┘       └─────────┬────────┘              ┌───────────────────┐
                                     │                       │  Trigger Reclaim  │
                                     └──────────────────────►│  or Cancel Retries│
                                                             └───────────────────┘
```

| ID | Specific Failure Mode | Root Cause / Vulnerability | Concrete Detection Method | Deterministic Recovery Behavior |
|---|---|---|---|---|
| **F1** | **Silent CoreWriter Order Drop** | HyperCore rejects order asynchronously (e.g. lot size floor, post-only cross, margin breach). EVM call succeeded with tx receipt. | Keeper tracks `cloid` in `ActionTracker`. After $N$ blocks ($> 5$s delay window), `SafeL1Read` shows no open order matching `cloid` and no position change. | Mark action `REJECTED`. Re-evaluate book state via precompile. Recompute valid price/size within policy parameters and submit fresh `cloid`. Zero EVM state corruption. |
| **F2** | **Inflight Deposit Transfer Failure** | Action 13 (Send Asset to Core) or Action 7 (USD Transfer) fails/drops on L1. Funds remain in limbo between EVM and Core margin. | `ActionTracker` flags `depositId` as pending. After `PENDING_TIMEOUT` (e.g., 60 HyperEVM blocks / ~60s), `SafeL1Read` shows Core spot balance did not increase. | User or Keeper calls `reclaimPendingDeposit(depositId)`. Vault transfers reserved USDC from pending escrow back to depositor. Share issuance canceled. |
| **F3** | **Withdrawal Frontrunning Active Inventory** | User calls `requestRedeem()` while 100% of vault NAV is committed as active margin/bids on HyperCore book. | Vault detects requested redemption assets exceed EVM cash buffer (`idleCash < redeemAssets`). | 1. Keeper pauses quoting.<br>2. Submits Action 11 (Cancel all open `cloid`s).<br>3. Flattens inventory if needed to free margin.<br>4. Calls Action 7 + 13 to bridge USDC back to EVM.<br>5. Calls `fulfillRedeem()` once precompile confirms EVM balance. |
| **F4** | **Keeper Process Crash with Live Orders** | Host crash, RPC partition, or OOM event while maker orders sit on the live orderbook. | On restart, Keeper detects non-empty `ActionTracker` WAL file or unverified active state. | 1. Keeper queries L1 active orders for its address.<br>2. Broadcasts batch Action 11 to cancel all `cloid`s matching vault prefix.<br>3. Reads `SafeL1Read` for current position/margin.<br>4. Re-initializes inventory baseline before resuming quoting loop. |
| **F5** | **Oracle Deviation Shock (SK Hynix Incident)** | Validator mark price or HIP-3 oracle deviates violently (>150 bps in single block) due to thin illiquid print. | Off-chain keeper and on-chain `OracleHaltPolicy` compare `markPrice` from precompile `0x0800` with exponential moving average or previous confirmed block mark. | 1. If $\|Mark_t - Mark_{t-1}\| / Mark_{t-1} > 150 \text{ bps}$, immediately trigger `HALT`.<br>2. Cancel all active quotes (Action 11).<br>3. If `flattenOnHalt == true`, issue reduce-only market orders.<br>4. Lock quoting until operator unpause or price variance $< 25 \text{ bps}$ for 60s. |
| **F6** | **Auto-Deleveraging (ADL) Position Erasure** | HyperCore ADL liquidates a profitable winning perp position between blocks to cover bankrupt accounts. Position vanishes without an explicit fill. | Keeper polls `SafeL1Read` and observes position size $\Delta szi < 0$ without a matching trade receipt, while margin balance increases. | 1. Accounting model accepts `size == 0` without reverting.<br>2. Keeper updates internal inventory state to 0.<br>3. Re-centers Avellaneda-Stoikov reservation price to mid-price.<br>4. Posts symmetrical maker quotes scaled to new cash margin. |
| **F7** | **Read Precompile OOG Exhaustion** | Querying precompile `0x0800` with an invalid asset ID, delisted token, or invalid address consumes all transaction gas. | Subcall revert in `SafeL1Read.sol`. | `SafeL1Read` wraps every precompile call in a bounded gas subcall (`gas: 50_000`) and validates `assetId` against an immutable allowlist. Returns `(bool success, ...)` rather than propagating revert. |
| **F8** | **Dual-Block Congestion Starvation** | Small block (~1s, 2M gas limit) fills with spam; quote cancel or update transaction drops. | Keeper fails to receive transaction receipt within 2 small-block ticks (~2.5s). | 1. Quoting loop automatically increases priority gas tip.<br>2. Splits large batch cancels into minimal payload transactions.<br>3. Heavy settlements and rebalances are scheduled strictly on large blocks (~1 min, 30M gas). |
| **F9** | **Keeper Key Compromise / Rogue Signature** | Private key of off-chain Keeper is leaked or compromised. | Keeper attempts to issue unauthorized transactions or divert funds. | 1. Vault contract enforces on-chain caps: max leverage (3x), max position ($250k), venue allowlist.<br>2. Keeper key has NO EVM withdrawal permissions; funds can only be transferred between Vault EVM address and Vault Core account.<br>3. Owner triggers `triggerEmergencyKillSwitch()`, immediately revoking Keeper authorization. |

---

### 1.4 Explicit Assumptions and Open Questions

#### Explicit Assumptions Where `lane-c-plan.md` Was Silent
1. **Isolated Margin Account Mapping:** We assume that one HyperEVM `BrokRVault` contract maps 1-to-1 to a dedicated HyperCore agent account/subaccount. All CoreWriter actions originate from this account's isolated margin context.
2. **Gas Token Sponsorship:** HyperEVM execution requires HYPE for gas fees. We assume the Keeper maintains a minimal operational HYPE reserve for gas, while all vault assets and accounting run in pure USDC (6 decimals).
3. **Precompile Precision:** We assume all price precompile returns from `0x0800` are scaled to 6 decimals (`1e6`), matching HyperCore native representation, and that `SafeL1Read` standardizes all internal accounting to 6 decimals.
4. **Single Active Keeper in MVP:** To avoid multi-master race conditions on `cloid` allocation, MVP assumes a single active Keeper instance with an active-passive hot standby (failover coordinated via database lease).

#### Explicit Divergences and Refinements from `lane-c-plan.md`

| Item in Plan | Plan Statement | BrokR Design Specification | Rationale for Divergence / Refinement |
|---|---|---|---|
| **`totalAssets()` Inflight Buffer** | `totalAssets() = evm + coreNAV + inflight - fees` (line 181, 198) | **Divergence:** `totalAssets()` evaluates strictly `confirmed_evm_cash + safeCoreNAV - accruedFees`. Inflight transfers from unconfirmed pending deposits are **excluded** from `totalAssets` and held in escrow. | Adding estimated "inflight" balances into `totalAssets()` before precompile confirmation exposes share pricing to phantom NAV inflation if the CoreWriter transfer rejects. Segregating pending escrow guarantees share price integrity. |
| **ERC-4626 vs ERC-7540 Redeem Flow** | "ERC-4626 + ERC-7540 async redeem" (line 177, 365) | **Refinement:** The vault exposes the standard ERC-4626 interface for reads, but `deposit()` and `redeem()` immediately revert with `AsyncRequired()`. Users must interact via ERC-7540 `requestDeposit()` / `requestRedeem()`. | Providing a synchronous `deposit()` / `redeem()` that fakes atomicity would break caller assumptions on HyperEVM due to the multi-second CoreWriter execution delay. |
| **Keeper Signing Scheme in MVP** | Mentions Action 9 (API Wallet) as Phase 2 (line 77), but keeper trades in MVP (line 181). | **Refinement:** In MVP (Phase 1-6), the Keeper holds the private key of an operator account authorized on-chain in `BrokRVault.sol`. The contract initiates Action 13 transfers, while the Keeper broadcasts Actions 1, 7, 10, 11 signed directly as the vault's authorized agent. | Action 9 is not required to achieve trade authorization if the on-chain vault delegates order management to an operator address while retaining withdrawal custody. |

#### Open Questions Requiring Decisions Before Build Starts
1. **Oracle Reference Source for Halt Policy:** Should `OracleHaltPolicy` validate mark price jumps strictly against HyperCore's internal validator oracle (`0x0800`), or should it maintain a secondary off-chain Pyth/Binance websocket feed to distinguish exchange-wide shocks from HyperCore-specific illiquid prints?
2. **Keeper Failover Architecture:** Is a simple Postgres/Redis-backed distributed lock sufficient for MVP active-passive Keeper redundancy, or must we support deterministic `cloid` partitioning across multiple concurrent quoter processes?
3. **CoreWriter Gas Pricing Model:** In periods of extreme HyperEVM congestion, does the `0x3333...3333` precompile require dynamic `msg.value` or priority fees for L1 inclusion, and what is the maximum slippage tolerance for delayed execution?

---

# 2. BUILD PLAN

---

### 2.1 Phased Milestones and Deliverables

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       8-WEEK MVP BUILD PLAN                                      │
├─────────────────────┬─────────────────────┬───────────────────┬──────────────────────────────────┤
│ Phase 1 (W1-2)      │ Phase 2 (W3-4)      │ Phase 3 (W5)      │ Phase 4 (W6)                     │
│ • SafeL1Read        │ • BrokRVault (7540) │ • TS Keeper       │ • Adversarial Failure Catalog    │
│ • CoreWriterLib     │ • 2PC State Machine │ • Avellaneda Quoter│ • 7 Failure Replays             │
│ • ActionTracker     │ • Reclaim Logic     │ • Salt Policy     │ • Zero Unhedged Proof            │
├─────────────────────┼─────────────────────┴───────────────────┼──────────────────────────────────┤
│ Phase 5 (W7)        │ Phase 6 (W8)                                    │ Phase 7 (Post-MVP)               │
│ • Next.js App       │ • Mainnet Canary ($25k BTC-USD)                 │ • Action 9 API Wallets           │
│ • CoreWriter Log    │ • 7-Day Continuous Live Quoting                 │ • HIP-3 Expansion                │
│ • Mandate Page      │ • 10% TVL Redemption Proof                      │ • Policy-as-a-Service            │
└─────────────────────┴─────────────────────────────────────────────────┴──────────────────────────────────┘
```

#### Phase 1: CoreWriter Kernel & Safe Precompile Subsystem (Weeks 1–2)
*Focus: Low-level serialization, gas containment, and deterministic mock testing.*
- **What Gets Built/Deployed:**
  - `SafeL1Read.sol`: Gas-metered (`gas: 50_000`) staticcall wrapper for precompiles `0x0800` through `0x0804`.
  - `CoreWriterLib.sol`: Byte-packing library for Actions 1 (Order), 7 (USD Class Transfer), 10/11 (Cancel), and 13 (Send Asset).
  - `ActionTracker.sol`: On-chain and off-chain data structures mapping `cloid -> ActionRecord`.
  - Foundry Test Harness: Mock precompile contracts simulating successful execution, delayed execution, silent rejections, and OOG error states.
  - HyperEVM Testnet Deployment: Deploy test contracts to HyperEVM Testnet (Chain ID 998/999).
- **What Gets Measured:**
  - Serialization gas overhead ($< 12,000$ gas per action encoding).
  - Safe precompile revert handling (100% of malformed asset IDs caught without reverting parent frame).
  - Roundtrip latency of Action 13 on testnet (time from EVM `sendRawAction` to `0x0800` balance reflection).
- **What "Done" Looks Like:**
  - A standalone testnet script executes Action 13 (deposits mock USDC), waits for the L1 delay window, reads spot balance via `SafeL1Read`, and executes Action 1 (maker bid). If Action 13 is forced to fail, the fail-path executes cleanly.

#### Phase 2: Asynchronous Vault & Two-Phase Settlement (Weeks 3–4)
*Focus: ERC-7540 async vault accounting, pending deposit/redeem lifecycle, and fail-safe reclaim.*
- **What Gets Built/Deployed:**
  - `BrokRVault.sol`: ERC-4626 core with ERC-7540 async hooks (`requestDeposit`, `fulfillDeposit`, `reclaimPendingDeposit`, `requestRedeem`, `fulfillRedeem`).
  - `totalAssets()` live accounting: Dynamically aggregates EVM cash and `SafeL1Read` margin balance; rigorously excludes unconfirmed pending escrow.
  - On-Chain Policy Enforcement: Hard max leverage cap (3x), max position size ($250k), and single-market BTC constraint.
  - Testnet Deployment: `BrokRVault.sol` deployed and wired to testnet mock USDC and CoreWriter.
- **What Gets Measured:**
  - Share price constancy during inflight deposits (zero NAV dilution or spike during pending window).
  - `reclaimPendingDeposit()` execution under simulated RPC disconnection.
  - Gas usage for `requestDeposit()` ($< 65,000$ gas) and `fulfillDeposit()` ($< 80,000$ gas).
- **What "Done" Looks Like:**
  - Depositor submits 1,000 USDC -> state enters `PendingDeposit` -> Keeper detects transfer -> executes Action 13 -> precompile confirms Core balance -> shares mint. Mid-flight failure successfully unlocks 1,000 USDC refund via `reclaimPendingDeposit()`.

#### Phase 3: Off-Chain Keeper & Inventory-Skew Quoting Loop (Week 5)
*Focus: Real-time orderbook quoting, Avellaneda-Stoikov spread modeling, and Salt policy integration.*
- **What Gets Built/Deployed:**
  - TypeScript Keeper Service (`src/keeper/index.ts` using `viem` and official Hyperliquid SDK).
  - Avellaneda-Stoikov Quoter Module: Computes reservation price and dynamic bid/ask skew based on vault inventory:
    $$r(s, q) = s - q \cdot \gamma \cdot \sigma^2$$
  - Salt Policy Gate Middleware: Off-chain validation of every quote against `mandate.json` (spread bounds, max notional, venue allowlist).
  - CLOID Lifecycle Manager: Generates monotonic unique `cloid`s and tracks `ENCODED -> SUBMITTED -> ENQUEUED -> VERIFIED`.
- **What Gets Measured:**
  - Quote update loop frequency (target: 1 update per 1.5s on small blocks).
  - Policy evaluation latency ($< 5$ms per quoting cycle).
  - Inventory skew responsiveness (spread automatically widens on the heavy side when inventory exceeds 10% of max notional).
- **What "Done" Looks Like:**
  - Keeper runs continuously on HyperEVM Testnet for 24 hours, quoting BTC-USD perp, absorbing fills, adjusting inventory skew, and logging 0 policy violations.

#### Phase 4: Adversarial Failure Catalog & Resilience Replay (Week 6)
*Focus: Stress-testing and proving system survivability against all 7 HyperCore failure modes.*
- **What Gets Built/Deployed:**
  - Automated Chaos Test Suite (`test/adversarial/`): Scripted harnesses replaying failure scenarios against live testnet.
  - Failure Replay Engine:
    1. CoreWriter order reject (invalid lot size / cross post-only).
    2. Withdrawal requested while 100% capital is in active quotes.
    3. Hard Keeper crash (`kill -9`) with 10 open `cloid`s.
    4. Simulated oracle jump ($> 150$ bps in 1 block).
    5. Simulated ADL position wipeout.
    6. Malformed precompile calls.
    7. Small-block gas spikes.
- **What Gets Measured:**
  - Time to full quote cancellation upon Keeper restart ($< 3.5$s).
  - Zero unhedged confirmed shares across 100 injected failure runs.
  - Recovery time from Oracle Halt to safe state ($< 1$ delay window).
- **What "Done" Looks Like:**
  - 100% of chaos test scenarios pass without human intervention, and a formal test report confirms no capital loss or stranded state.

#### Phase 5: Verification UI, Mandate Transparency & Kill Switch (Week 7)
*Focus: Depositor transparency, live audit logs, and operator control interface.*
- **What Gets Built/Deployed:**
  - Next.js Web Application (`apps/web`):
    - **Deposit/Redeem Interface:** Displays pending vs confirmed status, estimated fulfillment countdown, and one-click `Reclaim` button.
    - **Live Book & Inventory View:** Real-time visualization of vault bids/asks, current BTC inventory skew, and live NAV.
    - **CoreWriter Action Log:** Explorer-style table streaming every CoreWriter action (`Action ID`, `CLOID`, `Status`, `Enqueue Block`, `Execute Block`).
    - **Mandate Transparency Page:** Renders `mandate.json` in plain English alongside the on-chain IPFS hash.
    - **Emergency Kill Switch:** Multisig / Owner interface to halt quoting and force-flatten inventory.
- **What Gets Measured:**
  - WebSocket telemetry latency ($< 250$ms from L1 block to UI update).
  - CoreWriter action log indexing completeness (100% of actions tracked).
- **What "Done" Looks Like:**
  - User can connect wallet, request a deposit, observe the pending animation, watch the CoreWriter action land in the public log, see shares mint, and trigger emergency redemption from the UI.

#### Phase 6: Mainnet Canary Deployment (Week 8)
*Focus: Live capital deployment, real-money verification, and operational hardening.*
- **What Gets Built/Deployed:**
  - Mainnet Contract Deployments: `BrokRVault.sol`, `SafeL1Read.sol` on HyperEVM Mainnet (Chain ID 999).
  - Mainnet Keeper Node: Dedicated server running on high-performance RPC infrastructure with hardware failover.
  - Seed Capital: $25,000 USDC initial capital provided by team/design partners.
  - Public Mandate: Hash committed on-chain for BTC-USD isolated maker inventory.
- **What Gets Measured:**
  - 7-day continuous uptime ($> 99.9\%$).
  - Zero unhedged intervals lasting $> 1$ delay window.
  - Net PnL and realized spread capture vs adverse selection.
  - Successful fulfillment of a real $2,500 (10% TVL) user redemption test.
- **What "Done" Looks Like:**
  - 7 continuous days of live mainnet quoting on BTC-USD perp, 0 policy breaches, public CoreWriter logs matching 100% of on-chain state, and successful 10% TVL redemption completed.

#### Phase 7: Post-MVP Expansion (Weeks 9–12)
- **Action 9 API Wallet Delegation:** Transition Keeper to restricted agent wallet key.
- **Multi-Market Support:** Enable ETH-USD and first tightly-curated HIP-3 market.
- **Policy-as-a-Service:** Expose Salt policy validation engine via API/SDK for external agent runtimes.

---

### 2.2 Phase Risk Analysis and Promotion Gates

```
  [ Phase 1: Kernel ]  ──( Gate 1: Reclaim on Testnet )──►  [ Phase 2: Vault ]  ──( Gate 2: Zero Dilution )──►
  [ Phase 3: Keeper ]  ──( Gate 3: 24h Clean Quoting )───►  [ Phase 4: Chaos ]  ──( Gate 4: 100% Chaos Pass )──►
  [ Phase 5: UI/Ops ]  ──( Gate 5: End-to-End Testnet )──►  [ Phase 6: Mainnet Canary ($25k) ]
```

| Phase | Key Technical & Operational Risks | Required Evidence to Pass Promotion Gate |
|---|---|---|
| **Phase 1 (Kernel)** | • Precompile byte offsets mismatch actual L1 layout.<br>• Precompile consumes all gas on unexpected error.<br>• Action 13 drops silently on testnet. | **Gate 1 Evidence:** Automated testnet script proves 10 consecutive Action 13 deposits followed by Action 1 order placements, and successfully demonstrates `reclaim` on an intentionally failed action. |
| **Phase 2 (Vault)** | • `totalAssets()` fluctuates during inflight deposit.<br>• Share rounding exploits on low share balances.<br>• Pending deposit lockup if keeper stalls. | **Gate 2 Evidence:** Mathematical proof and testnet transaction logs showing `sharePrice` remains strictly invariant before, during, and after pending deposit fulfillment, with `reclaimPendingDeposit()` working seamlessly after timeout. |
| **Phase 3 (Keeper)** | • Race conditions in `cloid` generation.<br>• Keeper gets stuck in rapid cancel-replace loop.<br>• Adverse selection drains inventory on sharp BTC moves. | **Gate 3 Evidence:** 24 continuous hours of autonomous testnet quoting on BTC-USD with $> 1,000$ quote updates, 0 duplicate `cloid`s, and automated inventory skew widening under simulated directional volume. |
| **Phase 4 (Chaos)** | • Stalled state file prevents Keeper reboot.<br>• Oracle shock leaves resting limit orders exposed.<br>• ADL zeroing causes divide-by-zero in share math. | **Gate 4 Evidence:** Automated execution of the 7-part Failure Catalog on live testnet with 100% recovery rate, zero manual interventions, and zero unhedged confirmed shares across all runs. |
| **Phase 5 (UI/Ops)** | • UI displays stale CoreWriter status.<br>• Depositors confused by async pending states.<br>• Kill switch fails to override active Keeper loop. | **Gate 5 Evidence:** Successful end-to-end dry run by external design partner on testnet: deposit -> verify log -> execute kill switch -> confirm inventory flattened and funds withdrawn. |
| **Phase 6 (Canary)** | • High adverse selection on real mainnet order flow.<br>• HyperEVM RPC node rate-limiting or latency spikes.<br>• Smart contract vulnerability under live funds. | **Gate 6 Evidence:** 7 days of live mainnet operation with $25k TVL, 0 invariant violations, all CoreWriter actions verified or rolled back, and successful completion of a 10% TVL redemption. |

---

### 2.3 Execution Division: Manual vs. Autonomous Agent Allocation

The build workflow is structured to leverage autonomous coding agents for deterministic, repetitive, and code-generation tasks while reserving architectural design, cryptographic risk validation, and live financial operations for human engineers.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TASK EXECUTION DIVISION                                       │
├────────────────────────────────────────┬─────────────────────────────────────────────────────────┤
│    AUTONOMOUS AGENT EXECUTION (AI)     │             MANUAL ENGINEER EXECUTION (HUMAN)           │
├────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ • CoreWriterLib serialization encoders │ • Final smart contract security & invariant review      │
│ • SafeL1Read precompile wrappers       │ • Risk policy parameter selection (spread/leverage)     │
│ • ERC-7540 boilerplate & state maps    │ • Mainnet deployment, multisig setup & key management   │
│ • Unit tests & Foundry mock harnesses  │ • Operator partner interviews & business development    │
│ • Adversarial failure test scripts     │ • Live mainnet capital seeding & canary monitoring      │
│ • Next.js UI components & log tables   │ • Incident response & post-mortem signing               │
└────────────────────────────────────────┴─────────────────────────────────────────────────────────┘
```

#### Detailed Work Breakdown Matrix

| Subsystem / Task | Execution Mode | Rationale & Justification |
|---|---|---|
| **`CoreWriterLib.sol` & `SafeL1Read.sol` Implementation** | **Autonomous Agent** | Encoding bitwise packing formats and ABI schemas against fixed protocol specifications is a highly deterministic task where agents excel without introducing novel architectural risk. |
| **`BrokRVault.sol` Core Architecture & Invariant Design** | **Manual (Human)** | Asynchronous multi-chain accounting invariants dictate fund safety; core accounting logic requires human architectural judgment and formal verification. |
| **ERC-7540 Boilerplate & Unit Test Suite** | **Autonomous Agent** | Generating standard state mappings, event emitters, and Foundry fuzz tests from formal specifications is fast, exhaustive, and easily verified by compiler runs. |
| **Salt Policy Engine TypeScript Rules** | **Autonomous Agent** | Translating declarative JSON mandate rules into TypeScript validation middleware follows deterministic schema constraints well-suited for automated coding. |
| **Avellaneda-Stoikov Inventory Quoting Algorithm** | **Manual (Human)** | Quantitative market-making parameters (volatility estimators, inventory risk penalty $\gamma$) require active financial engineering and empirical tuning. |
| **Adversarial Failure Replay Harnesses** | **Autonomous Agent** | Scripting end-to-end chaos tests against mock precompiles and testnet RPCs follows structured recipes that agents can generate and iterate on rapidly. |
| **Next.js UI & CoreWriter Log Visualizer** | **Autonomous Agent** | Standard web application development (React components, Tailwind layouts, Wagmi hooks) has high agent velocity with low systemic risk. |
| **Live Testnet Chaos Run Verification** | **Manual (Human)** | Observing live testnet behavior during simulated RPC drops and inspecting explorer traces requires human diagnostic synthesis across multiple subsystems. |
| **Mainnet Deployment, RPC Setup & Key Ops** | **Manual (Human)** | Real-money key management, RPC infrastructure provisioning, and initial $25k capital provisioning must remain strictly under human custody. |
| **Live 7-Day Mainnet Canary Monitoring** | **Manual (Human)** | Monitoring live financial risk, spreads, and market conditions requires real-time human accountability and discretionary emergency response. |
