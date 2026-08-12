# Next.js supplement

Applies on top of the framework-agnostic `AGENT.md` rules.

- **Use `next/image` for every raster image.** It emits `srcset`, modern
  formats, and lazy loading by default — the image rules, automated. Set
  `priority` only on the LCP image.
- **Prefer Server Components; add `"use client"` only where state or browser
  APIs are genuinely needed.** Every client component's code ships to and
  executes on the user's device; server components ship HTML.
- **Use static rendering (`generateStaticParams`, default caching) unless the
  response truly varies per request.** `force-dynamic` and uncached `fetch`
  turn a file read into a server render per view.
- **Use `next/font` with `subsets` declared.** It self-hosts, subsets, and
  inlines the CSS — removing both the third-party font origin and the
  oversized family download.
- **Use `next/dynamic` for below-the-fold or interaction-gated components.**
  Keeps modal/editor/chart code out of the route's first-load bundle.
- **Check `next build`'s first-load JS per route; treat growth as a
  regression to explain.** The build already prints the budget signal —
  read it.
- **Use `@next/third-parties` (e.g. `YouTubeEmbed`) for heavy embeds.** These
  are the facade pattern, maintained.
