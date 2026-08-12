import type { WattprintConfig } from "./config.js";
import type { SiteEstimate } from "./estimate.js";

export interface BudgetCheck {
  scope: "site" | "route";
  route: string | null;
  metric: "gramsPerPageview" | "transferKbPerPageview";
  limit: number;
  actual: number;
  ok: boolean;
}

export interface BudgetReport {
  kind: "wattprint-budget";
  checks: BudgetCheck[];
  breached: boolean;
  /** Whether a breach should fail CI, per config. */
  failCiOnBreach: boolean;
}

export function evaluateBudgets(
  estimate: SiteEstimate,
  config: WattprintConfig,
): BudgetReport {
  const budgets = config.budgets ?? {};
  const checks: BudgetCheck[] = [];

  if (budgets.maxGramsPerPageview !== undefined) {
    checks.push(check("site", null, "gramsPerPageview", budgets.maxGramsPerPageview, estimate.siteGramsPerPageview));
  }
  if (budgets.maxTransferKbPerPageview !== undefined) {
    checks.push(check("site", null, "transferKbPerPageview", budgets.maxTransferKbPerPageview, estimate.siteKbPerPageview));
  }

  for (const route of estimate.routes) {
    const override = budgets.perRoute?.[route.route];
    const gramsLimit = override?.maxGramsPerPageview ?? budgets.maxGramsPerPageview;
    const kbLimit = override?.maxTransferKbPerPageview ?? budgets.maxTransferKbPerPageview;
    if (gramsLimit !== undefined) {
      checks.push(check("route", route.route, "gramsPerPageview", gramsLimit, route.gramsPerPageview));
    }
    if (kbLimit !== undefined) {
      checks.push(check("route", route.route, "transferKbPerPageview", kbLimit, route.kbPerPageview));
    }
  }

  return {
    kind: "wattprint-budget",
    checks,
    breached: checks.some((c) => !c.ok),
    failCiOnBreach: budgets.failCiOnBreach ?? false,
  };
}

function check(
  scope: BudgetCheck["scope"],
  route: string | null,
  metric: BudgetCheck["metric"],
  limit: number,
  actual: number,
): BudgetCheck {
  return { scope, route, metric, limit, actual, ok: actual <= limit };
}
