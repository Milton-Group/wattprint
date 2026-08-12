import type { AssetType, RouteMeasurement, Snapshot } from "@wattprint/core";
import { chromium, type Browser, type Page } from "playwright";
import { serveStatic } from "./server.js";

export interface AssetRecord {
  url: string;
  type: AssetType;
  /** Encoded (wire) bytes for body + an estimate is NOT included for headers. */
  transferBytes: number;
  contentEncoding: string | null;
  cacheControl: string | null;
  thirdParty: boolean;
}

export interface MeasuredRoute extends RouteMeasurement {
  /** Cold-pass assets, largest first. */
  assets: AssetRecord[];
}

export interface MeasureSnapshot extends Snapshot {
  routes: MeasuredRoute[];
}

export interface MeasureOptions {
  routes?: string[];
  /** Repetitions per route; the median-by-transfer run is kept. Default 3. */
  runs?: number;
  viewport?: { width: number; height: number };
  /** Also measure a warm-cache (returning visitor) pass. Default true. */
  warmPass?: boolean;
  /** Extra settle time after network idle, ms. Default 250. */
  settleMs?: number;
  /** Override the Chromium executable (e.g. a preinstalled browser). */
  executablePath?: string;
}

const DEFAULTS: Required<Omit<MeasureOptions, "executablePath">> = {
  routes: ["/"],
  runs: 3,
  viewport: { width: 1366, height: 768 },
  warmPass: true,
  settleMs: 250,
};

/** Measure one or more routes of a deployed or locally served site. */
export async function measureUrl(
  baseUrl: string,
  options: MeasureOptions = {},
): Promise<MeasureSnapshot> {
  const opts = { ...DEFAULTS, ...options };
  // WATTPRINT_CHROMIUM lets environments with a preinstalled browser avoid a
  // Playwright browser download; an explicit option still wins.
  const executablePath = opts.executablePath ?? process.env["WATTPRINT_CHROMIUM"];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const routes: MeasuredRoute[] = [];
    for (const route of opts.routes) {
      routes.push(await measureRoute(browser, baseUrl, route, opts));
    }
    return {
      capturedAt: new Date().toISOString(),
      tool: "@wattprint/measure@0.1.0",
      routes,
    };
  } finally {
    await browser.close();
  }
}

/** Serve a static build directory on a loopback port and measure it. */
export async function measureDir(
  dir: string,
  options: MeasureOptions = {},
): Promise<MeasureSnapshot> {
  const server = await serveStatic(dir);
  try {
    return await measureUrl(server.url, options);
  } finally {
    await server.close();
  }
}

interface RunResult {
  transferBytes: number;
  warmTransferBytes: number | undefined;
  assets: AssetRecord[];
}

async function measureRoute(
  browser: Browser,
  baseUrl: string,
  route: string,
  opts: Required<Omit<MeasureOptions, "executablePath">>,
): Promise<MeasuredRoute> {
  const url = new URL(route, baseUrl).toString();
  const pageHost = new URL(url).hostname;
  const runs: RunResult[] = [];

  for (let i = 0; i < opts.runs; i++) {
    // A fresh context per run gives an empty cache: the cold pass.
    const context = await browser.newContext({ viewport: opts.viewport });
    const page = await context.newPage();
    try {
      const coldAssets = await collectPass(page, url, pageHost, opts.settleMs);
      let warmBytes: number | undefined;
      if (opts.warmPass) {
        // Second navigation in the same context reuses the HTTP cache.
        const warmAssets = await collectPass(page, url, pageHost, opts.settleMs);
        warmBytes = totalBytes(warmAssets);
      }
      runs.push({
        transferBytes: totalBytes(coldAssets),
        warmTransferBytes: warmBytes,
        assets: coldAssets,
      });
    } finally {
      await context.close();
    }
  }

  const median = pickMedianRun(runs);
  const assets = [...median.assets].sort((a, b) => b.transferBytes - a.transferBytes);
  const bytesByType: Partial<Record<AssetType, number>> = {};
  for (const a of assets) {
    bytesByType[a.type] = (bytesByType[a.type] ?? 0) + a.transferBytes;
  }
  const thirdPartyAssets = assets.filter((a) => a.thirdParty);

  const measured: MeasuredRoute = {
    route,
    transferBytes: median.transferBytes,
    bytesByType,
    requests: assets.length,
    thirdParty: {
      bytes: totalBytes(thirdPartyAssets),
      requests: thirdPartyAssets.length,
    },
    assets,
  };
  if (median.warmTransferBytes !== undefined) {
    measured.warmTransferBytes = median.warmTransferBytes;
  }
  return measured;
}

async function collectPass(
  page: Page,
  url: string,
  pageHost: string,
  settleMs: number,
): Promise<AssetRecord[]> {
  const assets: AssetRecord[] = [];
  const pending: Promise<void>[] = [];

  const onRequestFinished = (request: import("playwright").Request) => {
    pending.push(
      (async () => {
        const response = await request.response();
        if (!response) return;
        const sizes = await request.sizes();
        const transfer = Math.max(0, sizes.responseBodySize) + Math.max(0, sizes.responseHeadersSize);
        const headers = response.headers();
        const requestUrl = request.url();
        assets.push({
          url: requestUrl,
          type: classify(request.resourceType(), requestUrl, headers["content-type"] ?? ""),
          transferBytes: transfer,
          contentEncoding: headers["content-encoding"] ?? null,
          cacheControl: headers["cache-control"] ?? null,
          thirdParty: hostnameOf(requestUrl) !== pageHost,
        });
      })().catch(() => {}),
    );
  };

  page.on("requestfinished", onRequestFinished);
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(settleMs);
    await Promise.all(pending);
  } finally {
    page.off("requestfinished", onRequestFinished);
  }
  return assets;
}

function classify(resourceType: string, url: string, contentType: string): AssetType {
  if (resourceType === "document") return "html";
  if (resourceType === "script") return "js";
  if (resourceType === "stylesheet") return "css";
  if (resourceType === "image") return "image";
  if (resourceType === "font") return "font";
  if (resourceType === "media") return "video";
  if (contentType.includes("javascript")) return "js";
  if (contentType.includes("css")) return "css";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("font/")) return "font";
  if (contentType.startsWith("video/") || contentType.startsWith("audio/")) return "video";
  if (contentType.includes("html")) return "html";
  if (/\.(woff2?|ttf|otf)(\?|$)/.test(url)) return "font";
  return "other";
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function totalBytes(assets: AssetRecord[]): number {
  return assets.reduce((sum, a) => sum + a.transferBytes, 0);
}

function pickMedianRun(runs: RunResult[]): RunResult {
  const sorted = [...runs].sort((a, b) => a.transferBytes - b.transferBytes);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  if (!median) throw new Error("no measurement runs completed");
  return median;
}
