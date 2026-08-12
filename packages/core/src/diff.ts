import { DISCLAIMER, type RouteEstimate, type SiteEstimate } from "./estimate.js";

export type RouteDeltaStatus = "added" | "removed" | "changed" | "unchanged";

export interface RouteDelta {
  route: string;
  status: RouteDeltaStatus;
  base: RouteEstimate | null;
  head: RouteEstimate | null;
  /** head - base, g CO2e per pageview (missing side treated as 0). */
  deltaGramsPerPageview: number;
  /** head - base, first-visit wire bytes. */
  deltaTransferBytes: number;
}

export interface EstimateDiff {
  kind: "wattprint-diff";
  disclaimer: string;
  model: SiteEstimate["model"];
  /** Populated when the two estimates are not directly comparable. */
  warnings: string[];
  routes: RouteDelta[];
  base: { siteGramsPerPageview: number; siteKbPerPageview: number };
  head: { siteGramsPerPageview: number; siteKbPerPageview: number };
  deltaSiteGramsPerPageview: number;
  deltaSiteKbPerPageview: number;
  /** null unless both sides carry annualized figures. */
  deltaAnnualizedKgPerYear: number | null;
}

const GRAMS_EPSILON = 1e-9;

export function diffEstimates(base: SiteEstimate, head: SiteEstimate): EstimateDiff {
  const warnings: string[] = [];
  if (base.model.id !== head.model.id) {
    warnings.push(
      `Estimates use different models (${base.model.id} vs ${head.model.id}); the delta is not meaningful.`,
    );
  } else if (base.model.coefficientsVersion !== head.model.coefficientsVersion) {
    warnings.push(
      `Coefficient versions differ (${base.model.coefficientsVersion} vs ${head.model.coefficientsVersion}); trend lines across coefficient updates are not comparable.`,
    );
  }
  if (base.configVersion !== head.configVersion) {
    warnings.push(
      `Config versions differ (${base.configVersion} vs ${head.configVersion}).`,
    );
  }

  const baseRoutes = new Map(base.routes.map((r) => [r.route, r]));
  const headRoutes = new Map(head.routes.map((r) => [r.route, r]));
  const allRoutes = [...new Set([...baseRoutes.keys(), ...headRoutes.keys()])].sort();

  const routes: RouteDelta[] = allRoutes.map((route) => {
    const b = baseRoutes.get(route) ?? null;
    const h = headRoutes.get(route) ?? null;
    const deltaGrams = (h?.gramsPerPageview ?? 0) - (b?.gramsPerPageview ?? 0);
    const status: RouteDeltaStatus =
      b === null
        ? "added"
        : h === null
          ? "removed"
          : Math.abs(deltaGrams) < GRAMS_EPSILON && h.transferBytes === b.transferBytes
            ? "unchanged"
            : "changed";
    return {
      route,
      status,
      base: b,
      head: h,
      deltaGramsPerPageview: deltaGrams,
      deltaTransferBytes: (h?.transferBytes ?? 0) - (b?.transferBytes ?? 0),
    };
  });

  const deltaAnnualized =
    base.annualized && head.annualized
      ? head.annualized.kgCO2ePerYear - base.annualized.kgCO2ePerYear
      : null;

  return {
    kind: "wattprint-diff",
    disclaimer: DISCLAIMER,
    model: head.model,
    warnings,
    routes,
    base: {
      siteGramsPerPageview: base.siteGramsPerPageview,
      siteKbPerPageview: base.siteKbPerPageview,
    },
    head: {
      siteGramsPerPageview: head.siteGramsPerPageview,
      siteKbPerPageview: head.siteKbPerPageview,
    },
    deltaSiteGramsPerPageview: head.siteGramsPerPageview - base.siteGramsPerPageview,
    deltaSiteKbPerPageview: head.siteKbPerPageview - base.siteKbPerPageview,
    deltaAnnualizedKgPerYear: deltaAnnualized,
  };
}
