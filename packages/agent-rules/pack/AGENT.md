# Green-web coding rules

Rules for writing lower-carbon, cheaper-to-run website code. Installed by
`wattprint agent-rules install`. Framework-specific supplements live in
`frameworks/`.

Every transferred byte costs electricity in data centers, networks, and user
devices, and every wasted CPU cycle drains batteries and inflates hosting
bills. These rules exist because the cheapest, fastest page is usually also
the lowest-carbon page: the rationale on each rule ties it back to bytes or
compute.

## Priority order — read first

**Never sacrifice accessibility, correctness, or security for carbon.** When
a green rule conflicts with user experience, accessibility, or correctness,
user experience wins. These rules remove waste; they never justify removing
function. Alt text, focus management, ARIA semantics, form validation, and
security headers are not weight to optimize away.

Numbers produced by wattprint are **modeled estimates** under a published
methodology, useful for comparison and trend, not measured emissions. Never
describe a change as making a site "carbon neutral"; the only honest claim is
*reduced modeled emissions*.

## Images

- **Serve AVIF (or WebP) with a fallback when adding any raster image.**
  Modern formats are 30–70% smaller than JPEG/PNG at equal quality — the
  single largest byte win on most pages.
- **Size images to their rendered dimensions and provide `srcset`/`sizes`
  when layout varies.** Shipping a 2000px image into a 400px slot transfers
  bytes no one sees.
- **Set explicit `width`/`height` (or `aspect-ratio`) on every image.**
  Prevents layout shift and the re-layout/re-paint compute that comes with it.
- **Add `loading="lazy"` to images below the fold; never to the LCP image.**
  Bytes for content the user may never scroll to should not be transferred up
  front.
- **Prefer SVG for icons, logos, and diagrams.** Vector beats raster on both
  bytes and sharpness for non-photographic art.

## JavaScript

- **Start with zero JS for content that is static once rendered; add
  interactivity per-island when needed.** JS is the most expensive byte type:
  it is transferred, parsed, compiled, and executed on the user's CPU.
- **Check bundle impact before adding any dependency; prefer the platform API
  when one exists.** A date-formatting or class-merging helper can cost more
  wire bytes than the feature it serves.
- **Use `defer` (or `type="module"`) for scripts, and dynamic `import()` for
  code behind user actions.** Code the user might not need should not block
  or even join first load.
- **Ship modern ES2020+ output to modern browsers; avoid blanket
  transpilation/polyfills.** Legacy output inflates every bundle for a
  vanishing share of clients.

## Third parties

- **Default to skepticism on any third-party script; demand a named,
  current purpose for each one.** Tag managers, chat widgets, and abandoned
  A/B tests routinely outlive their justification while shipping hundreds of
  KB per view.
- **Embed heavy widgets (video players, maps, social posts) as a facade — a
  static preview that loads the real thing on interaction.** A YouTube embed
  is ~600 KB before anyone presses play; a facade is a few KB.
- **Self-host analytics-lite or use server logs when pageview counts are all
  that is needed.** A full analytics suite on every page is compute and bytes
  spent on data nobody reads.

## Fonts

- **Subset fonts to the scripts/characters actually used and ship WOFF2
  only.** Full font families are hundreds of KB; a Latin subset is often
  under 30 KB.
- **Limit custom fonts to the weights/styles in the design, use
  `font-display: swap`, and consider the system font stack for UI text.**
  Every extra weight is another download that blocks brand-critical text.

## Delivery and caching

- **Serve all text assets (HTML/JS/CSS/SVG/JSON) with Brotli or gzip
  compression.** 60–80% wire-byte reduction for one server config line.
- **Give hashed static assets `Cache-Control: public, max-age=31536000,
  immutable`.** Returning visitors then transfer almost nothing — caching is
  the cheapest CDN there is.
- **Serve behind a CDN or edge cache when the audience is not single-region.**
  Shorter network paths cost less energy and less latency.

## Rendering and pages

- **Render static-first: prerender content at build time; reserve SSR for
  genuinely dynamic responses and client rendering for genuinely interactive
  state.** A static page costs a file read; an SSR page costs a server render
  on every view, every day.
- **Paginate, virtualize, or defer long lists and feeds instead of rendering
  everything.** DOM size drives memory and CPU on the user's device.
- **Use CSS (and the `<video>`/`prefers-reduced-motion` machinery) instead of
  JS animation loops, and never autoplay video.** Video is the heaviest byte
  type per second; an autoplaying hero can outweigh the rest of the site
  combined.

## Backend-touching changes

Server-side energy is out of scope for wattprint's model (it estimates the
transfer-driven segments). When a PR changes backend compute (new cron jobs,
N+1 queries, chatty APIs), flag it for a manual note in review rather than
claiming a modeled number.
