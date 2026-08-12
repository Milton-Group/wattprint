# @wattprint/action

GitHub composite action that posts a sticky modeled-carbon diff comment on
pull requests. Distributed from this repository (not npm):

```yaml
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

## Inputs

| Input | Default | Purpose |
|---|---|---|
| `build-command` | — | Builds the site; run for base and head unless a prebuilt dir is given |
| `output-dir` | `dist` | Build output directory |
| `base-dir` / `head-dir` | — | Prebuilt output paths (skip checkout/build for that side) |
| `routes` | `/` | Comma-separated routes to measure |
| `runs` | `3` | Runs per route, median kept |
| `config-path` | `wattprint.config.json` | Config with traffic, infra, budgets |
| `fail-on-breach` | `false` | Fail the job when head breaches budgets |
| `github-token` | `github.token` | Token for the sticky comment |
| `cli` | `npx --yes @wattprint/cli@latest` | Override to pin a CLI version |
| `dry-run` | `false` | Step summary only, no comment |

Base measurements are cached by base SHA, so repeated pushes to a PR only
re-measure head. The comment is upserted by a `<!-- wattprint-report -->`
marker — one comment per PR, always current. Playwright's Chromium must be
installed in the job (`npx playwright install --with-deps chromium`) unless
your runner image already ships it.

Every figure in the comment is a modeled estimate labeled with the model and
coefficient versions; see [docs/methodology.md](../../docs/methodology.md).
