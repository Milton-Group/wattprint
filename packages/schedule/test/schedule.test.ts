import { describe, expect, it } from "vitest";
import {
  lowestCarbonWindow,
  StaticIntensityProvider,
  type GridIntensityProvider,
} from "../src/index.js";

// Solar-shaped curve: cleanest 11:00-15:00, dirtiest overnight.
const curve = [
  520, 530, 540, 545, 540, 520, 480, 430, 380, 330, 290, 260,
  250, 255, 270, 310, 360, 420, 470, 500, 510, 515, 520, 520,
];

const provider = new StaticIntensityProvider({ hourly: { TEST: curve } });

describe("StaticIntensityProvider", () => {
  it("returns hourly points clipped to the requested range", async () => {
    const from = new Date("2026-08-12T10:30:00Z");
    const to = new Date("2026-08-12T12:30:00Z");
    const points = await provider.forecast("TEST", from, to);
    expect(points).toHaveLength(3);
    expect(points[0]?.start.toISOString()).toBe("2026-08-12T10:30:00.000Z");
    expect(points[0]?.gCO2ePerKwh).toBe(290);
    expect(points[2]?.end.toISOString()).toBe("2026-08-12T12:30:00.000Z");
  });

  it("returns nothing for unknown zones", async () => {
    const points = await provider.forecast("NOPE", new Date(0), new Date(3_600_000));
    expect(points).toEqual([]);
  });

  it("rejects malformed curves", () => {
    expect(() => new StaticIntensityProvider({ hourly: { BAD: [1, 2, 3] } })).toThrow(/24/);
  });
});

describe("lowestCarbonWindow", () => {
  it("picks the midday solar valley", async () => {
    const window = await lowestCarbonWindow(
      provider,
      "TEST",
      120,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-08-13T00:00:00Z"),
    );
    expect(window).not.toBeNull();
    expect(window?.start.getUTCHours()).toBe(12);
    // mean of 250 (12:00) and 255 (13:00) — the cheapest 2h block in the curve
    expect(window?.meanGCO2ePerKwh).toBeCloseTo(252.5);
    expect(window?.provider).toBe("static-table");
  });

  it("respects the deadline even when greener hours come later", async () => {
    const window = await lowestCarbonWindow(
      provider,
      "TEST",
      60,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-08-12T09:00:00Z"),
    );
    // best full hour before 09:00 is 08:00 (380)
    expect(window?.start.getUTCHours()).toBe(8);
    expect(window?.meanGCO2ePerKwh).toBeCloseTo(380);
  });

  it("returns null rather than guessing without forecast data", async () => {
    const window = await lowestCarbonWindow(
      provider,
      "NOPE",
      60,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-08-12T09:00:00Z"),
    );
    expect(window).toBeNull();
  });

  it("rejects impossible schedules", async () => {
    await expect(
      lowestCarbonWindow(
        provider,
        "TEST",
        120,
        new Date("2026-08-12T00:00:00Z"),
        new Date("2026-08-12T01:00:00Z"),
      ),
    ).rejects.toThrow(/deadline/);
  });

  it("works with any conforming provider", async () => {
    const flat: GridIntensityProvider = {
      id: "flat",
      forecast: (_zone, from, to) =>
        Promise.resolve([{ start: from, end: to, gCO2ePerKwh: 100 }]),
    };
    const window = await lowestCarbonWindow(
      flat,
      "anywhere",
      30,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-08-12T02:00:00Z"),
    );
    expect(window?.meanGCO2ePerKwh).toBe(100);
  });
});
