# AGENTS.md

Instructions for Codex when working in this repository.

## Repo-specific rules

### Tech stack

wattprint — open-source (MIT), public green-web toolkit. pnpm-workspaces
TypeScript monorepo, strict ESM, Node >= 20, Vitest, changesets. Packages:
`core`, `measure`, `cli`, `action`, `agent-rules`, `schedule`; fixture twin
sites in `fixtures/`. This repo is public: no Milton-internal hostnames,
tokens, infra details, or company process files anywhere in it; the internal
Claude Code baseline is never synced here.

### Key commands

- `pnpm install && pnpm fixtures:build && pnpm build && pnpm test`
- Browser tests: `pnpm --filter @wattprint/measure exec playwright install chromium`, or set
  `WATTPRINT_CHROMIUM=<path to chromium>`
- Single package: `pnpm --filter @wattprint/<name> test`

### Repo-specific conventions

- Every printed figure is a **modeled estimate** labeled with model id +
  coefficient version. Never write "carbon neutral" or offset language.
- Coefficients live only in versioned data files under
  `packages/core/src/data/` (with `source`); changing one bumps
  `coefficientsVersion` in the same commit.
- Estimator changes need worked-example tests plus the co2.js oracle suite.
- Be stingy with runtime dependencies; the toolkit preaches byte discipline.
- `packages/action/scripts/` is committed plain ESM that runs from a raw
  checkout — no TypeScript or build outputs there.

### Important context

- Keep `packages/core/schema/wattprint.config.schema.json` and
  `validateConfig` in sync when the config surface changes.
- CI gates: build, unit tests, and the `action-e2e` fixture-diff job.

