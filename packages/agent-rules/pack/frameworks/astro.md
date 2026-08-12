# Astro supplement

Applies on top of the framework-agnostic `AGENT.md` rules.

- **Keep components as plain `.astro` (zero JS) by default; add framework
  islands only for real interactivity.** Astro's default is the green
  default — preserve it.
- **Choose the least-eager `client:` directive that works: `client:visible`
  or `client:idle` over `client:load`.** Hydration cost should track what the
  user actually sees and does.
- **Use `<Image />`/`<Picture />` from `astro:assets` for raster images.**
  Build-time AVIF/WebP conversion and dimension enforcement come free.
- **Stay on static output (`output: 'static'`); use server islands or
  on-demand rendering only for the genuinely dynamic parts.** Prerendered
  HTML costs nothing per view.
- **Use `astro:transitions` (View Transitions) instead of shipping a SPA
  router when page-to-page animation is the only motivation.** A router
  drags the rest of a framework runtime with it.
