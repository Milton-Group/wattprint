export type AssetType =
  | "html"
  | "js"
  | "css"
  | "image"
  | "font"
  | "video"
  | "other";

/** Wire-level measurement of a single route, as produced by @wattprint/measure. */
export interface RouteMeasurement {
  /** Route path, e.g. "/" or "/pricing". */
  route: string;
  /** Cold-cache (first visit) wire bytes transferred. */
  transferBytes: number;
  /** Warm-cache (returning visit) wire bytes, when a warm pass was measured. */
  warmTransferBytes?: number;
  /** Cold-cache wire bytes broken down by asset type. */
  bytesByType?: Partial<Record<AssetType, number>>;
  /** Number of network requests on the cold pass. */
  requests?: number;
  /** Bytes and requests served from origins other than the page's. */
  thirdParty?: { bytes: number; requests: number };
}

/** A set of route measurements captured at one point in time. */
export interface Snapshot {
  /** ISO-8601 capture time. */
  capturedAt?: string;
  /** Tool that produced the snapshot, e.g. "@wattprint/measure@0.1.0". */
  tool?: string;
  routes: RouteMeasurement[];
}
