export const MARKER = "<!-- wattprint-report -->";

export function formatGrams(g) {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  if (Math.abs(g) >= 0.01 || g === 0) return `${g.toFixed(3)} g`;
  return `${g.toExponential(2)} g`;
}

export function formatBytes(bytes) {
  const abs = Math.abs(bytes);
  if (abs >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (abs >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

function signed(formatted, value) {
  return value > 0 ? `+${formatted}` : formatted;
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Assets present in head but not base (by pathname), largest first.
 */
export function topNewAssets(headScan, baseScan, count = 3) {
  const baseAssets = new Set(
    (baseScan?.snapshot?.routes ?? []).flatMap((r) => (r.assets ?? []).map((a) => pathOf(a.url))),
  );
  const headAssets = (headScan?.snapshot?.routes ?? []).flatMap((r) => r.assets ?? []);
  const fresh = new Map();
  for (const asset of headAssets) {
    const path = pathOf(asset.url);
    if (baseAssets.has(path)) continue;
    fresh.set(path, Math.max(fresh.get(path) ?? 0, asset.transferBytes));
  }
  return [...fresh.entries()]
    .map(([path, transferBytes]) => ({ path, transferBytes }))
    .sort((a, b) => b.transferBytes - a.transferBytes)
    .slice(0, count);
}

/**
 * Render the sticky PR comment. `diff` may be null (no base measurement:
 * first push to a repo, or a non-PR event) — then only the head estimate and
 * budget status are shown.
 */
export function renderComment({ diff, budget, headScan, baseScan }) {
  const estimate = headScan.estimate;
  const lines = [MARKER, "## ⚡ wattprint — modeled carbon impact", ""];
  lines.push(
    `All figures are **modeled estimates** (${estimate.model.id}, coefficients \`${estimate.model.coefficientsVersion}\`), not measurements.`,
  );
  lines.push("");

  for (const warning of diff?.warnings ?? []) {
    lines.push(`> ⚠️ ${warning}`);
    lines.push("");
  }

  if (diff) {
    const delta = diff.deltaSiteGramsPerPageview;
    const arrow = delta > 0 ? "🔺" : delta < 0 ? "🟢" : "⏸";
    lines.push(
      `${arrow} Site: ${formatGrams(diff.base.siteGramsPerPageview)} → ${formatGrams(diff.head.siteGramsPerPageview)} CO2e/pageview (**${signed(formatGrams(delta), delta)}**), transfer ${formatBytes(diff.base.siteKbPerPageview * 1000)} → ${formatBytes(diff.head.siteKbPerPageview * 1000)} per view.`,
    );
    if (diff.deltaAnnualizedKgPerYear !== null) {
      lines.push(
        `Annualized at configured traffic: **${signed(`${diff.deltaAnnualizedKgPerYear.toFixed(1)} kg`, diff.deltaAnnualizedKgPerYear)} CO2e/year** (traffic-dependent).`,
      );
    }
    lines.push("");
    lines.push("| Route | Status | Δ transfer | Δ g CO2e/view |");
    lines.push("| --- | --- | ---: | ---: |");
    for (const route of diff.routes) {
      lines.push(
        `| \`${route.route}\` | ${route.status} | ${signed(formatBytes(route.deltaTransferBytes), route.deltaTransferBytes)} | ${signed(formatGrams(route.deltaGramsPerPageview), route.deltaGramsPerPageview)} |`,
      );
    }
    lines.push("");
  } else {
    lines.push(
      `Site: **${formatGrams(estimate.siteGramsPerPageview)} CO2e/pageview** (no base measurement to diff against).`,
    );
    if (estimate.annualized) {
      lines.push(
        `Annualized at ${estimate.annualized.pageviewsPerMonth.toLocaleString("en-US")} pageviews/month: ${estimate.annualized.kgCO2ePerYear.toFixed(1)} kg CO2e/year (traffic-dependent).`,
      );
    }
    lines.push("");
  }

  if (budget) {
    const failed = budget.checks.filter((c) => !c.ok);
    lines.push(
      budget.breached
        ? `🔴 **Budget breached** — ${failed.length} of ${budget.checks.length} checks failed.`
        : `✅ Within budget (${budget.checks.length} checks).`,
    );
    for (const check of failed) {
      const scope = check.route ?? "site";
      lines.push(
        `- \`${scope}\` ${check.metric}: ${check.actual.toFixed(3)} > limit ${check.limit}`,
      );
    }
    lines.push("");
  }

  const newAssets = topNewAssets(headScan, baseScan);
  if (newAssets.length > 0) {
    lines.push("Largest new assets:");
    for (const asset of newAssets) {
      lines.push(`- \`${asset.path}\` — ${formatBytes(asset.transferBytes)}`);
    }
    lines.push("");
  }

  lines.push(
    `<sub>${estimate.disclaimer} Reduced figures mean reduced modeled emissions — never "carbon neutral".</sub>`,
  );
  return lines.join("\n");
}
