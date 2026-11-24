# ScoreBond — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997` |
| **Contract** | [`0xc4547873D179B63C24808828652fb97Bb30Ba9Dc`](https://explorer-studio-dev.genlayer.com/address/0xc4547873D179B63C24808828652fb97Bb30Ba9Dc) |
| **Deploy tx** | [`0x1c7a5074…ff6cb8`](https://explorer-studio-dev.genlayer.com/tx/0x1c7a50746de0c3c5043af166a21303997ee1bc6fdc0b3d2b23cb1fadf0ff6cb8) on 2026-11-24, from `0x795870e789c278ec48797527E1464fb50F683128`, which has no role in the contract |
| **Source** | [`contracts/ScoreBond.py`](contracts/ScoreBond.py) as committed in `c93c1cc` — runner `py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0` |
| **Source sha256** | `501ef58c2fc95272a0fbd053969c639848de00b601a360316e23f649c5eb80b2` |

This is version 2 of the contract (the steward fix: validators must agree on `passes`), deployed on its own
for this repository. The same source was deployed earlier, on 2026-11-16, at
[`0x6Cd9CdA209dc5f6784a4B2A3327baFF72B7b728E`](https://explorer-studio-dev.genlayer.com/address/0x6Cd9CdA209dc5f6784a4B2A3327baFF72B7b728E);
that **earlier v2 deployment** is still live, is the address cited by the v2 milestone of the
[ScoreBond project](https://github.com/valentinzubok/ScoreBond), and its full run (31 transactions, 3 scoring rounds per
delivery, the deadline boundary, refused bonds credited) is kept in
[`docs/STUDIO_DEV_DEPLOY_v2_0x6Cd9.md`](docs/STUDIO_DEV_DEPLOY_v2_0x6Cd9.md). Version 1 (`0xb68d…`) is recorded in the
ScoreBond repository (`docs/STUDIO_DEV_DEPLOY_v1.md`).

## What v2 fixed

A steward pointed out that validators agreed on a score only within 10 points, so two honest
readings 69 and 71 could land on different sides of the bar and move the whole bond. v2 closes that:

* Validators must **agree on `passes`** (does the score reach the bar). A pair of scores on opposite
  sides of the bar is a disagreement; the round reverts and records nothing.
* The contract re-checks `passes == (score >= bar)` after consensus.
* Settlement counts **deliveries that reached the bar** (`passed` against `passes_required`), not a
  sum of scores, so one strong delivery cannot cover a failed one.

## Verify the source yourself

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0xc4547873D179B63C24808828652fb97Bb30Ba9Dc"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/ScoreBond.py
# both print 501ef58c2fc95272a0fbd053969c639848de00b601a360316e23f649c5eb80b2
```

CI runs the same comparison against this address on every push (`scripts/verify_deployment.py`).

## Lint

`sh scripts/lint_current_sdk.sh` — `genvm-lint lint` on the file as deployed, then `check` and `typecheck`
on a copy whose header uses the runner bundled with the public linter (`1jb45aa8…`); the linter cannot
yet download the v0.4 runner. The contract body is byte-identical. Passed, in CI.

## The run (2026-11-24)

Script: [`scripts/demo/run.mjs`](scripts/demo/run.mjs) with [`scripts/demo/lib.mjs`](scripts/demo/lib.mjs)
(genlayer-js). It is state-aware and resumable: each step has a label and is skipped on a rerun, scoring waits on
the round interval read from `get_delivery`/`get_bond`, and a scoring round whose stored state did not move
(validators did not agree) is sent again. Raw log of this run:
[`scripts/demo/run-2026-11-24.steps.jsonl`](scripts/demo/run-2026-11-24.steps.jsonl) (every call, with the
error payload) and [`scripts/demo/run-2026-11-24.rounds.jsonl`](scripts/demo/run-2026-11-24.rounds.jsonl)
(every `get_round` record).

Accounts (throwaway test keys): provider `0x586740dFC16fD26fbD8fC4dc6BA682E7eCd5b594`, client
`0x89FD14202bC37DF9B42C50A55B92Afa266e78a1a`, stranger `0x193433F67558240f8066e52F621D69B7F2CdbCbe`.

Delivery pages are this repository's fixtures, pinned to commit `c93c1cc`:
[`good-guide.md`](https://raw.githubusercontent.com/valentinzubok/ScoreBondCore/c93c1ccbdc056a17a2d4dcdd8396af104d51a15c/fixtures/deliveries/good-guide.md)
(a guide with concrete commands for setup, tests and pull requests) and
[`thin-guide.md`](https://raw.githubusercontent.com/valentinzubok/ScoreBondCore/c93c1ccbdc056a17a2d4dcdd8396af104d51a15c/fixtures/deliveries/thin-guide.md)
(one line: "Run the tests with the tests command. See the readme for the rest.").

Rubric of both bonds: *A contributor guide for a Python repository. It must explain, with concrete runnable commands,
(1) how to set up the project, (2) how to run the tests, (3) how to open a pull request. Each of the three parts is worth
about a third of the score; a part that is missing or only says 'see the readme' earns nothing for that part.*

| # | Call | Sender | Result | What happened | Tx |
|---|------|--------|--------|---------------|----|
| 1 | `open_bond(met-1)` value 2 GEN | provider | SUCCESS | `met-1`: 2 GEN, bar 70, 1 delivery, 1 scoring round, delivery window 1800 s, scoring window 1800 s | [`0x197ee9fe…c9b07b`](https://explorer-studio-dev.genlayer.com/tx/0x197ee9fee6590d2f50bf9595e2aac289714a074177733393550b7a2d05c9b07b) |
| 2 | `expire(met-1)` | stranger | **ERROR** | `expire(met-1)` right after opening: **UserError** `the final deadline has not passed; expiry opens at 1795534184` | [`0x6a4567d7…8987c1`](https://explorer-studio-dev.genlayer.com/tx/0x6a4567d7ee9eb493d921fb652ff85f4066c6350ea4fb93adfca49377738987c1) |
| 3 | `open_bond(breach-1)` value 2 GEN | provider | SUCCESS | `breach-1`: 2 GEN, bar 70, 2 deliveries that must each reach the bar, 1 scoring round each | [`0x5c9fe3f7…61e8c5`](https://explorer-studio-dev.genlayer.com/tx/0x5c9fe3f7cc6397dca32b27a0e88052845985c36056021df870cd459c2e61e8c5) |
| 4 | `deliver(met-1)` | stranger | **ERROR** | `deliver(met-1)` by a stranger: **UserError** `only the provider may deliver` | [`0x706f1ef9…312e4c`](https://explorer-studio-dev.genlayer.com/tx/0x706f1ef921738b9489c120920da67cb18e1997ae227dbc29a3bcbd352e312e4c) |
| 5 | `deliver(met-1)` | provider | SUCCESS | `met-1` delivery 1 frozen: `good-guide.md`, 750 characters, sha-256 `cd6a853d…` | [`0x43e5ebf5…930136`](https://explorer-studio-dev.genlayer.com/tx/0x43e5ebf5a88a8ebcb688a8f55607eee4a1211351daee25048e4dca1699930136) |
| 6 | `deliver(breach-1)` | provider | SUCCESS | `breach-1` delivery 1 frozen: `good-guide.md` (same page, sha-256 `cd6a853d…`) | [`0x9a5324d2…fb7b25`](https://explorer-studio-dev.genlayer.com/tx/0x9a5324d2ed29fcdd92a590f8af8686978420a88924912fbcc4bbad4c94fb7b25) |
| 7 | `deliver(breach-1)` | provider | SUCCESS | `breach-1` delivery 2 frozen: `thin-guide.md`, 86 characters, sha-256 `6d09f323…` (one line, no commands) | [`0xde58fa81…90d316`](https://explorer-studio-dev.genlayer.com/tx/0xde58fa8138235f8f3d70776a312710a1d4dcda5ebbc5e3443ff48ea02390d316) |
| 8 | `settle(breach-1)` | stranger | **ERROR** | `settle(breach-1)` before any delivery is scored: **UserError** `delivery 1 is not scored yet` | [`0x5af31417…a10e2a`](https://explorer-studio-dev.genlayer.com/tx/0x5af31417a10c26d374ef13f5f556748916bed79339a0c2f3c66f25f4fca10e2a) |
| 9 | `score(met-1, 1)` | stranger | SUCCESS | `met-1` delivery 1, round 1 (14:31:22 UTC): scored **95**, `passes` true → final score 95 | [`0xf950c0b9…f23079`](https://explorer-studio-dev.genlayer.com/tx/0xf950c0b93845bd149ac2ce4175671c09f91ac53105c474e63c69e5b87df23079) |
| 10 | `score(breach-1, 1)` | stranger | SUCCESS | `breach-1` delivery 1, round 1 (14:33:33 UTC): scored **73**, `passes` true → final score 73 | [`0xa4fe435c…1c57ac`](https://explorer-studio-dev.genlayer.com/tx/0xa4fe435c9c807cb6b07599a1d63db8a03f1c460d313a63541beaaa932b1c57ac) |
| 11 | `score(breach-1, 2)` | stranger | SUCCESS | `breach-1` delivery 2, round 1 (14:35:13 UTC): scored **3**, `passes` false → final score 3 | [`0x542ecf74…41c959`](https://explorer-studio-dev.genlayer.com/tx/0x542ecf746c7d0e997477bc3c304d68bbd6fe8ca9250231e4d5c5b9c25341c959) |
| 12 | `settle(met-1)` | stranger | SUCCESS | 1 of 1 deliveries reached the bar → **MET**, beneficiary the provider | [`0x6d300828…5255b4`](https://explorer-studio-dev.genlayer.com/tx/0x6d300828f631f6b7637756cca540f4a15d9a0d910047e52106cece30325255b4) |
| 13 | `settle(breach-1)` | stranger | SUCCESS | 1 of 2 deliveries reached the bar (needed 2; total 76) → **BREACHED**, beneficiary the client | [`0x8ba7f94e…370a1b`](https://explorer-studio-dev.genlayer.com/tx/0x8ba7f94eaa8758f69299aa7b437f994ca9d7e7f9342af0757a8a3df841370a1b) |
| 14 | `withdraw(met-1)` | client | **ERROR** | the client tries to take the `met-1` bond: **UserError** `only the party the outcome names may withdraw` | [`0x9b365739…53cee9`](https://explorer-studio-dev.genlayer.com/tx/0x9b365739ad8dfa7551c53656f7cb28bc218106011e3868ede8da3b26be53cee9) |
| 15 | `withdraw(met-1)` | provider | SUCCESS | the provider takes the 2 GEN `met-1` bond back | [`0x05461c2e…4a631e`](https://explorer-studio-dev.genlayer.com/tx/0x05461c2e6e1d329119be7d78a1763875de3d79278c1ce9ee8e751eb2bd4a631e) |
| 16 | `withdraw(met-1)` | provider | **ERROR** | the provider withdraws `met-1` a second time: **UserError** `the bond was already paid` | [`0x391fb19a…3162ac`](https://explorer-studio-dev.genlayer.com/tx/0x391fb19a384394a9111a5dcf29a47c2255eba8eea9b58352d3fa7589bf3162ac) |
| 17 | `withdraw(breach-1)` | provider | **ERROR** | the provider tries to take the `breach-1` bond: **UserError** `only the party the outcome names may withdraw` | [`0xbd2ce07e…31a908`](https://explorer-studio-dev.genlayer.com/tx/0xbd2ce07e1fb4661a4211253b752c6ba9405bdfe4f941faa41ba2c4752331a908) |
| 18 | `withdraw(breach-1)` | client | SUCCESS | the client takes the 2 GEN `breach-1` bond | [`0xb779edaf…189b81`](https://explorer-studio-dev.genlayer.com/tx/0xb779edaf9562d88a79e3a85b26b2faf41c989251bf6ac1f959af003513189b81) |

### End state, read from chain

| | `met-1` | `breach-1` |
|---|---|---|
| status | `met` | `breached` |
| bond | 2 GEN | 2 GEN |
| bar / deliveries promised | 70 / 1 | 70 / 2 |
| final scores | 95 | 73, 3 |
| `passed` / `passes_required` | 1 / 1 | 1 / 2 |
| beneficiary | provider `0x5867…b594` | client `0x89FD…8a1a` |
| paid | true | true |

`count_bonds` → 2, `count_events` → 12, `get_balance` → `{"balance":"0","credits":"0","held":"0"}` (read after tx 18 was
finalized; 4 GEN came in, 4 GEN went out).

### What the run shows

* **The bar decides, per delivery.** `breach-1` delivery 1 reached the bar (73 ≥ 70, `passes` true); delivery 2, the
  one-line guide, scored 3 (`passes` false). The total, 76, would clear a 70 bar on a sum; settlement counts
  deliveries that reached the bar, 1 of the 2 required, so the bond is BREACHED and the client took it.
* **Validators agreed on `passes` every time.** Each `get_round` record stores the score, the `passes` flag and the
  page hash; every round was recorded on its first send.
* **Refusals.** Wrong caller (a stranger delivering, the client withdrawing a MET bond, the provider withdrawing a
  BREACHED bond), `expire` before the final deadline (15:29:44 UTC), `settle` before the deliveries are scored, and a
  second withdrawal are each refused with their own `UserError`.

### What this run did not show

* **A round on which validators disagree.** Every scoring round reached consensus on the first send, so the
  resend path in `run.mjs` was not exercised. Disagreement, including a pair of scores on opposite sides of the bar, is
  covered by unit tests in `tests/test_scorebond.py`.
* **Variation between readings of the same page.** `good-guide.md` (the same frozen bytes, sha-256 `cd6a853d…`) was
  read 95 on `met-1` and 73 on `breach-1`, in separate rounds with a different bond title. Both readings are on the same
  side of the bar, which is what the contract binds. With `score_rounds = 3` the median of three readings is used; this
  run used 1 round per delivery to stay short. The 3-round median is shown on chain in the earlier v2 run.
* The final-deadline boundary (`score`/`settle` refused after it, `expire` accepted), refused bonds credited and
  `withdraw_credit` are shown in the earlier v2 run and covered by unit tests; they were not repeated here.
