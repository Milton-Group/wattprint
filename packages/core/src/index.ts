import { registerModel } from "./model.js";
import { SwdmV4 } from "./models/swdm-v4.js";

registerModel("swdm-v4", () => new SwdmV4());

export type { AssetType, RouteMeasurement, Snapshot } from "./types.js";
export type {
  EstimationModel,
  GridIntensityOverrides,
  ModelOptions,
  SegmentGrams,
} from "./model.js";
export { getModel, registerModel } from "./model.js";
export { SwdmV4 } from "./models/swdm-v4.js";
export {
  ConfigError,
  modelOptionsFromConfig,
  validateConfig,
  type GeoGridIntensityEntry,
  type WattprintConfig,
} from "./config.js";
export {
  DISCLAIMER,
  estimateSite,
  normalizeWeights,
  type RouteEstimate,
  type SiteEstimate,
} from "./estimate.js";
export {
  diffEstimates,
  type EstimateDiff,
  type RouteDelta,
  type RouteDeltaStatus,
} from "./diff.js";
export {
  evaluateBudgets,
  type BudgetCheck,
  type BudgetReport,
} from "./budgets.js";
