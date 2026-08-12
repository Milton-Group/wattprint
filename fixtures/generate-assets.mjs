// Generates the binary/bulky fixture assets deterministically so multi-MB
// files never live in git. Run via `pnpm fixtures:build` before tests.
// Assets are byte-identical across runs (seeded xorshift), which keeps
// measurement tests stable.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// Incompressible pseudo-random bytes: models already-compressed formats
// (JPEG, WOFF2, video) that gzip/brotli cannot shrink.
function binaryBlob(seed, bytes) {
  const rng = makeRng(seed);
  const buf = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) buf[i] = Math.floor(rng() * 256);
  return buf;
}

// Repetitive code-like text: compresses well, like real JS/CSS does.
function textBlob(seed, approxBytes, kind) {
  const rng = makeRng(seed);
  const words = ["component", "render", "state", "props", "handler", "module", "config", "listener", "payload", "queue"];
  let out = "";
  let i = 0;
  while (out.length < approxBytes) {
    const w = () => words[Math.floor(rng() * words.length)];
    out +=
      kind === "js"
        ? `function ${w()}_${i}(a,b){const ${w()}=a+b;return ${w()}*${(rng() * 100).toFixed(3)};}\n`
        : `.${w()}-${i}{margin:${Math.floor(rng() * 40)}px;padding:${Math.floor(rng() * 24)}px;color:#${Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0")};}\n`;
    i++;
  }
  return Buffer.from(out);
}

const KB = 1000;
const assets = [
  // heavy-site: an unoptimized marketing page
  ["heavy-site", "hero.jpg", binaryBlob(0xc0ffee01, 1800 * KB)],
  ["heavy-site", "gallery-1.jpg", binaryBlob(0xc0ffee02, 420 * KB)],
  ["heavy-site", "gallery-2.jpg", binaryBlob(0xc0ffee03, 410 * KB)],
  ["heavy-site", "gallery-3.jpg", binaryBlob(0xc0ffee04, 430 * KB)],
  ["heavy-site", "brand-full.woff2", binaryBlob(0xc0ffee05, 240 * KB)],
  ["heavy-site", "brand-bold.woff2", binaryBlob(0xc0ffee06, 230 * KB)],
  ["heavy-site", "vendor.js", textBlob(0xc0ffee07, 640 * KB, "js")],
  ["heavy-site", "app.js", textBlob(0xc0ffee08, 260 * KB, "js")],
  ["heavy-site", "analytics-tag.js", textBlob(0xc0ffee09, 90 * KB, "js")],
  ["heavy-site", "styles.css", textBlob(0xc0ffee0a, 150 * KB, "css")],
  // optimized-site: the same page after applying the agent-rules pack
  ["optimized-site", "hero.avif", binaryBlob(0xbeef0001, 78 * KB)],
  ["optimized-site", "gallery-1.avif", binaryBlob(0xbeef0002, 24 * KB)],
  ["optimized-site", "gallery-2.avif", binaryBlob(0xbeef0003, 23 * KB)],
  ["optimized-site", "gallery-3.avif", binaryBlob(0xbeef0004, 25 * KB)],
  ["optimized-site", "brand-subset.woff2", binaryBlob(0xbeef0005, 32 * KB)],
  ["optimized-site", "app.js", textBlob(0xbeef0006, 34 * KB, "js")],
  ["optimized-site", "styles.css", textBlob(0xbeef0007, 9 * KB, "css")],
];

for (const [site, name, buf] of assets) {
  const dir = join(root, site, "assets", "generated");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buf);
}
console.log(`generated ${assets.length} fixture assets`);
