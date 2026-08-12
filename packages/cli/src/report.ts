import type { BudgetReport, EstimateDiff, SiteEstimate } from "@wattprint/core";
import type { MeasuredRoute } from "@wattprint/measure";
import type { ScanResult } from "./target.js";

export function formatGrams(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  if (Math.abs(g) >= 0.01 || g === 0) return `${g.toFixed(3)} g`;
  return `${g.toExponential(2)} g`;
}

export function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (abs >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function signed(formatted: string, value: number): string {
  return value > 0 ? `+${formatted}` : formatted;
}

export function table(rows: string[][]): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === 0 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
        .join("  "),
    )
    .join("\n");
}

function modelLine(estimate: SiteEstimate): string {
  return `Model: ${estimate.model.id} (coefficients ${estimate.model.coefficientsVersion}) — modeled estimate, not a measurement.`;
}

export function renderScan(result: ScanResult): string {
  const { estimate } = result;
  const lines: string[] = [];
  lines.push(`wattprint scan — ${result.target}`);
  lines.push(modelLine(estimate));
  lines.push("");
  const rows: string[][] = [["route", "transfer", "warm", "g CO2e/view"]];
  for (const route of estimate.routes) {
    rows.push([
      route.route,
      formatBytes(route.transferBytes),
      route.warmTransferBytes === null ? "-" : formatBytes(route.warmTransferBytes),
      formatGrams(route.gramsPerPageview),
    ]);
  }
  lines.push(table(rows));
  lines.push("");
  lines.push(
    `Site (traffic-weighted): ${formatGrams(estimate.siteGramsPerPageview)} CO2e/pageview, ${formatBytes(estimate.siteKbPerPageview * 1000)} transfer/view`,
  );
  if (estimate.annualized) {
    lines.push(
      `Annualized at ${estimate.annualized.pageviewsPerMonth.toLocaleString("en-US")} pageviews/month: ${estimate.annualized.kgCO2ePerYear.toFixed(1)} kg CO2e/year (traffic-dependent)`,
    );
  }
  const heaviest = heaviestAssets(result, 3);
  if (heaviest.length > 0) {
    lines.push("");
    lines.push("Largest assets:");
    lines.push(
      table(heaviest.map((a) => [`  ${a.url}`, formatBytes(a.transferBytes)])),
    );
  }
  return lines.join("\n");
}

function heaviestAssets(
  result: ScanResult,
  count: number,
): { url: string; transferBytes: number }[] {
  const routes = result.snapshot.routes as MeasuredRoute[];
  const assets = routes.flatMap((r) => r.assets ?? []);
  return assets
    .sort((a, b) => b.transferBytes - a.transferBytes)
    .slice(0, count)
    .map((a) => ({ url: shortUrl(a.url), transferBytes: a.transferBytes }));
}

function shortUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function renderDiff(diff: EstimateDiff): string {
  const lines: string[] = [];
  lines.push("wattprint diff");
  lines.push(
    `Model: ${diff.model.id} (coefficients ${diff.model.coefficientsVersion}) — modeled estimates, not measurements.`,
  );
  for (const warning of diff.warnings) {
    lines.push(`WARNING: ${warning}`);
  }
  lines.push("");
  const rows: string[][] = [["route", "", "Δ transfer", "Δ g CO2e/view"]];
  for (const route of diff.routes) {
    rows.push([
      route.route,
      route.status,
      signed(formatBytes(route.deltaTransferBytes), route.deltaTransferBytes),
      signed(formatGrams(route.deltaGramsPerPageview), route.deltaGramsPerPageview),
    ]);
  }
  lines.push(table(rows));
  lines.push("");
  lines.push(
    `Site: ${formatGrams(diff.base.siteGramsPerPageview)} → ${formatGrams(diff.head.siteGramsPerPageview)} CO2e/pageview (${signed(formatGrams(diff.deltaSiteGramsPerPageview), diff.deltaSiteGramsPerPageview)})`,
  );
  if (diff.deltaAnnualizedKgPerYear !== null) {
    lines.push(
      `Annualized: ${signed(`${diff.deltaAnnualizedKgPerYear.toFixed(1)} kg`, diff.deltaAnnualizedKgPerYear)} CO2e/year at configured traffic (traffic-dependent)`,
    );
  }
  return lines.join("\n");
}

export function renderBudget(report: BudgetReport, estimate: SiteEstimate): string {
  const lines: string[] = [];
  lines.push("wattprint budget");
  lines.push(modelLine(estimate));
  lines.push("");
  if (report.checks.length === 0) {
    lines.push("No budgets configured. Add a \"budgets\" section to wattprint.config.json.");
    return lines.join("\n");
  }
  const rows: string[][] = [["scope", "metric", "limit", "actual", ""]];
  for (const check of report.checks) {
    const limit =
      check.metric === "gramsPerPageview"
        ? formatGrams(check.limit)
        : formatBytes(check.limit * 1000);
    const actual =
      check.metric === "gramsPerPageview"
        ? formatGrams(check.actual)
        : formatBytes(check.actual * 1000);
    rows.push([
      check.route ?? "site",
      check.metric,
      limit,
      actual,
      check.ok ? "PASS" : "FAIL",
    ]);
  }
  lines.push(table(rows));
  lines.push("");
  lines.push(report.breached ? "Budget breached." : "All budgets met.");
  return lines.join("\n");
}
