# wattprint

**Carbon budgets for websites, built for CI and coding agents.** Performance
budgets exist; carbon budgets don't — not in a form developers actually
adopt. wattprint is "Lighthouse + budgets for carbon": estimate a site's
g CO₂e per pageview under a published methodology, diff it on every pull
request, enforce budgets, and give AI coding agents machine-readable rules so
greener code gets written in the first place.

> **Every number wattprint produces is a modeled estimate**, not a
> measurement. Results carry the model name and coefficient version
> (default: [Sustainable Web Design Model v4](https://sustainablewebdesign.org/estimating-digital-emissions/),
> ~148.2 g CO₂e per GB transferred at the global average grid intensity) so
> they are reproducible, auditable, and comparable between runs. The only
> claim wattprint will ever make is *reduced modeled emissions* — never
> "carbon neutral", never offsets.

## The before/after demo

The repo ships two fixture builds of the same page (`fixtures/`). Real
numbers from `wattprint diff` on them, at 100k pageviews/month:

| | heavy | optimized | Δ |
|---|---:|---:|---:|
| Wire transfer / view | 3.71 MB | 189 KB | −95% |
| Modeled g CO₂e / pageview | 0.413 | 0.021 | **−0.391** |
| Modeled kg CO₂e / year | 495 | 26 | **−470** |

The "optimization" is nothing exotic — it is exactly the
[agent-rules pack](packages/agent-rules/pack/AGENT.md): right-sized
compressed images, lazy loading below the fold, one deferred bundle instead
of three blocking ones, a subset font, no third-party tag.

## Quick start

```sh
npx @wattprint/cli scan https://example.com     # or a local build dir
npx @wattprint/cli init                         # write wattprint.config.json
npx @wattprint/cli budget dist/                 # exit 2 on budget breach
npx @wattprint/cli diff base-scan.json dist/    # carbon delta
npx @wattprint/cli agent-rules install          # green rules for your coding agent
```

Every command takes `--json` for programmatic use.

## PR diffs in CI

```yaml
# .github/workflows/wattprint.yml
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  carbon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Milton-Group/wattprint/packages/action@main
        with:
          build-command: npm ci && npm run build
          output-dir: dist
          fail-on-breach: "true"
```

The action builds base and head (base measurements cached by SHA), and posts
one sticky comment per PR: per-route Δg CO₂e/pageview, annualized Δkg at your
configured traffic, budget status, the top new assets, and the model +
coefficient versions behind the numbers. A GitLab CI template lives at
[`packages/action/gitlab/`](packages/action/gitlab/wattprint.gitlab-ci.yml).

## Configuration

One file, `wattprint.config.json`, with a published
[JSON Schema](packages/core/schema/wattprint.config.schema.json):

```json
{
  "$schema": "./node_modules/@wattprint/core/schema/wattprint.config.schema.json",
  "configVersion": 1,
  "traffic": { "pageviewsPerMonth": 100000, "returningVisitorRatio": 0.25 },
  "infra": { "greenHostingVerified": false },
  "budgets": {
    "maxGramsPerPageview": 0.5,
    "maxTransferKbPerPageview": 1500,
    "failCiOnBreach": true
  }
}
```

Traffic weights routes and annualizes totals (annualized figures are
traffic-dependent — the per-pageview figure is the comparable one; both are
always reported together). Audience/hosting grid intensities and verified
green hosting adjust the model's segments; see
[docs/methodology.md](docs/methodology.md).

## Packages

| Package | What it is |
|---|---|
| [`@wattprint/core`](packages/core) | Estimation engine: SWDM v4 with a pluggable model interface, versioned coefficients, diffs, budgets. Tested against the published worked examples and the co2.js reference implementation. |
| [`@wattprint/measure`](packages/measure) | Playwright measurement of URLs or local build dirs (bundled static server): wire bytes by type, requests, third-party share, compression/cache headers, cold + warm passes, median of N runs. |
| [`@wattprint/cli`](packages/cli) | `scan` / `diff` / `budget` / `init` / `agent-rules install`, JSON output everywhere. |
| [`@wattprint/action`](packages/action) | GitHub composite action + GitLab CI template for sticky PR carbon diffs. |
| [`@wattprint/agent-rules`](packages/agent-rules) | Green-web coding rules for AI agents: framework-agnostic `AGENT.md` + Next.js/Astro/SvelteKit/plain-HTML supplements. Accessibility, correctness, and security always win over carbon. |
| [`@wattprint/schedule`](packages/schedule) | Carbon-aware scheduling for deferrable jobs: pluggable grid-intensity providers, static-data provider shipped, live providers to follow. |

## Honesty rules baked into every surface

- Every figure is labeled a **modeled estimate** with methodology +
  coefficient version attached.
- Per-pageview (comparable) and annualized (traffic-dependent) figures are
  always reported together.
- Diffs across different coefficient versions warn that trend lines are not
  comparable.
- No offset claims, no "carbon neutral". Reduced modeled emissions is the
  entire claim.
- Server-side energy is out of model scope; backend-touching PRs deserve a
  manual note, not a made-up number.

## Non-goals (v1)

No hosted SaaS, no accounts, no telemetry, no server-side energy metering, no
browser extension.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
