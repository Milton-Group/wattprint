#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { diffEstimates, evaluateBudgets } from "@wattprint/core";
import type { MeasureOptions } from "@wattprint/measure";
import { loadConfig } from "./config-file.js";
import { runInit } from "./init.js";
import { renderBudget, renderDiff, renderScan } from "./report.js";
import { resolveTarget } from "./target.js";

const USAGE = `wattprint — modeled website carbon estimates, diffs, and budgets

Usage:
  wattprint scan <url|dir|snapshot.json>   Measure + estimate, print a report
  wattprint diff <base> <head>             Carbon delta between two targets
  wattprint budget <url|dir|snapshot.json> Check budgets; exit 2 on breach
  wattprint init                           Write wattprint.config.json
  wattprint agent-rules install            Install the green-web rules pack

Options:
  --config <path>   Config file (default ./wattprint.config.json)
  --routes <a,b>    Routes to measure (default from config, else /)
  --runs <n>        Runs per route, median kept (default 3)
  --no-warm         Skip the warm-cache (returning visitor) pass
  --json            Machine-readable JSON on stdout
  --out <path>      Also save the JSON result to a file
  -h, --help        Show this help

All emission figures are modeled estimates (methodology + coefficient
versions are embedded in every result), not measurements.`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string" },
      routes: { type: "string" },
      runs: { type: "string" },
      "no-warm": { type: "boolean" },
      json: { type: "boolean" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
      yes: { type: "boolean", short: "y" },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || command === undefined || command === "help") {
    console.log(USAGE);
    return command === undefined && !values.help ? 1 : 0;
  }

  const measureOptions: MeasureOptions = {};
  if (values.routes) measureOptions.routes = values.routes.split(",").map((r) => r.trim());
  if (values.runs) {
    const runs = Number(values.runs);
    if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
    measureOptions.runs = runs;
  }
  if (values["no-warm"]) measureOptions.warmPass = false;

  switch (command) {
    case "scan": {
      const target = requireArg(args[0], "scan <url|dir|snapshot.json>");
      const { config } = await loadConfig(values.config);
      const result = await resolveTarget(target, config, measureOptions);
      await emit(result, values, renderScan(result));
      return 0;
    }
    case "diff": {
      const base = requireArg(args[0], "diff <base> <head>");
      const head = requireArg(args[1], "diff <base> <head>");
      const { config } = await loadConfig(values.config);
      const baseResult = await resolveTarget(base, config, measureOptions);
      const headResult = await resolveTarget(head, config, measureOptions);
      const diff = diffEstimates(baseResult.estimate, headResult.estimate);
      await emit(diff, values, renderDiff(diff));
      return 0;
    }
    case "budget": {
      const target = requireArg(args[0], "budget <url|dir|snapshot.json>");
      const { config, path } = await loadConfig(values.config);
      if (path === null) {
        console.error("wattprint budget requires a wattprint.config.json (run `wattprint init`)");
        return 1;
      }
      const result = await resolveTarget(target, config, measureOptions);
      const report = evaluateBudgets(result.estimate, config);
      await emit(report, values, renderBudget(report, result.estimate));
      return report.breached ? 2 : 0;
    }
    case "init": {
      return runInit({ assumeDefaults: values.yes ?? false });
    }
    case "agent-rules": {
      if (args[0] !== "install") {
        console.error("Usage: wattprint agent-rules install");
        return 1;
      }
      const { installAgentRules } = await import("@wattprint/agent-rules");
      const installed = await installAgentRules(process.cwd());
      for (const line of installed.log) console.log(line);
      return 0;
    }
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      return 1;
  }
}

function requireArg(value: string | undefined, usage: string): string {
  if (!value) throw new Error(`Usage: wattprint ${usage}`);
  return value;
}

async function emit(
  result: unknown,
  values: { json?: boolean | undefined; out?: string | undefined },
  human: string,
): Promise<void> {
  const json = JSON.stringify(result, null, 2);
  if (values.out) await writeFile(values.out, json);
  console.log(values.json ? json : human);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
