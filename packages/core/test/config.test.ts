import { describe, expect, it } from "vitest";
import { modelOptionsFromConfig, validateConfig } from "../src/index.js";

describe("validateConfig", () => {
  it("accepts a minimal config", () => {
    expect(validateConfig({ configVersion: 1 })).toEqual({ configVersion: 1 });
  });

  it("rejects a missing or wrong configVersion", () => {
    expect(() => validateConfig({})).toThrow(/configVersion/);
    expect(() => validateConfig({ configVersion: 2 })).toThrow(/configVersion/);
    expect(() => validateConfig(null)).toThrow(/object/);
  });

  it("rejects out-of-range ratios", () => {
    expect(() =>
      validateConfig({ configVersion: 1, traffic: { returningVisitorRatio: 1.5 } }),
    ).toThrow(/returningVisitorRatio/);
    expect(() =>
      validateConfig({ configVersion: 1, infra: { cdnCacheHitRatio: -0.1 } }),
    ).toThrow(/cdnCacheHitRatio/);
  });

  it("rejects geo audience tables whose shares do not sum to 1", () => {
    expect(() =>
      validateConfig({
        configVersion: 1,
        traffic: {
          audienceGridIntensity: {
            SG: { share: 0.5, gCO2ePerKwh: 400 },
            US: { share: 0.2, gCO2ePerKwh: 380 },
          },
        },
      }),
    ).toThrow(/sum to 1/);
  });

  it("rejects non-positive budgets", () => {
    expect(() =>
      validateConfig({ configVersion: 1, budgets: { maxGramsPerPageview: 0 } }),
    ).toThrow(/maxGramsPerPageview/);
  });
});

describe("modelOptionsFromConfig", () => {
  it("maps a scalar audience intensity to the device segment", () => {
    const options = modelOptionsFromConfig({
      configVersion: 1,
      traffic: { audienceGridIntensity: 320 },
    });
    expect(options.gridIntensity?.device).toBe(320);
  });

  it("collapses a geo table to its share-weighted mean", () => {
    const options = modelOptionsFromConfig({
      configVersion: 1,
      traffic: {
        audienceGridIntensity: {
          SG: { share: 0.75, gCO2ePerKwh: 400 },
          FR: { share: 0.25, gCO2ePerKwh: 60 },
        },
      },
    });
    expect(options.gridIntensity?.device).toBeCloseTo(0.75 * 400 + 0.25 * 60);
  });

  it("maps hosting intensity to the data-center segment", () => {
    const options = modelOptionsFromConfig({
      configVersion: 1,
      infra: { hostingGridIntensity: 120 },
    });
    expect(options.gridIntensity?.dataCenter).toBe(120);
    expect(options.greenHostingFactor).toBeUndefined();
  });

  it("lets verified green hosting take precedence over hosting intensity", () => {
    const options = modelOptionsFromConfig({
      configVersion: 1,
      infra: { greenHostingVerified: true, hostingGridIntensity: 120 },
    });
    expect(options.greenHostingFactor).toBe(1);
    expect(options.gridIntensity?.dataCenter).toBeUndefined();
  });

  it("returns empty options for an empty config", () => {
    expect(modelOptionsFromConfig({ configVersion: 1 })).toEqual({});
  });
});
