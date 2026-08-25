# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Repo-specific rules

### What this repo is

wattprint: an **open-source (MIT), public-facing** green-web toolkit — carbon
estimation, budgets, and per-PR diffs for websites. pnpm-workspaces TypeScript
monorepo (strict ESM, Node >= 20), Vitest, changesets for releases. Six
packages under `packages/`: `core` (estimation engine), `measure` (Playwright
measurer), `cli`, `action` (composite GitHub Action, repo-distributed),
`agent-rules` (green coding rules pack), `schedule` (carbon-aware scheduling).
`fixtures/` holds the heavy/optimized twin sites used by tests and docs.

**This repo is public.** No Milton-internal hostnames, tokens, infra details,
Linear links, or company process files in code, comments, commit messages, or
issues. The internal Claude Code baseline is never synced here; this file and
`AGENTS.md` carry only project rules.

### Key commands

- `pnpm install && pnpm fixtures:build && pnpm build && pnpm test` — the full
  local loop. Fixture assets are generated, never committed.
- Measure/CLI tests need a Chromium Playwright can launch: `pnpm --filter
  @wattprint/measure exec playwright install chromium` (playwright lives in
  that package, not the root), or set `WATTPRINT_CHROMIUM=<path>`.
- Run one package: `pnpm --filter @wattprint/core test`.
- Release: `pnpm changeset` in the PR; the release workflow publishes on merge.

### Repo-specific conventions

- **Honesty requirements are load-bearing** (see CONTRIBUTING.md). Every
  surface that prints a number must label it a modeled estimate and carry the
  model id + coefficient version. Never emit "carbon neutral"/offset language.
- **Coefficients live in versioned data files** (`packages/core/src/data/`)
  with a `source` field, never in code. Changing one bumps
  `coefficientsVersion` in the same commit; cross-version diffs must keep
  warning that trends aren't comparable.
- **Estimator changes are tested against worked examples first** — hand-derived
  literals plus the co2.js oracle suite in `packages/core/test/`.
- **Keep packages dependency-light.** New runtime dependencies need a reason a
  reviewer will accept; the toolkit preaches byte discipline and must practice it.
- **The Action's runtime is committed plain ESM** (`packages/action/scripts/`)
  — it runs from a raw checkout, so no build outputs, no TypeScript there.
- **Agent-rules content changes** (`packages/agent-rules/pack/`) keep the rule
  format: positive default + one-line bytes/cost/carbon rationale, and the
  accessibility/correctness/security-wins clause stays at the top.

### Important context

- The npm scope is `@wattprint`; claim it on npm before first publish.
- `wattprint.config.json` is validated by both the published JSON Schema
  (`packages/core/schema/`) and `validateConfig` — keep them in sync when the
  config surface changes.
- CI must stay green on: build, unit tests, and the `action-e2e` job that
  diffs the fixture twins with the real composite action.

