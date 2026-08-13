# Contributing to wattprint

## Setup

```sh
pnpm install
pnpm fixtures:build   # generate fixture assets (deterministic, not committed)
pnpm build
pnpm test
```

`@wattprint/measure` tests need a Chromium Playwright can find:
`pnpm --filter @wattprint/measure exec playwright install chromium`, or point `WATTPRINT_CHROMIUM` at an
existing binary.

## Ground rules

- **Honesty requirements are load-bearing.** Any surface that prints a number
  must label it a modeled estimate and carry the model + coefficient version.
  PRs that drop those labels won't merge, whatever else they improve.
- **Coefficients live in versioned data files** (`packages/core/src/data/`),
  never in code. A coefficient update bumps `coefficientsVersion` in the same
  change, and diffs across versions must keep warning that trends aren't
  comparable.
- **Write tests first for estimator changes** — worked examples with
  hand-derivable literals, plus the co2.js oracle suite where applicable.
- **Keep packages dependency-light.** Every dependency is bytes and compute
  for every consumer; the bar for adding one is high.

## Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, …).
- One PR does one thing.
- Releases use [changesets](https://github.com/changesets/changesets): run
  `pnpm changeset` in your PR when a package's public behavior changes.
- CI must be green: build, unit tests, and the fixture-site e2e of the
  action.

## Adding an estimation model

Implement `EstimationModel` (`packages/core/src/model.ts`), keep every
coefficient in a versioned data file with a `source` field, register it in
`index.ts`, and add worked-example tests demonstrating published inputs →
published outputs. Models that cannot cite a published methodology don't
ship.

## Adding a grid-intensity provider

Implement `GridIntensityProvider` (`packages/schedule/src/index.ts`). Return
an empty forecast rather than fabricated data when the upstream has no
coverage — `lowestCarbonWindow` treats "don't know" as an answer.
