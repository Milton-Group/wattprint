/**
 * Carbon-aware scheduling for deferrable work (CI, cron, batch jobs).
 *
 * v1 ships the provider interface and a static-data provider. Live providers
 * (Electricity Maps, WattTime, UK Carbon Intensity) are follow-ups that
 * implement the same interface.
 */

export interface IntensityForecastPoint {
  /** Start of the interval this intensity applies to. */
  start: Date;
  /** End of the interval (exclusive). */
  end: Date;
  /** Forecast grid intensity in g CO2e/kWh. */
  gCO2ePerKwh: number;
}

/**
 * A source of grid carbon-intensity forecasts for a zone. Implementations
 * must return points covering [from, to] as far as their data allows, sorted
 * by start time, non-overlapping.
 */
export interface GridIntensityProvider {
  readonly id: string;
  /** e.g. "SG", "GB-London", provider-specific zone key. */
  forecast(zone: string, from: Date, to: Date): Promise<IntensityForecastPoint[]>;
}

export interface LowCarbonWindow {
  start: Date;
  end: Date;
  /** Mean forecast intensity over the window, g CO2e/kWh. */
  meanGCO2ePerKwh: number;
  provider: string;
}

/**
 * Find the lowest-mean-intensity start time for a job of `durationMinutes`
 * beginning no earlier than `notBefore` and finishing no later than
 * `deadline`. Returns null when the provider has no forecast covering any
 * candidate window (never guess: an honest "don't know" beats a made-up
 * green slot).
 */
export async function lowestCarbonWindow(
  provider: GridIntensityProvider,
  zone: string,
  durationMinutes: number,
  notBefore: Date,
  deadline: Date,
): Promise<LowCarbonWindow | null> {
  if (durationMinutes <= 0) throw new Error("durationMinutes must be positive");
  const durationMs = durationMinutes * 60_000;
  if (notBefore.getTime() + durationMs > deadline.getTime()) {
    throw new Error("job cannot finish before the deadline");
  }
  const points = await provider.forecast(zone, notBefore, deadline);
  if (points.length === 0) return null;

  let best: LowCarbonWindow | null = null;
  // Candidate starts: notBefore plus each forecast boundary inside the range.
  const candidates = [
    notBefore.getTime(),
    ...points.map((p) => p.start.getTime()).filter((t) => t > notBefore.getTime()),
  ];
  for (const startMs of candidates) {
    const endMs = startMs + durationMs;
    if (endMs > deadline.getTime()) continue;
    const mean = meanIntensity(points, startMs, endMs);
    if (mean === null) continue;
    if (best === null || mean < best.meanGCO2ePerKwh) {
      best = {
        start: new Date(startMs),
        end: new Date(endMs),
        meanGCO2ePerKwh: mean,
        provider: provider.id,
      };
    }
  }
  return best;
}

/** Time-weighted mean over [startMs, endMs); null unless fully covered. */
function meanIntensity(
  points: IntensityForecastPoint[],
  startMs: number,
  endMs: number,
): number | null {
  let covered = 0;
  let weighted = 0;
  for (const point of points) {
    const overlapStart = Math.max(startMs, point.start.getTime());
    const overlapEnd = Math.min(endMs, point.end.getTime());
    if (overlapEnd <= overlapStart) continue;
    const ms = overlapEnd - overlapStart;
    covered += ms;
    weighted += ms * point.gCO2ePerKwh;
  }
  if (covered < endMs - startMs) return null;
  return weighted / covered;
}

export interface StaticProviderData {
  /** Hour-of-day (0-23, in the given UTC offset) -> g CO2e/kWh. */
  hourly: Record<string, number[]>;
  utcOffsetHours?: number;
}

/**
 * A deterministic provider backed by static per-zone hourly curves — the
 * fallback when no live forecast API is configured. Static curves capture
 * typical daily solar/demand shape, not actual conditions; treat results as
 * a heuristic, not a forecast.
 */
export class StaticIntensityProvider implements GridIntensityProvider {
  readonly id = "static-table";
  #data: StaticProviderData;

  constructor(data: StaticProviderData) {
    for (const [zone, hours] of Object.entries(data.hourly)) {
      if (hours.length !== 24) {
        throw new Error(`zone ${zone}: expected 24 hourly values, got ${hours.length}`);
      }
    }
    this.#data = data;
  }

  forecast(zone: string, from: Date, to: Date): Promise<IntensityForecastPoint[]> {
    const hours = this.#data.hourly[zone];
    if (!hours) {
      return Promise.resolve([]);
    }
    const offsetMs = (this.#data.utcOffsetHours ?? 0) * 3_600_000;
    const points: IntensityForecastPoint[] = [];
    let cursor = Math.floor((from.getTime() + offsetMs) / 3_600_000) * 3_600_000 - offsetMs;
    while (cursor < to.getTime()) {
      const localHour = new Date(cursor + offsetMs).getUTCHours();
      points.push({
        start: new Date(Math.max(cursor, from.getTime())),
        end: new Date(Math.min(cursor + 3_600_000, to.getTime())),
        gCO2ePerKwh: hours[localHour] ?? 0,
      });
      cursor += 3_600_000;
    }
    return Promise.resolve(points);
  }
}
