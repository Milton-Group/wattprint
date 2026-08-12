import { readFile, stat } from "node:fs/promises";
import { estimateSite, type SiteEstimate, type Snapshot, type WattprintConfig } from "@wattprint/core";
import { measureDir, measureUrl, type MeasureOptions, type MeasureSnapshot } from "@wattprint/measure";

export interface ScanResult {
  kind: "wattprint-scan";
  target: string;
  snapshot: Snapshot;
  estimate: SiteEstimate;
}

/**
 * Resolve a scan target: an http(s) URL, a local build directory, or a saved
 * `scan --json` result / raw snapshot JSON file.
 */
export async function resolveTarget(
  target: string,
  config: WattprintConfig,
  measureOptions: MeasureOptions,
): Promise<ScanResult> {
  const snapshot = await snapshotFor(target, config, measureOptions);
  return {
    kind: "wattprint-scan",
    target,
    snapshot,
    estimate: estimateSite(snapshot, config),
  };
}

async function snapshotFor(
  target: string,
  config: WattprintConfig,
  measureOptions: MeasureOptions,
): Promise<Snapshot> {
  if (/^https?:\/\//.test(target)) {
    return measureUrl(target, withConfigDefaults(config, measureOptions));
  }
  const stats = await stat(target).catch(() => null);
  if (stats?.isDirectory()) {
    return measureDir(target, withConfigDefaults(config, measureOptions));
  }
  if (stats?.isFile()) {
    const parsed = JSON.parse(await readFile(target, "utf8")) as
      | ScanResult
      | MeasureSnapshot
      | Snapshot;
    if ("kind" in parsed && parsed.kind === "wattprint-scan") {
      return parsed.snapshot;
    }
    if ("routes" in parsed && Array.isArray(parsed.routes)) {
      return parsed;
    }
    throw new Error(`${target} is not a wattprint scan result or snapshot`);
  }
  throw new Error(
    `Target "${target}" is neither a URL, an existing directory, nor a snapshot JSON file`,
  );
}

function withConfigDefaults(
  config: WattprintConfig,
  options: MeasureOptions,
): MeasureOptions {
  const merged: MeasureOptions = { ...options };
  if (merged.routes === undefined && config.measure?.routes) {
    merged.routes = config.measure.routes;
  }
  if (merged.runs === undefined && config.measure?.runs !== undefined) {
    merged.runs = config.measure.runs;
  }
  const width = config.measure?.viewport?.width;
  const height = config.measure?.viewport?.height;
  if (merged.viewport === undefined && width !== undefined && height !== undefined) {
    merged.viewport = { width, height };
  }
  return merged;
}
