import { describe, expect, it } from "vitest";
import { MARKER, renderComment, topNewAssets } from "../scripts/render.mjs";

const estimate = {
  disclaimer: "Modeled estimate, not a measurement.",
  model: { id: "swdm-v4", coefficientsVersion: "swdm-v4.2024" },
  siteGramsPerPageview: 0.045,
  annualized: { pageviewsPerMonth: 100_000, kgCO2ePerYear: 54 },
};

function scan(routesAssets) {
  return {
    kind: "wattprint-scan",
    estimate,
    snapshot: {
      routes: Object.entries(routesAssets).map(([route, assets]) => ({
        route,
        transferBytes: assets.reduce((s, a) => s + a.transferBytes, 0),
        assets: assets.map((a) => ({ url: `http://127.0.0.1:1${a.path}`, ...a })),
      })),
    },
  };
}

const headScan = scan({
  "/": [
    { path: "/hero.png", transferBytes: 80_000 },
    { path: "/new-carousel.js", transferBytes: 300_000 },
  ],
});
const baseScan = scan({ "/": [{ path: "/hero.png", transferBytes: 80_000 }] });

const diff = {
  warnings: [],
  base: { siteGramsPerPageview: 0.03, siteKbPerPageview: 200 },
  head: { siteGramsPerPageview: 0.045, siteKbPerPageview: 380 },
  deltaSiteGramsPerPageview: 0.015,
  deltaSiteKbPerPageview: 180,
  deltaAnnualizedKgPerYear: 18,
  routes: [
    {
      route: "/",
      status: "changed",
      deltaTransferBytes: 300_000,
      deltaGramsPerPageview: 0.015,
    },
  ],
};

const budget = {
  breached: true,
  failCiOnBreach: true,
  checks: [
    { scope: "site", route: null, metric: "gramsPerPageview", limit: 0.04, actual: 0.045, ok: false },
    { scope: "route", route: "/", metric: "transferKbPerPageview", limit: 500, actual: 380, ok: true },
  ],
};

describe("topNewAssets", () => {
  it("returns head-only assets largest first", () => {
    const top = topNewAssets(headScan, baseScan);
    expect(top).toEqual([{ path: "/new-carousel.js", transferBytes: 300_000 }]);
  });

  it("treats everything as new without a base scan", () => {
    const top = topNewAssets(headScan, null, 2);
    expect(top.map((a) => a.path)).toEqual(["/new-carousel.js", "/hero.png"]);
  });
});

describe("renderComment", () => {
  it("renders the full diff comment with marker, table, budget, and new assets", () => {
    const body = renderComment({ diff, budget, headScan, baseScan });
    expect(body).toContain(MARKER);
    expect(body).toContain("modeled estimates");
    expect(body).toContain("swdm-v4.2024");
    expect(body).toContain("0.030 g → 0.045 g");
    expect(body).toContain("+0.015 g");
    expect(body).toContain("**+18.0 kg CO2e/year**");
    expect(body).toContain("| `/` | changed | +300.0 KB | +0.015 g |");
    expect(body).toContain("🔴 **Budget breached**");
    expect(body).toContain("`/new-carousel.js` — 300.0 KB");
    expect(body).toContain('never "carbon neutral"');
  });

  it("renders a head-only comment when no diff exists", () => {
    const body = renderComment({ diff: null, budget: null, headScan, baseScan: null });
    expect(body).toContain("no base measurement");
    expect(body).toContain("0.045 g CO2e/pageview");
    expect(body).toContain("traffic-dependent");
  });

  it("surfaces comparability warnings prominently", () => {
    const body = renderComment({
      diff: { ...diff, warnings: ["Coefficient versions differ; trends not comparable."] },
      budget: null,
      headScan,
      baseScan,
    });
    expect(body).toContain("> ⚠️ Coefficient versions differ");
  });
});
