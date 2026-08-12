import { describe, expect, it } from "vitest";
import {
  DISCLAIMER,
  estimateSite,
  normalizeWeights,
  type Snapshot,
  type WattprintConfig,
} from "../src/index.js";

const GRAMS_PER_BYTE = 148.2 / 1e9;

const config: WattprintConfig = {
  configVersion: 1,
  traffic: {
    pageviewsPerMonth: 100_000,
    routeWeights: { "/": 0.7, "/about": 0.3 },
  },
};

const snapshot: Snapshot = {
  capturedAt: "2026-08-12T00:00:00Z",
  routes: [
    { route: "/", transferBytes: 2_000_000 },
    { route: "/about", transferBytes: 500_000 },
  ],
};

describe("estimateSite", () => {
  it("weights routes by configured traffic share", () => {
    const result = estimateSite(snapshot, config);
    const expected =
      0.7 * 2_000_000 * GRAMS_PER_BYTE + 0.3 * 500_000 * GRAMS_PER_BYTE;
    expect(result.siteGramsPerPageview).toBeCloseTo(expected, 9);
    expect(result.siteKbPerPageview).toBeCloseTo(0.7 * 2000 + 0.3 * 500, 9);
  });

  it("annualizes from monthly pageviews", () => {
    const result = estimateSite(snapshot, config);
    const expectedKg = (result.siteGramsPerPageview * 100_000 * 12) / 1000;
    expect(result.annualized?.kgCO2ePerYear).toBeCloseTo(expectedKg, 9);
  });

  it("omits annualized figures without traffic volume", () => {
    const result = estimateSite(snapshot, { configVersion: 1 });
    expect(result.annualized).toBeNull();
  });

  it("blends first and return visits by the returning-visitor ratio", () => {
    const cfg: WattprintConfig = {
      configVersion: 1,
      traffic: { returningVisitorRatio: 0.4 },
    };
    const snap: Snapshot = {
      routes: [{ route: "/", transferBytes: 1_000_000, warmTransferBytes: 100_000 }],
    };
    const result = estimateSite(snap, cfg);
    const first = 1_000_000 * GRAMS_PER_BYTE;
    const returning = 100_000 * GRAMS_PER_BYTE;
    expect(result.routes[0]?.gramsPerPageview).toBeCloseTo(0.6 * first + 0.4 * returning, 9);
  });

  it("assumes no cache benefit when warm bytes are unmeasured", () => {
    const cfg: WattprintConfig = {
      configVersion: 1,
      traffic: { returningVisitorRatio: 0.4 },
    };
    const snap: Snapshot = { routes: [{ route: "/", transferBytes: 1_000_000 }] };
    const result = estimateSite(snap, cfg);
    expect(result.routes[0]?.gramsPerPageview).toBeCloseTo(1_000_000 * GRAMS_PER_BYTE, 9);
  });

  it("labels every result a modeled estimate with model + coefficient versions", () => {
    const result = estimateSite(snapshot, config);
    expect(result.disclaimer).toBe(DISCLAIMER);
    expect(result.model).toEqual({
      id: "swdm-v4",
      coefficientsVersion: expect.stringMatching(/^swdm-v4\./),
    });
    expect(result.configVersion).toBe(1);
  });

  it("rejects an empty snapshot", () => {
    expect(() => estimateSite({ routes: [] }, config)).toThrow(/no routes/);
  });
});

describe("normalizeWeights", () => {
  it("splits equally when nothing is configured", () => {
    const w = normalizeWeights(["/", "/a", "/b"], {});
    expect([...w.values()]).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("normalizes when all routes are listed", () => {
    const w = normalizeWeights(["/", "/a"], { "/": 3, "/a": 1 });
    expect(w.get("/")).toBeCloseTo(0.75);
    expect(w.get("/a")).toBeCloseTo(0.25);
  });

  it("gives unlisted routes the remaining share", () => {
    const w = normalizeWeights(["/", "/a", "/b"], { "/": 0.5 });
    expect(w.get("/")).toBeCloseTo(0.5);
    expect(w.get("/a")).toBeCloseTo(0.25);
    expect(w.get("/b")).toBeCloseTo(0.25);
  });

  it("scales down oversubscribed weights, leaving nothing for unlisted routes", () => {
    const w = normalizeWeights(["/", "/a", "/b"], { "/": 2, "/a": 2 });
    expect(w.get("/")).toBeCloseTo(0.5);
    expect(w.get("/a")).toBeCloseTo(0.5);
    expect(w.get("/b")).toBe(0);
  });

  it("ignores weights for routes that were not measured", () => {
    const w = normalizeWeights(["/"], { "/gone": 5 });
    expect(w.get("/")).toBe(1);
  });
});
