import { modelOptionsFromConfig, type WattprintConfig } from "./config.js";
import { getModel, type EstimationModel } from "./model.js";
import type { Snapshot } from "./types.js";

export const DISCLAIMER =
  "Modeled estimate, not a measurement. Figures follow the named methodology and coefficient version and are only comparable to results produced with the same model + coefficient versions.";

export interface RouteEstimate {
  route: string;
  /** Normalized traffic weight used for the site average. */
  weight: number;
  transferBytes: number;
  warmTransferBytes: number | null;
  gramsFirstVisit: number;
  /**
   * Modeled grams for a returning visit. Falls back to the first-visit
   * figure when no warm-cache measurement exists (no cache benefit assumed).
   */
  gramsReturnVisit: number;
  /** First/return blend by the configured returning-visitor ratio. */
  gramsPerPageview: number;
  /** First-visit wire transfer in KB (1000 bytes), for transfer budgets. */
  kbPerPageview: number;
}

export interface SiteEstimate {
  kind: "wattprint-estimate";
  disclaimer: string;
  model: { id: string; coefficientsVersion: string };
  configVersion: number;
  capturedAt: string | null;
  routes: RouteEstimate[];
  /** Traffic-weighted site average, g CO2e per pageview. */
  siteGramsPerPageview: number;
  siteKbPerPageview: number;
  /** Traffic-dependent projection; null when pageviewsPerMonth is not configured. */
  annualized: { pageviewsPerMonth: number; kgCO2ePerYear: number } | null;
}

export function estimateSite(
  snapshot: Snapshot,
  config: WattprintConfig,
  model?: EstimationModel,
): SiteEstimate {
  if (snapshot.routes.length === 0) {
    throw new Error("snapshot contains no routes");
  }
  const activeModel = model ?? getModel(config.model ?? "swdm-v4");
  const options = modelOptionsFromConfig(config);
  const returningRatio = config.traffic?.returningVisitorRatio ?? 0;
  const weights = normalizeWeights(
    snapshot.routes.map((r) => r.route),
    config.traffic?.routeWeights ?? {},
  );

  const routes: RouteEstimate[] = snapshot.routes.map((m) => {
    const gramsFirstVisit = activeModel.gramsPerView(m.transferBytes, options);
    const warm = m.warmTransferBytes;
    const gramsReturnVisit =
      warm === undefined ? gramsFirstVisit : activeModel.gramsPerView(warm, options);
    const gramsPerPageview =
      gramsFirstVisit * (1 - returningRatio) + gramsReturnVisit * returningRatio;
    return {
      route: m.route,
      weight: weights.get(m.route) ?? 0,
      transferBytes: m.transferBytes,
      warmTransferBytes: warm ?? null,
      gramsFirstVisit,
      gramsReturnVisit,
      gramsPerPageview,
      kbPerPageview: m.transferBytes / 1000,
    };
  });

  const siteGramsPerPageview = routes.reduce((sum, r) => sum + r.gramsPerPageview * r.weight, 0);
  const siteKbPerPageview = routes.reduce((sum, r) => sum + r.kbPerPageview * r.weight, 0);
  const pageviewsPerMonth = config.traffic?.pageviewsPerMonth;

  return {
    kind: "wattprint-estimate",
    disclaimer: DISCLAIMER,
    model: { id: activeModel.id, coefficientsVersion: activeModel.coefficientsVersion },
    configVersion: config.configVersion,
    capturedAt: snapshot.capturedAt ?? null,
    routes,
    siteGramsPerPageview,
    siteKbPerPageview,
    annualized:
      pageviewsPerMonth === undefined
        ? null
        : {
            pageviewsPerMonth,
            kgCO2ePerYear: (siteGramsPerPageview * pageviewsPerMonth * 12) / 1000,
          },
  };
}

/**
 * Configured weights are relative shares over the measured routes. Routes
 * without a configured weight split the remaining share equally; if the
 * configured weights already cover everything, they are simply normalized.
 */
export function normalizeWeights(
  routes: string[],
  configured: Record<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const listed = routes.filter((r) => configured[r] !== undefined);
  const unlisted = routes.filter((r) => configured[r] === undefined);
  const listedSum = listed.reduce((sum, r) => sum + (configured[r] ?? 0), 0);

  if (listed.length === 0 || listedSum === 0) {
    for (const r of routes) result.set(r, 1 / routes.length);
    return result;
  }
  if (unlisted.length === 0) {
    for (const r of listed) result.set(r, (configured[r] ?? 0) / listedSum);
    return result;
  }
  // Mixed case: configured weights are absolute shares; the remainder is
  // split across unlisted routes. Weights summing past 1 are scaled down
  // and unlisted routes get nothing.
  const scale = listedSum > 1 ? 1 / listedSum : 1;
  for (const r of listed) result.set(r, (configured[r] ?? 0) * scale);
  const perUnlisted = listedSum >= 1 ? 0 : (1 - listedSum) / unlisted.length;
  for (const r of unlisted) result.set(r, perUnlisted);
  return result;
}
