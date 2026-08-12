import { describe, expect, it } from "vitest";
// @ts-expect-error co2.js ships no type declarations
import { co2 } from "@tgwf/co2";
import { SwdmV4 } from "../src/index.js";

// Worked example from the published SWDM v4 coefficients:
// energy intensity sums to 0.300 kWh/GB (operational 0.055+0.059+0.080,
// embodied 0.012+0.013+0.081); at the global grid intensity of 494 g/kWh,
// one decimal gigabyte transfers at 0.300 * 494 = 148.2 g CO2e.
const GRAMS_PER_GB = 148.2;
const GB = 1e9;

describe("SwdmV4 worked examples", () => {
  const model = new SwdmV4();

  it("estimates 148.2 g for 1 GB at the global grid intensity", () => {
    expect(model.gramsPerView(GB)).toBeCloseTo(GRAMS_PER_GB, 9);
  });

  it("scales linearly with bytes (500 KB)", () => {
    expect(model.gramsPerView(500_000)).toBeCloseTo(GRAMS_PER_GB * 5e-4, 9);
  });

  it("returns 0 below one byte", () => {
    expect(model.gramsPerView(0)).toBe(0);
    expect(model.gramsPerView(0.5)).toBe(0);
  });

  it("green hosting removes only data-center operational electricity", () => {
    // 0.055 kWh/GB * 494 g/kWh = 27.17 g of the 148.2 g total
    expect(model.gramsPerView(GB, { greenHostingFactor: 1 })).toBeCloseTo(148.2 - 27.17, 9);
  });

  it("applies a device grid-intensity override to the device operational segment only", () => {
    // device operational 0.080 kWh/GB: 494 -> 300 g/kWh changes it 39.52 -> 24
    expect(
      model.gramsPerView(GB, { gridIntensity: { device: 300 } }),
    ).toBeCloseTo(148.2 - 39.52 + 24, 9);
  });

  it("applies a data-center grid-intensity override, leaving embodied at global intensity", () => {
    // dc operational 0.055 kWh/GB: 494 -> 100 g/kWh changes it 27.17 -> 5.5
    expect(
      model.gramsPerView(GB, { gridIntensity: { dataCenter: 100 } }),
    ).toBeCloseTo(148.2 - 27.17 + 5.5, 9);
  });

  it("segments sum to the total", () => {
    const s = model.segments(1_234_567);
    expect(s.dataCenter + s.network + s.device).toBeCloseTo(s.total, 12);
    expect(s.operational + s.embodied).toBeCloseTo(s.total, 12);
  });

  it("carries model id and coefficient version", () => {
    expect(model.id).toBe("swdm-v4");
    expect(model.coefficientsVersion).toMatch(/^swdm-v4\./);
  });
});

describe("SwdmV4 against the co2.js reference implementation", () => {
  const model = new SwdmV4();
  const oracle = new co2({ model: "swd", version: 4 });
  const sizes = [1_000, 250_000, 1_000_000, 2_345_678, 50_000_000, 1e9];

  it("matches perByte for a range of sizes", () => {
    for (const bytes of sizes) {
      expect(model.gramsPerView(bytes)).toBeCloseTo(oracle.perByte(bytes) as number, 9);
    }
  });

  it("matches perByte with green hosting", () => {
    for (const bytes of sizes) {
      expect(model.gramsPerView(bytes, { greenHostingFactor: 1 })).toBeCloseTo(
        oracle.perByte(bytes, true) as number,
        9,
      );
    }
  });

  it("matches perByteTrace with segment grid overrides", () => {
    const trace = oracle.perByteTrace(1e9, false, {
      gridIntensity: { device: 350, dataCenter: 120 },
    }) as { co2: number };
    expect(
      model.gramsPerView(1e9, { gridIntensity: { device: 350, dataCenter: 120 } }),
    ).toBeCloseTo(trace.co2, 9);
  });
});
