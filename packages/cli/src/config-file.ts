import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateConfig, type WattprintConfig } from "@wattprint/core";

export const CONFIG_FILENAME = "wattprint.config.json";

/**
 * Load the config from an explicit path or ./wattprint.config.json. A missing
 * implicit config falls back to defaults; a missing explicit one is an error.
 */
export async function loadConfig(explicitPath?: string): Promise<{
  config: WattprintConfig;
  path: string | null;
}> {
  const path = resolve(explicitPath ?? CONFIG_FILENAME);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (!explicitPath && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { config: { configVersion: 1 }, path: null };
    }
    throw new Error(`Cannot read config ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`);
  }
  return { config: validateConfig(parsed), path };
}
