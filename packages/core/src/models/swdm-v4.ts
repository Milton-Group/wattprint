import coefficients from "../data/swdm-v4-coefficients.json" with { type: "json" };
import type { EstimationModel, ModelOptions, SegmentGrams } from "../model.js";

const GB = coefficients.gigabyteBytes;
const OP = coefficients.operationalKwhPerGb;
const EM = coefficients.embodiedKwhPerGb;
const GLOBAL_GRID = coefficients.globalGridIntensityGCO2ePerKwh;

/**
 * Sustainable Web Design Model v4.
 * https://sustainablewebdesign.org/estimating-digital-emissions/
 *
 * Emissions = transfer (GB) x segment energy intensity (kWh/GB) x grid
 * intensity (g CO2e/kWh), summed over { data center, network, device } x
 * { operational, embodied }. Embodied emissions always use the global grid
 * intensity; a green-hosting factor removes only the data-center
 * operational-electricity term.
 */
export class SwdmV4 implements EstimationModel {
  readonly id = coefficients.model;
  readonly coefficientsVersion = coefficients.coefficientsVersion;

  segments(bytes: number, options: ModelOptions = {}): SegmentGrams {
    if (bytes < 1) {
      return { dataCenter: 0, network: 0, device: 0, operational: 0, embodied: 0, total: 0 };
    }
    const gb = bytes / GB;
    const grid = options.gridIntensity ?? {};
    const greenFactor = clamp01(options.greenHostingFactor ?? 0);

    const opDataCenter =
      gb * OP.dataCenter * (grid.dataCenter ?? GLOBAL_GRID) * (1 - greenFactor);
    const opNetwork = gb * OP.network * (grid.network ?? GLOBAL_GRID);
    const opDevice = gb * OP.device * (grid.device ?? GLOBAL_GRID);

    const emDataCenter = gb * EM.dataCenter * GLOBAL_GRID;
    const emNetwork = gb * EM.network * GLOBAL_GRID;
    const emDevice = gb * EM.device * GLOBAL_GRID;

    const operational = opDataCenter + opNetwork + opDevice;
    const embodied = emDataCenter + emNetwork + emDevice;
    return {
      dataCenter: opDataCenter + emDataCenter,
      network: opNetwork + emNetwork,
      device: opDevice + emDevice,
      operational,
      embodied,
      total: operational + embodied,
    };
  }

  gramsPerView(bytes: number, options: ModelOptions = {}): number {
    return this.segments(bytes, options).total;
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
