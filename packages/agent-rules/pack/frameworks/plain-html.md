# Plain HTML/CSS/JS supplement

Applies on top of the framework-agnostic `AGENT.md` rules. No framework means
no framework doing these for you — do them by hand.

- **Write `<picture>` with an AVIF/WebP `<source>` and JPEG/PNG fallback for
  every photo; generate the variants in the build step (e.g. sharp, Squoosh
  CLI).** Nothing else will do it for you.
- **Set `width`/`height` attributes on every `<img>`, `loading="lazy"` below
  the fold.** Two attributes, no tooling, most of the image wins.
- **Keep one small CSS file and one deferred JS file; inline critical CSS
  only when measured render-blocking justifies it.** Requests are cheap with
  HTTP/2, but unused framework CSS/JS is pure waste — start from zero, not
  from a kitchen-sink bundle.
- **Precompress at build time (`brotli`/`gzip` files next to the originals)
  when the host supports it, and hash asset filenames for immutable
  caching.** Static hosts serve precompressed bytes without per-request CPU.
- **Validate output HTML and run the page through wattprint before and after
  changes.** With no framework budget reports, the scan is the budget
  report.
