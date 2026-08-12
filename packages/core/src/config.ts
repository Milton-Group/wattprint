import type { ModelOptions } from "./model.js";

export interface GeoGridIntensityEntry {
  share: number;
  gCO2ePerKwh: number;
}

export interface WattprintConfig {
  configVersion: 1;
  model?: string;
  traffic?: {
    pageviewsPerMonth?: number;
    routeWeights?: Record<string, number>;
    returningVisitorRatio?: number;
    audienceGridIntensity?: number | Record<string, GeoGridIntensityEntry>;
  };
  infra?: {
    hostingProvider?: string;
    regions?: string[];
    hostingGridIntensity?: number;
    greenHostingVerified?: boolean;
    cdnCacheHitRatio?: number;
  };
  budgets?: {
    maxGramsPerPageview?: number;
    maxTransferKbPerPageview?: number;
    perRoute?: Record<
      string,
      { maxGramsPerPageview?: number; maxTransferKbPerPageview?: number }
    >;
    failCiOnBreach?: boolean;
  };
  measure?: {
    routes?: string[];
    runs?: number;
    viewport?: { width?: number; height?: number };
  };
}

export class ConfigError extends Error {}

/**
 * Structural validation with actionable messages. The published JSON Schema
 * (schema/wattprint.config.schema.json) is the canonical definition; this
 * check covers the constraints estimation actually relies on without pulling
 * a schema-validator dependency into a deliberately light package.
 */
export function validateConfig(raw: unknown): WattprintConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ConfigError("config must be a JSON object");
  }
  const cfg = raw as Record<string, unknown>;
  if (cfg["configVersion"] !== 1) {
    throw new ConfigError('config requires "configVersion": 1');
  }
  const traffic = cfg["traffic"] as WattprintConfig["traffic"] | undefined;
  if (traffic) {
    requireRange(traffic.returningVisitorRatio, 0, 1, "traffic.returningVisitorRatio");
    requirePositive(traffic.pageviewsPerMonth, "traffic.pageviewsPerMonth");
    const audience = traffic.audienceGridIntensity;
    if (audience !== undefined && typeof audience !== "number") {
      let shareSum = 0;
      for (const [region, entry] of Object.entries(audience)) {
        requirePositive(entry.gCO2ePerKwh, `traffic.audienceGridIntensity.${region}.gCO2ePerKwh`);
        requireRange(entry.share, 0, 1, `traffic.audienceGridIntensity.${region}.share`);
        shareSum += entry.share;
      }
      if (Math.abs(shareSum - 1) > 0.01) {
        throw new ConfigError(
          `traffic.audienceGridIntensity shares must sum to 1 (got ${shareSum.toFixed(3)})`,
        );
      }
    }
    if (traffic.routeWeights) {
      for (const [route, weight] of Object.entries(traffic.routeWeights)) {
        if (typeof weight !== "number" || weight < 0 || !Number.isFinite(weight)) {
          throw new ConfigError(`traffic.routeWeights["${route}"] must be a non-negative number`);
        }
      }
    }
  }
  const infra = cfg["infra"] as WattprintConfig["infra"] | undefined;
  if (infra) {
    requirePositive(infra.hostingGridIntensity, "infra.hostingGridIntensity");
    requireRange(infra.cdnCacheHitRatio, 0, 1, "infra.cdnCacheHitRatio");
  }
  const budgets = cfg["budgets"] as WattprintConfig["budgets"] | undefined;
  if (budgets) {
    requirePositive(budgets.maxGramsPerPageview, "budgets.maxGramsPerPageview");
    requirePositive(budgets.maxTransferKbPerPageview, "budgets.maxTransferKbPerPageview");
  }
  return cfg as unknown as WattprintConfig;
}

/**
 * Map config to model options. Audience grid intensity applies to the
 * user-device segment (a geo table is collapsed to its share-weighted mean);
 * hosting grid intensity applies to the data-center segment; the network
 * segment keeps the model's global default. `greenHostingVerified` takes
 * precedence over a hosting intensity value.
 */
export function modelOptionsFromConfig(config: WattprintConfig): ModelOptions {
  const options: ModelOptions = {};
  const gridIntensity: ModelOptions["gridIntensity"] = {};

  const audience = config.traffic?.audienceGridIntensity;
  if (typeof audience === "number") {
    gridIntensity.device = audience;
  } else if (audience) {
    let weighted = 0;
    for (const entry of Object.values(audience)) {
      weighted += entry.share * entry.gCO2ePerKwh;
    }
    gridIntensity.device = weighted;
  }

  if (config.infra?.greenHostingVerified) {
    options.greenHostingFactor = 1;
  } else if (config.infra?.hostingGridIntensity !== undefined) {
    gridIntensity.dataCenter = config.infra.hostingGridIntensity;
  }

  if (Object.keys(gridIntensity).length > 0) {
    options.gridIntensity = gridIntensity;
  }
  return options;
}

function requirePositive(value: number | undefined, path: string): void {
  if (value !== undefined && (typeof value !== "number" || value <= 0 || !Number.isFinite(value))) {
    throw new ConfigError(`${path} must be a positive number`);
  }
}

function requireRange(value: number | undefined, min: number, max: number, path: string): void {
  if (
    value !== undefined &&
    (typeof value !== "number" || value < min || value > max || !Number.isFinite(value))
  ) {
    throw new ConfigError(`${path} must be between ${min} and ${max}`);
  }
}
