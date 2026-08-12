import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { measureDir, serveStatic } from "../src/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const heavyDir = join(repoRoot, "fixtures", "heavy-site");
const optimizedDir = join(repoRoot, "fixtures", "optimized-site");

beforeAll(() => {
  execFileSync("node", [join(repoRoot, "fixtures", "generate-assets.mjs")]);
});

describe("serveStatic", () => {
  it("serves html uncached and assets cached, gzipping text types", async () => {
    const server = await serveStatic(heavyDir);
    try {
      const doc = await fetch(`${server.url}/`);
      expect(doc.status).toBe(200);
      expect(doc.headers.get("content-type")).toContain("text/html");
      expect(doc.headers.get("cache-control")).toBe("no-cache");
      expect(doc.headers.get("content-encoding")).toBe("gzip");

      const js = await fetch(`${server.url}/assets/generated/app.js`);
      expect(js.headers.get("cache-control")).toContain("max-age=31536000");
      expect(js.headers.get("content-encoding")).toBe("gzip");

      const img = await fetch(`${server.url}/assets/generated/hero.png`);
      expect(img.headers.get("content-encoding")).toBeNull();

      const missing = await fetch(`${server.url}/nope.html`);
      expect(missing.status).toBe(404);

      const traversal = await fetch(`${server.url}/..%2f..%2fpackage.json`);
      expect([403, 404]).toContain(traversal.status);
    } finally {
      await server.close();
    }
  });
});

describe("measureDir", () => {
  it("measures the heavy fixture with per-type breakdown and cold/warm passes", async () => {
    const snapshot = await measureDir(heavyDir, { runs: 1 });
    const route = snapshot.routes[0];
    expect(route).toBeDefined();
    if (!route) return;

    // 1 html + 3 scripts + 1 css + 2 fonts + 4 images
    expect(route.requests).toBe(11);
    // JPEGs and WOFF2s are incompressible: >= 3.5 MB wire even with gzip on text
    expect(route.transferBytes).toBeGreaterThan(3_500_000);
    expect(route.bytesByType?.image).toBeGreaterThan(3_000_000);
    expect(route.bytesByType?.js).toBeGreaterThan(0);
    expect(route.bytesByType?.font).toBeGreaterThan(400_000);
    // gzip actually shrinks the generated JS below its 990 KB raw size
    expect(route.bytesByType?.js).toBeLessThan(990_000);

    // warm pass: everything except the no-cache HTML document is cached
    expect(route.warmTransferBytes).toBeDefined();
    expect(route.warmTransferBytes ?? Infinity).toBeLessThan(route.transferBytes * 0.05);

    // assets are recorded largest-first with headers
    expect(route.assets[0]?.url).toContain("hero.png");
    expect(route.assets[0]?.contentEncoding).toBeNull();
    const js = route.assets.find((a) => a.url.endsWith("app.js"));
    expect(js?.contentEncoding).toBe("gzip");
    expect(js?.cacheControl).toContain("max-age");
    // same-origin fixture has no third-party requests
    expect(route.thirdParty).toEqual({ bytes: 0, requests: 0 });
  });

  it("shows the optimized twin is dramatically lighter", async () => {
    const heavy = await measureDir(heavyDir, { runs: 1, warmPass: false });
    const optimized = await measureDir(optimizedDir, { runs: 1, warmPass: false });
    const heavyBytes = heavy.routes[0]?.transferBytes ?? 0;
    const optimizedBytes = optimized.routes[0]?.transferBytes ?? 0;
    expect(optimizedBytes).toBeGreaterThan(0);
    expect(optimizedBytes).toBeLessThan(heavyBytes / 10);
  });
});
