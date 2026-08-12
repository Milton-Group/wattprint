# Methodology

wattprint's default model is the **Sustainable Web Design Model v4**
(SWDM v4), published at
[sustainablewebdesign.org/estimating-digital-emissions](https://sustainablewebdesign.org/estimating-digital-emissions/).
Coefficient values are recorded in
[`packages/core/src/data/swdm-v4-coefficients.json`](../packages/core/src/data/swdm-v4-coefficients.json)
with their provenance, and every result object embeds the model id and
coefficient version. wattprint's implementation is unit-tested to agree with
[co2.js](https://github.com/thegreenwebfoundation/co2.js), the reference
implementation maintained with the methodology's publishers.

## The model in one paragraph

Emissions per view are modeled from **wire bytes transferred**:

```
grams = Σ segment ∈ {data center, network, user device}
        Σ kind ∈ {operational, embodied}
          bytes/1e9 × intensity(segment, kind) kWh/GB × grid(segment) gCO2e/kWh
```

The six energy-intensity coefficients sum to 0.300 kWh/GB; at the global
average grid intensity (494 g CO₂e/kWh, Ember yearly data), one decimal
gigabyte ≈ **148.2 g CO₂e**. Embodied (device/infrastructure manufacturing)
emissions always use the global grid intensity; operational segments can be
adjusted:

- `traffic.audienceGridIntensity` → user-device segment (scalar, or a
  geo-weighted table collapsed to its share-weighted mean).
- `infra.hostingGridIntensity` → data-center segment.
- `infra.greenHostingVerified: true` → removes the data-center
  *operational* term entirely (embodied always remains). Use only when the
  claim is externally verifiable (e.g. the Green Web Foundation dataset).

## Returning visitors

Where SWDM applies a fixed first/return-visit heuristic, wattprint prefers
measurement: `@wattprint/measure` runs a cold-cache and a warm-cache pass,
and the blended per-pageview figure weights them by your configured
`returningVisitorRatio`. With no warm measurement, no cache benefit is
assumed.

## What the numbers are — and aren't

- **Modeled estimates.** The model converts transfer to energy to emissions
  using global averages; your actual device mix, network path, and grid will
  differ. The numbers are for *comparison* — route vs route, PR vs PR,
  before vs after — not for carbon accounting.
- **Per-pageview vs annualized.** Per-pageview figures are comparable across
  sites and time; annualized figures multiply by your traffic estimate and
  are only as good as it is. wattprint always shows both, labeled.
- **Coefficient updates break trend lines.** When coefficients change (grid
  intensity updates yearly), `wattprint diff` warns that cross-version deltas
  are not meaningful. Re-baseline after upgrading.
- **Server-side compute is out of scope.** The model covers transfer-driven
  segments. A PR that adds cron jobs or N+1 queries needs a human note, not
  a modeled number — wattprint will not invent one.

## Plugging in another methodology

`EstimationModel` (`packages/core/src/model.ts`) is the seam: implement it
with your own versioned coefficient file and register it. The requirement
for shipping in-tree is a published, citable methodology and worked-example
tests.
