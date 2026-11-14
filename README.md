# Token Radar 01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dandelionz3/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dandelionz3/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar is a sealed-snapshot view of protocols that the snapshot records
without a token market record. It orders those projects using an implied-value
score and includes a practical six-step activity plan for every board row.
The dashboard also has a separate view of established, live-market protocols.

## What the score means

The `radar-2` score starts with snapshot TVL and multiplies it by the median
market-cap-to-TVL ratio for live protocols in that project's category. When
fewer than three same-category examples qualify, the overall live-token median
is used instead. The ratio is capped at 2.0.

It then applies a growth factor from the seven-day TVL change, clamped to
−60% through 120% and weighted by 0.5; a maturity factor from 0.6 to 1.0 over
1,095 days (unknown ages use 365 days); and a chain factor that adds 2% per
additional chain, up to four. The result is rounded to whole dollars.
These are ranking assumptions, not a prediction or promise of a token launch.
The snapshot's absence of market cap, Gecko id, and symbol is the entry's
operational definition of “pre-token”; it cannot prove that no token exists.

The submitted board has 178 rows: all 40 supplied watchlist protocols and
138 additional early candidates selected by the entry's screening rules.
The dashboard lets readers filter and sort those rows, inspect the arithmetic,
and adjust display assumptions in a local model sandbox.

## Run

Provide a snapshot JSON file, then run:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>
```

The output contains `board.json`, `data.js`, the static dashboard, screenshots,
and a dossier assembled from those files. The program uses the supplied input
and local files; the dashboard does not fetch data from a remote service.

## Entry details

- Owner: dandelionz3
- Repository: makefun-token-radar-01
- Competition: token-radar-01
- Referral: {referral_code=wzx9n98z}
- Run: `MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>`

{owner} dandelionz3
{repo} makefun-token-radar-01
{description} A sealed-snapshot radar with an explainable category-relative score, a 178-row pre-token board, concrete farm plans, and a separate live comparables view.
{run} MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>

---

<sub>Entered on [make.fun](https://make.fun/?ref=wzx9n98z&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
