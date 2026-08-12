# Fixture sites

Two versions of the same page, used by tests and by the docs as the
before/after example:

- **heavy-site** — eager full-resolution JPEGs, two full font families, three
  blocking script bundles including a third-party-style analytics tag.
- **optimized-site** — AVIF images with dimensions, lazy loading below the
  fold, one deferred bundle, a subset font, no analytics tag.

Bulky assets are not committed. `pnpm fixtures:build` generates them
deterministically (seeded PRNG) into `*/assets/generated/`. Binary formats are
incompressible random bytes (like real JPEG/WOFF2 payloads); JS/CSS are
repetitive generated text so gzip/brotli behave realistically. The "images"
are not decodable — measurement only cares about wire bytes, requests, and
headers.
