import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import type { WattprintConfig } from "@wattprint/core";
import { CONFIG_FILENAME } from "./config-file.js";

interface InitOptions {
  assumeDefaults: boolean;
}

export async function runInit(options: InitOptions): Promise<number> {
  const interactive = !options.assumeDefaults && process.stdin.isTTY === true;
  const answers = interactive ? await ask() : {};

  const config: WattprintConfig & { $schema: string } = {
    $schema:
      "./node_modules/@wattprint/core/schema/wattprint.config.schema.json",
    configVersion: 1,
    model: "swdm-v4",
    traffic: {
      pageviewsPerMonth: answers.pageviews ?? 10_000,
      returningVisitorRatio: answers.returningRatio ?? 0.25,
    },
    infra: {
      greenHostingVerified: answers.greenHosting ?? false,
    },
    budgets: {
      maxGramsPerPageview: answers.maxGrams ?? 0.5,
      maxTransferKbPerPageview: answers.maxKb ?? 1500,
      failCiOnBreach: true,
    },
    measure: {
      routes: answers.routes ?? ["/"],
      runs: 3,
    },
  };

  await writeFile(CONFIG_FILENAME, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" }).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "EEXIST") {
        throw new Error(`${CONFIG_FILENAME} already exists; delete it first to re-init`);
      }
      throw err;
    },
  );
  console.log(`Wrote ${CONFIG_FILENAME}. Adjust traffic numbers as real analytics come in —`);
  console.log("annualized figures are only as good as the pageview estimate.");
  return 0;
}

interface Answers {
  pageviews?: number;
  returningRatio?: number;
  greenHosting?: boolean;
  maxGrams?: number;
  maxKb?: number;
  routes?: string[];
}

async function ask(): Promise<Answers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answers: Answers = {};
    answers.pageviews = numberAnswer(
      await rl.question("Monthly pageviews across the site? [10000] "),
      10_000,
    );
    answers.returningRatio = numberAnswer(
      await rl.question("Returning-visitor ratio 0..1? [0.25] "),
      0.25,
    );
    const green = (
      await rl.question("Is hosting verifiably green (e.g. Green Web Foundation listed)? [y/N] ")
    ).trim();
    answers.greenHosting = /^y(es)?$/i.test(green);
    answers.maxGrams = numberAnswer(
      await rl.question("Budget: max g CO2e per pageview? [0.5] "),
      0.5,
    );
    answers.maxKb = numberAnswer(
      await rl.question("Budget: max transfer KB per pageview? [1500] "),
      1500,
    );
    const routes = (await rl.question("Routes to measure, comma-separated? [/] ")).trim();
    answers.routes = routes === "" ? ["/"] : routes.split(",").map((r) => r.trim());
    return answers;
  } finally {
    rl.close();
  }
}

function numberAnswer(input: string, fallback: number): number {
  const trimmed = input.trim();
  if (trimmed === "") return fallback;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`Not a number: ${trimmed}`);
  return value;
}
