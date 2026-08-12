import { describe, expect, it } from "vitest";
import {
  diffEstimates,
  estimateSite,
  evaluateBudgets,
  type SiteEstimate,
  type Snapshot,
  type WattprintConfig,
} from "../src/index.js";

const config: WattprintConfig = {
  configVersion: 1,
  traffic: { pageviewsPerMonth: 50_000 },
};

function estimate(routes: Snapshot["routes"], cfg: WattprintConfig = config): SiteEstimate {
  return estimateSite({ routes }, cfg);
}

describe("diffEstimates", () => {
  it("classifies added, removed, changed, and unchanged routes", () => {
    const base = estimate([
      { route: "/", transferBytes: 1_000_000 },
      { route: "/old", transferBytes: 400_000 },
      { route: "/same", transferBytes: 200_000 },
    ]);
    const head = estimate([
      { route: "/", transferBytes: 1_500_000 },
      { route: "/new", transferBytes: 300_000 },
      { route: "/same", transferBytes: 200_000 },
    ]);
    const diff = diffEstimates(base, head);
    const byRoute = new Map(diff.routes.map((r) => [r.route, r.status]));
    expect(byRoute.get("/")).toBe("changed");
    expect(byRoute.get("/old")).toBe("removed");
    expect(byRoute.get("/new")).toBe("added");
    expect(byRoute.get("/same")).toBe("unchanged");
  });

  it("computes site and per-route deltas", () => {
    const base = estimate([{ route: "/", transferBytes: 1_000_000 }]);
    const head = estimate([{ route: "/", transferBytes: 1_500_000 }]);
    const diff = diffEstimates(base, head);
    expect(diff.deltaSiteGramsPerPageview).toBeCloseTo(500_000 * (148.2 / 1e9), 9);
    expect(diff.routes[0]?.deltaTransferBytes).toBe(500_000);
    expect(diff.deltaAnnualizedKgPerYear).toBeCloseTo(
      (diff.deltaSiteGramsPerPageview * 50_000 * 12) / 1000,
      9,
    );
    expect(diff.warnings).toEqual([]);
  });

  it("warns when coefficient versions differ", () => {
    const base = estimate([{ route: "/", transferBytes: 1_000_000 }]);
    const head = estimate([{ route: "/", transferBytes: 1_000_000 }]);
    const stale = {
      ...base,
      model: { ...base.model, coefficientsVersion: "swdm-v4.legacy" },
    };
    const diff = diffEstimates(stale, head);
    expect(diff.warnings.some((w) => w.includes("not comparable"))).toBe(true);
  });

  it("nulls the annualized delta when either side lacks traffic volume", () => {
    const base = estimate([{ route: "/", transferBytes: 1_000_000 }], { configVersion: 1 });
    const head = estimate([{ route: "/", transferBytes: 2_000_000 }]);
    expect(diffEstimates(base, head).deltaAnnualizedKgPerYear).toBeNull();
  });
});

describe("evaluateBudgets", () => {
  const routes: Snapshot["routes"] = [
    { route: "/", transferBytes: 2_000_000 },
    { route: "/light", transferBytes: 100_000 },
  ];

  it("passes under generous limits", () => {
    const cfg: WattprintConfig = {
      ...config,
      budgets: { maxGramsPerPageview: 10, maxTransferKbPerPageview: 10_000 },
    };
    const report = evaluateBudgets(estimate(routes, cfg), cfg);
    expect(report.breached).toBe(false);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it("flags site and route breaches", () => {
    const cfg: WattprintConfig = {
      ...config,
      budgets: { maxTransferKbPerPageview: 500, failCiOnBreach: true },
    };
    const report = evaluateBudgets(estimate(routes, cfg), cfg);
    expect(report.breached).toBe(true);
    expect(report.failCiOnBreach).toBe(true);
    const heavyRoute = report.checks.find((c) => c.route === "/");
    expect(heavyRoute?.ok).toBe(false);
    const lightRoute = report.checks.find((c) => c.route === "/light");
    expect(lightRoute?.ok).toBe(true);
  });

  it("applies per-route overrides over site limits", () => {
    const cfg: WattprintConfig = {
      ...config,
      budgets: {
        maxTransferKbPerPageview: 500,
        perRoute: { "/": { maxTransferKbPerPageview: 3000 } },
      },
    };
    const report = evaluateBudgets(estimate(routes, cfg), cfg);
    const heavyRoute = report.checks.find((c) => c.route === "/");
    expect(heavyRoute?.ok).toBe(true);
    const site = report.checks.find((c) => c.scope === "site");
    expect(site?.ok).toBe(false);
  });

  it("produces no checks without configured budgets", () => {
    const report = evaluateBudgets(estimate(routes), config);
    expect(report.checks).toEqual([]);
    expect(report.breached).toBe(false);
  });
});
