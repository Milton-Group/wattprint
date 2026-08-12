/** Per-segment grid intensity overrides, in g CO2e/kWh. */
export interface GridIntensityOverrides {
  dataCenter?: number;
  network?: number;
  device?: number;
}

export interface ModelOptions {
  gridIntensity?: GridIntensityOverrides;
  /**
   * 0..1 fraction of data-center operational electricity considered
   * green-powered. 1 = verified green hosting.
   */
  greenHostingFactor?: number;
}

export interface SegmentGrams {
  dataCenter: number;
  network: number;
  device: number;
  operational: number;
  embodied: number;
  total: number;
}

/**
 * A carbon-estimation methodology. Implementations must be pure: same
 * inputs, same outputs, with every coefficient sourced from a versioned
 * data file so results are reproducible and auditable.
 */
export interface EstimationModel {
  readonly id: string;
  readonly coefficientsVersion: string;
  /** Modeled g CO2e for transferring `bytes` over the wire, one view. */
  gramsPerView(bytes: number, options?: ModelOptions): number;
  /** Same estimate broken down by system segment. */
  segments(bytes: number, options?: ModelOptions): SegmentGrams;
}

const registry = new Map<string, () => EstimationModel>();

export function registerModel(id: string, factory: () => EstimationModel): void {
  registry.set(id, factory);
}

export function getModel(id: string): EstimationModel {
  const factory = registry.get(id);
  if (!factory) {
    throw new Error(
      `Unknown estimation model "${id}". Registered models: ${[...registry.keys()].join(", ") || "(none)"}`,
    );
  }
  return factory();
}
