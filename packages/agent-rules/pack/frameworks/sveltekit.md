# SvelteKit supplement

Applies on top of the framework-agnostic `AGENT.md` rules.

- **Use `@sveltejs/enhanced-img` for raster images.** Build-time modern
  formats, `srcset`, and intrinsic dimensions without hand-rolling.
- **Set `export const prerender = true` for every route that does not vary
  per request (adapter-static for whole sites).** Prerendered pages cost a
  file read, not a server render.
- **Load data in `+page.server.ts`/server `load` functions; keep secrets and
  data-shaping off the client bundle.** Shipping raw data plus shaping code
  to the browser pays twice — bytes and client CPU.
- **Lean on progressive enhancement: `<form>` with `use:enhance` over
  hand-rolled fetch flows.** The page keeps working before (and without) JS,
  and the JS that ships is smaller.
- **Watch the per-route JS in `vite build`'s output; investigate any jump.**
  Svelte compiles small — a big chunk almost always means an oversized
  dependency walked in.
