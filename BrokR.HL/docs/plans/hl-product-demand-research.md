# Hyperliquid product demand: which Monsoon lane to ship

**Date:** 22 Aug 2026
**Window:** ~25 Jul–22 Aug 2026 (older receipts only where they explain what people are still saying now)
**Weighting:** Jeff / HL core, named builders, and funds over engagement-farming accounts

Monsoon is three things. The question is which one has current demand as a real Hyperliquid product:

- **(A)** An AI agent that executes natural-language trades on Hyperliquid behind a policy / guardrail layer
- **(B)** A Valantis Sovereign Pool ALM doing inventory-skew pricing with idle-capital yield routing
- **(C)** An off-chain executor mirroring on-chain reserves onto the HyperCore orderbook

---

## Ranked verdict

**Lane C is the one to productize.** Hyperliquid core just named custom vaults as a first-class building block, Vault 1.0 is being retired in public, and CoreWriter (the actual “mirror on-chain reserves onto HyperCore”) is the unique primitive people keep getting wrong. Lane A is loudest in the feed and has real fund money, but the naive NL-trading agent is already commoditized and economically broken. Lane B, as specified (inventory-skew Sovereign Pool ALM), has almost no current askers — Valantis themselves sunset the closest thing.

1. **C — Off-chain / CoreWriter executor that mirrors on-chain reserves onto HyperCore.** Strongest *HL-specific* demand. Jeff and the docs just put “custom vaults” on the architecture diagram. Independent vault teams (Buoy, rini) are racing to own it. The failure mode the executor was designed for (non-atomic CoreWriter writes) is still the #1 builder trap.
2. **A — Guarded NL agent.** Strongest *fund + retail mindshare*. Nansen, Jump, CoinFund, Fidelity are in this lane. The gap is not “an agent that trades.” It is policy, leverage caps, and crash-safe runtime — which is the Salt layer in Monsoon. Volume on the current leader has collapsed.
3. **B — Inventory-skew Sovereign Pool ALM + idle-yield routing.** Weakest current demand for *this* product. Valantis is live and large as an LST, not as an ALM. They shut the kHYPE AMM on 24 Jul. Idle HYPE yield is already a crowded $1B+ stack (Kinetiq, HyperLend, Harmonix).

---

## 1. Demand: who’s actually asking

### Lane C — strongest builder / core signal

- **Jeff / Hyperliquid named the category.** Tech page added five labeled HyperEVM building blocks, including custom vaults for the first time. Their own docs on the thing it replaces: fixed 10% profit share, no customization, limited functionality, “build the rest permissionlessly on HyperEVM.” rini (Vault OS, HIP-3/4, custom fees) called it out on 19 Aug: “The category is named. Who’s building the system to run it seriously?”
  - https://x.com/rini_xyz/status/2090091715285881085
- **Vault operators want a real native vault, not the 1.0 object.** Hyperliquid vault operator @pathtolibero, 19 Aug: “I’m disappointed they abandoned the vault and we are now waiting for a non native HyperEVM vault. They need to build it.”
  - https://x.com/pathtolibero/status/2090078303566565764
- **Buoy is shipping Vaults 2.0 as the productization of that diagram** — $1 vault creation, HIP-3/HIP-4/core perps/spot, performance fees. They quote Jeff: “The sky is the limit with vault.” Live 13 Aug.
  - https://x.com/BuoyFinance/status/2087948034206208083
- **Bound (HyperEVM) is building *because* of CoreWriter**, not despite it. Product lead 19 Aug: “CoreWriter has always been one of the more exciting innovations… Utilizing HyperEVM smart contracts to programmatically plug into HyperCore liquidity is what makes this uniquely possible.”
  - https://x.com/T3E3JAY/status/2090214226686104052
- **Usage is real, not theoretical.** Hyperscan (2 Aug, QuickNode-backed): **1,057,498 CoreWriter actions** since launch; share of HyperEVM txs that *read* HyperCore state 10x’d in six months.
  - https://x.com/hl_eco/status/2083891684136386860
- Jeff’s 9 Aug framing still applies: Labs will not enshrine things the community can build (spot bridging, custody, now vaults).
  - https://x.com/PDmytriiev/status/2086520409675989338

This is the closest public description of Monsoon’s executor: an EVM-side inventory object that has to keep a live HyperCore book in sync. People want that. They do not have a production-grade, failure-aware version.

### Lane A — loudest fund / CEO signal, weaker product-market fit

Who is asking (high-weight):

- **Alex Svanevik (Nansen CEO), 28 Jul (The Block):** “I would be very surprised if we don’t have more trading agents than humans within two years.” Product line: trade everything onchain with agents. They already wired Hyperliquid perps into Nansen.
  - https://www.theblock.co/news/markets/2026-07-28-nansen-ceo-bets-on-ai-agents-to-overtake-human-traders-within-two-years-409914
- **Same person, 17 Aug:** closed alpha of **Nansen Agent Network** — “autonomous trading agents.”
  - https://x.com/ASvanevik/status/2089173206724997470
- **21 Aug:** Nansen R&D screenshot — “Qwen3.8 bets bigger and uses more leverage.” That is the guardrail problem, named by a CEO running live agents.
  - https://x.com/ASvanevik/status/2090818780972933162
- **AgentArcade** (formerly Stacked): “Agents trade live on Hyperliquid.” Backed by **Fidelity (FISV), Jump, CoinFund**. 10 Aug product: describe a strategy in one sentence, agent writes it, trades 24/7.
  - https://x.com/AgentArcade/status/2086890534438912090
- **Jason Goldberg / Senpi** still posting daily as “cursor for trading / Hyperliquid.” Copy-trade product: “You set the budget. You approve the plan. Your agent runs it.”
  - https://x.com/senpi_ai/status/2089818633681678814
- **nof1** raised **$15M (Sui Group + Karatage, May)** after a public Hyperliquid arena where most models lost money — and they *pivoted the product* from “AI that trades” to “AI that writes the trader.”
  - https://x.com/raahulll_raj/status/2085508723443929106

Who is *not* asking: Jeff, HyperliquidX, HIP-3 deployers. Core’s last month of posts are TWAP execution, liquidity vs CEXs, HIP-3. Zero agent talk.

The real ask inside this lane is **policy**, not another chat box. That matches Salt. It does not match “Buy $100 ETH.”

### Lane B — thin, and the sponsor walked away from the AMM

- **Valantis is not asking for more Sovereign Pool ALMs on HL.** Last four weeks they are selling **stHYPE + Valantis Prime**: trading-fee discounts (up to 40%) that stay liquid as margin. Their 7 Aug research: ~half of top 20k wallets don’t stake, those wallets pay ~70% of fees, ~$100M+/quarter. The product they want is “LST that is also margin,” not inventory-skew quoting.
  - https://x.com/ValantisLabs/status/2085792178681663646
- **24 Jul they sunset kHYPE AMM** — the live inventory/LST pool closest to Monsoon’s ALM. “Valantis holds conviction that the next generation of HYPE yield looks different.” Withdrawals only.
  - https://x.com/ValantisLabs/status/2080544368516374666
- Idle-capital yield *is* demanded, but already served: Kinetiq ~$0.8–1.3B TVL, HyperLend ~$330–550M, Harmonix packaging kHYPE + HIP-3 exposure. Nobody public in this window asked for Avellaneda/inventory-skew pricing on a Sovereign Pool.
- HyperEVM DEX demand is “don’t donate edge as a lazy LP” (Project X vs Nest yield test, 13 Aug) — concentrated-liquidity *management*, not CLOB mirroring.
  - https://x.com/mahogany0609/status/2087727567814132176

**If evidence is thin, it is here.** There is LST/yield demand. There is almost no public demand for the ALM Monsoon actually built.

---

## 2. What’s shipped, traction, complaints

### Lane A — crowded, loud, P&L-negative

| Product | What it is | Traction (treat marketing vs DeFiLlama separately) | What users / builders complain about |
|---|---|---|---|
| **Senpi** | NL/strategy agent on HL perps, builder-code frontend, runtime guardrails | Self: $100M+ shortly after Feb launch, 88% of *their* volume through agents in 6 days, 9k agents in v2 week 1. **DeFiLlama now: $401M cumulative volume, only $5.2M in 30d, $2.3k 30d revenue.** Peak was Q1 ($109k fees), Q3 so far ~$4.8k. Seed $4M (Lemniscap, Coinbase Ventures). | Copy-trade sizing/stop bugs (they wrote a whole post, 15 Aug). Notification spam on a live 5× long. “55% of users profitable last 24h” is a marketing stat, not a Sharpe. |
| **Nansen agents** | Analytics → execution, HL perps live | Closed alpha 17 Aug. CEO: one agent made **$23 profit, $700 inference**. | Unit economics inverted. Models over-lever (Qwen). |
| **nof1 Alpha Arena** | Frontier LLMs, real $ on HL perps | S1 (Oct–Nov 2025, still the cited result): Qwen +22%, DeepSeek +5%, Claude −31%, Grok −45%, Gemini −57%, GPT-5 −63%. S1.5: “mystery model” only profitable of 32. Then they raised $15M and **stopped selling “the model is the trader.”** | Overtrading vs fees; LLMs are bad systematic traders. |
| **AgentArcade** | One-sentence strategy → live HL agent, copy winners | Jump / CoinFund / Fidelity. Mindshare, not public TVL/volume independently verified. | Black-box equity curves; same sector-wide “no published losses” problem. |
| **Ghola** | “Private execution for every perpetual” + simplified agent runtimes | 16 Aug: **simplified HL agent runtimes paused** — “some agents chose abnormal leverage given the perp.” | Guardrails missing. Transparent L4 book leaks strategy. |
| **Precipitate / others** | Real-money HL agents | Tiny | “The scarier failure isn’t a jailbreak — it’s a stalled state file after a crash, leaving a position unmanaged for hours.” |
| **Virtuals Console** | No-code HL perps agents, 12h cycle | Template farm, not a venue. | Scheduled, not reactive. |
| **Bankr, Ethy, Wallet V, PerpGame, HyperCoco, DeAgentAI Sentry** | Long tail of “tell it / it trades HL” | Engagement-farming. Skip. | — |

**Mindshare ≠ volume.** Builder-code frontends that *do* print (Phantom, MetaMask, Trust Wallet) are wallets, not agents. Trust Wallet flipped Phantom/MetaMask on builder-code revenue after turning on 5 bps (29 Jul). Senpi is two orders of magnitude smaller.

Sources:

- https://defillama.com/protocol/senpi-perps
- https://resources.senpi.ai/blog/88-percent-volume-in-6-days
- https://x.com/senpi_ai/status/2088637193266897204
- https://x.com/betashop/status/2087587907766796380
- https://www.theblock.co/news/markets/2026-07-28-nansen-ceo-bets-on-ai-agents-to-overtake-human-traders-within-two-years-409914
- https://nof1.ai/
- https://x.com/raahulll_raj/status/2089555394851197204
- https://x.com/GholaXYZ/status/2088909688134049916
- https://x.com/PrecipitateAI/status/2090079219498070090
- https://x.com/y_cryptoanalyst/status/2082826306568519992
- https://x.com/PDmytriiev/status/2088655572207812659

### Lane B — LST/yield is real; the ALM is not

| Product | What it actually is | Traction | Complaints |
|---|---|---|---|
| **Valantis / stHYPE** | LST + STEX/Sovereign Pool for LST↔HYPE, now Prime fee discounts | Site ~$182M TVL / $845M volume / 34k wallets. DeFiLlama ~$143–228M depending on HYPE price. Acquired stHYPE Aug 2025. | They **killed kHYPE AMM** (>$300M swap volume, 5k depositors) to concentrate on a stack they control. LPs told to migrate. |
| **Kinetiq (kHYPE)** | Liquid staking + Markets.xyz HIP-3 | **~$0.8–1.3B TVL**, ~80% LST share in some community claims, $KNTQ ~$33–46M mcap. | Fee-discount vs margin incompatibility is the problem Valantis is attacking, not Kinetiq. |
| **HyperLend** | Aave-style HyperEVM lending | **~$330–550M TVL**, ~$250–290M active loans, ~72% lending share. | Oracle lag vs HyperCore/Binance; MEV liquidations on “healthy” LTVs. Treat the 16 Aug thread as low-weight (NFT artist), but the *mechanism* (EVM oracle vs Core book) is real. |
| **Project X** | HyperEVM spot DEX | TVL ~$36–70M, **DEX volume is the tell**: ~$5.4B/30d, ~$16.8B cumulative. | Volume leader ≠ LP yield. Lazy LPs donate to active ranged LPs. |
| **Harmonix** | Yield vaults (kHYPE, haUSDC / HIP-3) | Packaging, not new primitive. | “Active ≠ earning points.” |
| **Ramses, KittenSwap, HyperSwap, LiquidCore** | Generic HyperEVM AMMs | KittenSwap still live as ve(3,3). HyperSwap was day-one DEX. | HyperEVM DEX graveyard is real (see below). None of these are inventory-skew CLOBs. |

No public HyperEVM product in this window is “Avellaneda quotes on a Sovereign Pool, idle remainder to Aave/Chorus.” That is still a hackathon shape.

Sources:

- https://valantis.xyz/
- https://x.com/ValantisLabs/status/2080544368516374666
- https://defillama.com/protocol/kinetiq
- https://defillama.com/protocol/hyperlend
- https://defillama.com/protocol/project-x
- https://x.com/mahogany0609/status/2087727567814132176

### Lane C — small products, large primitive

| Product | What it is | Traction | Complaints |
|---|---|---|---|
| **Native HL vaults (1.0)** | HLP-style, 10% profit share, no customization | Being replaced. Jeff: “sky is the limit with vault.” | Fixed rake, can’t trade HIP-3/4 cleanly, can’t customize fees. |
| **Buoy “Vaults 2.0”** | Permissionless vault create, HIP-3/4/core/spot | Shipped 13 Aug. Stock/FX MM vault advertised **56.84% APR** (unaudited, 21 Aug). No credible TVL yet. | New; APR screenshots are not a track record. |
| **rini** | “Vault OS”: custom fees, $0 setup, HIP-3/4 | Private beta “summer 2026.” | Not live. Positioning against Buoy. |
| **Bound** | “Boundary perps” via CoreWriter | Coming soon. | Design-space post, no volume. |
| **hypurrquant/hyperliquid-vault** | ERC-4626/7540 vault, NAV from Core precompiles, keeper for funding | Open-source pattern, not a product. | Keeper-assisted = the executor. |
| **Hyperscan** | CoreWriter explorer | 1.06M actions decoded. | Infra, not a vault. |

Sources:

- https://x.com/rini_xyz/status/2090091715285881085
- https://x.com/BuoyFinance/status/2087948034206208083
- https://x.com/BuoyFinance/status/2090902190378401839
- https://github.com/hypurrquant/hyperliquid-vault
- https://x.com/hl_eco/status/2083891684136386860

---

## 3. Graveyard (as important as the winners)

### Agents

- **nof1** publicly demonstrated frontier models lose money on HL, then raised to sell *strategy-coding* agents instead of autonomous traders. That is a quiet abandonment of Lane A-as-specified.
- **Ghola** paused simplified agent runtimes after live over-leverage (16 Aug).
- **Senpi volume** fell from a Q1 spike to ~$5M/30d. The “88% of volume is agents” stat is from March, on *their* users, not HL.
- Long tail of NL agents (HyperCoco, PerpGame, Wallet V, DeAgentAI Sentry) is engagement farming. No independent volume.

### ALM / HyperEVM AMM

- **Valantis kHYPE AMM — sunset 24 Jul.** Closest production cousin of Monsoon’s Sovereign Pool. They said the next generation of HYPE yield “looks different.”
- **Felix HIP-3 DEX — shut 19–20 Jun** (just outside the 4-week window, still the relevant graveyard). Phased closure of HyperEVM DEX *and* HIP-3 markets after already killing USDH.
  - https://cryptorank.io/news/feed/b6fe9-felix-shutdown-hyperliquid-dex-june-20
- HyperEVM “tge = ghost chain” round: Chinese HL researcher @y_cryptoanalyst, 18 Jun, still cited 21 Aug — half the top-20 TVL names haven’t TGE’d; “continuous shutdown wave” of eco projects, then a TGE window on the HYPE rally.
  - https://x.com/y_cryptoanalyst/status/2090746655922622539
- Generic ve(3,3) / Uni-v2 forks (early HyperSwap/KittenSwap war) did not become the CLOB-AMM hybrid anyone pitched in 2025.

### Vaults / executors

- Native vault 1.0 is being abandoned *by the protocol*, not by a startup. That’s the opening.
- Independent vault operators are already unhappy that the replacement is “wait for a HyperEVM vault” rather than a first-class Core object.
- QuillAudits (Mar 2026, still the technical reference builders cite): the textbook death is **deposit on EVM, CoreWriter hedge fails silently, vault sits unhedged**.
  - https://www.quillaudits.com/blog/blockchain/hyperliquid-security-beyond-orderbooks

### HIP-3 deployers (adjacent, because people confuse this with Lane C)

- HIP-3 is **trade.xyz’s game**. ~50–55% of HL volume, ~90–98% of HIP-3 OI, $21M deployer revenue since launch. SK Hynix oracle print (29 Jul) caused a 18% mark collapse and ~$60M liquidations; they reimbursed “even though the oracle worked as designed.” That is a graveyard of *oracle design*, not of executors.
  - https://x.com/coinbureau/status/2082286952515342467
- New HIP-3 names (Entropy, Ribbit $15M seed) are copying trade.xyz, not building ALMs or agents. Bond is **500k HYPE ≈ $28–40M**, ~22–27 wallets even qualify.
  - https://x.com/prompterminal/status/2090795807251300746

---

## 4. HL-specific constraints people keep hitting

Ranked by how often they kill the exact things in Monsoon:

1. **CoreWriter is not a function call.** Writes to `0x3333…3333` emit a log; HyperCore executes later. **EVM tx succeeds even if the Core action rejects** (margin, delist, size). Orders and vault transfers are *further* delayed vs other actions so EVM can’t bypass the L1 mempool. You need two-phase commit + precompile verify + reclaim. This is the whole Lane C product.
   - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore
   - https://www.quillaudits.com/blog/blockchain/hyperliquid-security-beyond-orderbooks
2. **Read precompiles (`0x800…`) eat all gas on invalid input** (bad asset id, bad vault address). Do not forward unbounded gas. Chainstack, 13 Jul: wrap behind allowlists.
   - https://chainstack.com/hyperliquid-hyperevm-precompiles-corewriter-bridge/
3. **Vault 1.0 is a dead API.** 10% rake, no custom fees, weak HIP-3/4. Vaults 2.0 / HyperEVM custom vaults are the replacement. If you build against 1.0 you are building on a sunset.
4. **ADL can delete your hedge.** Profitable Core positions can vanish between blocks without the EVM contract’s consent. Vault share price and inventory-skew both break if you don’t account for it. Same QuillAudits piece.
5. **Oracle is not Chainlink.** Validator-maintained, 3s median. HIP-3 `oracleUpdater` is a **single key, no on-chain deviation bound**. SK Hynix (29 Jul) is the production incident: thin Korean pre-market print → mark −18% → cascade. Any ALM quoting off `getMidPrice()` inherits this. Reimbursement politics: deployer vs HYPE holders vs nobody.
6. **HIP-3 is not a startup surface.** 500k HYPE bond, slashable, ~$30M+. trade.xyz already took the volume. Don’t go here unless you have that balance sheet.
7. **Builder codes work; they don’t differentiate.** Phantom / MetaMask / Trust Wallet already skim 0.5–5 bps on hundreds of millions a week. An agent frontend can attach a builder code tomorrow. That is distribution, not a moat.
   - https://x.com/PDmytriiev/status/2088655572207812659
8. **Staking-tier discounts vs portfolio margin.** Non-stakers pay most of the fees because they need HYPE as *margin*. An LST that keeps the discount *and* is marginable is the actual Valantis Prime thesis — which is **not** inventory-skew AMM. If you ship Lane B as specified you are fighting your own sponsor’s live product.
9. **HyperEVM block shape.** Small blocks ~1s / 2M gas; large ~1 min / 30M. A quoting loop or vault settlement that assumes Ethereum block regularity will miss. `msg.sender` is the system contract on Core-triggered EVM execution.
10. **Transparent L4 book.** Jeff (19 Aug) doubled down: visible TWAPs *improve* execution for non-toxic flow ([arxiv 2606.15715](https://arxiv.org/abs/2606.15715)). For agents, that means the strategy is public every block. Ghola’s “privacy is survival” take is the agent-side complaint. Guardrails don’t fix leak-by-fill.
    - https://x.com/chameleon_jeff/status/2090001486553981135

---

## What to actually ship

**Take C, steal A’s policy layer, ignore B’s AMM.**

Concretely: a **Vault 2.0 / CoreWriter inventory vault** that (1) holds reserves on HyperEVM, (2) quotes/hedges on HyperCore with two-phase commit, (3) enforces Salt-style policies (max size, spread, leverage, venue, kill-switch, crash reconcile). Sell it to the people already yelling: vault operators who hate 1.0, HIP-3 MM vaults like Buoy’s 56% APR screenshot that have no risk framework, and Nansen/Senpi-class agents that keep over-levering.

Do not ship another NL chat agent. Senpi, AgentArcade, Nansen, Virtuals, and nof1 already occupy every layer of that funnel; the ones with data either lose money or pivoted.

Do not ship a Sovereign Pool inventory-skew AMM. Valantis sunset theirs. Yield is Kinetiq/HyperLend. The ALM thesis has no current public buyer on HL.

---

## Evidence quality

- Lane A and C are well-sourced from named builders, a CEO, DeFiLlama, and HL docs.
- Lane B demand for *inventory-skew ALM* is thin by construction — not padded.
- AgentArcade and Buoy TVL/volume are not independently published; marked as such.
- Several HyperEVM TVL numbers move with HYPE’s 19 Aug spike; ranges used where snapshots disagreed.
