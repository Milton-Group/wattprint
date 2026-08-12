import { execFile } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(pkgRoot, "..", "..");
const bin = join(pkgRoot, "dist", "bin.js");
const optimizedDir = join(repoRoot, "fixtures", "optimized-site");

async function wattprint(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await run("node", [bin, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

let workDir: string;

beforeAll(async () => {
  execFileSync("node", [join(repoRoot, "fixtures", "generate-assets.mjs")]);
  workDir = await mkdtemp(join(tmpdir(), "wattprint-cli-"));
});

describe("wattprint CLI", () => {
  it("prints usage and fails without a command", async () => {
    const result = await wattprint([], workDir);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Usage:");
  });

  it("scans a directory and reports a modeled estimate", async () => {
    const result = await wattprint(
      ["scan", optimizedDir, "--runs", "1", "--json", "--out", join(workDir, "scan.json")],
      workDir,
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      kind: string;
      estimate: {
        disclaimer: string;
        model: { id: string; coefficientsVersion: string };
        siteGramsPerPageview: number;
      };
    };
    expect(parsed.kind).toBe("wattprint-scan");
    expect(parsed.estimate.model.id).toBe("swdm-v4");
    expect(parsed.estimate.disclaimer).toContain("Modeled estimate");
    expect(parsed.estimate.siteGramsPerPageview).toBeGreaterThan(0);
    // ~200 KB page must come out well under a gram per view
    expect(parsed.estimate.siteGramsPerPageview).toBeLessThan(0.2);

    const saved = JSON.parse(await readFile(join(workDir, "scan.json"), "utf8"));
    expect(saved.kind).toBe("wattprint-scan");
  });

  it("diffs two saved snapshots without re-measuring", async () => {
    const snapshot = (bytes: number) => ({
      routes: [{ route: "/", transferBytes: bytes }],
    });
    await writeFile(join(workDir, "base.json"), JSON.stringify(snapshot(1_000_000)));
    await writeFile(join(workDir, "head.json"), JSON.stringify(snapshot(1_500_000)));
    const result = await wattprint(["diff", "base.json", "head.json", "--json"], workDir);
    expect(result.code).toBe(0);
    const diff = JSON.parse(result.stdout) as {
      kind: string;
      deltaSiteGramsPerPageview: number;
      routes: { status: string }[];
    };
    expect(diff.kind).toBe("wattprint-diff");
    expect(diff.deltaSiteGramsPerPageview).toBeCloseTo(500_000 * (148.2 / 1e9), 9);
    expect(diff.routes[0]?.status).toBe("changed");

    const human = await wattprint(["diff", "base.json", "head.json"], workDir);
    expect(human.stdout).toContain("modeled estimates");
    expect(human.stdout).toContain("→");
  });

  it("exits 2 on budget breach and 0 within budget", async () => {
    await writeFile(
      join(workDir, "wattprint.config.json"),
      JSON.stringify({
        configVersion: 1,
        budgets: { maxTransferKbPerPageview: 100, failCiOnBreach: true },
      }),
    );
    await writeFile(
      join(workDir, "big.json"),
      JSON.stringify({ routes: [{ route: "/", transferBytes: 5_000_000 }] }),
    );
    const breach = await wattprint(["budget", "big.json"], workDir);
    expect(breach.code).toBe(2);
    expect(breach.stdout).toContain("FAIL");
    expect(breach.stdout).toContain("Budget breached.");

    await writeFile(
      join(workDir, "small.json"),
      JSON.stringify({ routes: [{ route: "/", transferBytes: 50_000 }] }),
    );
    const pass = await wattprint(["budget", "small.json"], workDir);
    expect(pass.code).toBe(0);
    expect(pass.stdout).toContain("All budgets met.");
  });

  it("requires a config for budget", async () => {
    const bare = await mkdtemp(join(tmpdir(), "wattprint-noconfig-"));
    await writeFile(
      join(bare, "snap.json"),
      JSON.stringify({ routes: [{ route: "/", transferBytes: 1 }] }),
    );
    const result = await wattprint(["budget", "snap.json"], bare);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("wattprint init");
  });

  it("writes a config via init --yes and refuses to overwrite it", async () => {
    const initDir = await mkdtemp(join(tmpdir(), "wattprint-init-"));
    const first = await wattprint(["init", "--yes"], initDir);
    expect(first.code).toBe(0);
    const config = JSON.parse(await readFile(join(initDir, "wattprint.config.json"), "utf8"));
    expect(config.configVersion).toBe(1);
    expect(config.budgets.failCiOnBreach).toBe(true);
    expect(config.$schema).toContain("wattprint.config.schema.json");

    const second = await wattprint(["init", "--yes"], initDir);
    expect(second.code).toBe(1);
    expect(second.stderr).toContain("already exists");
  });

  it("installs the agent-rules pack", async () => {
    const hostDir = await mkdtemp(join(tmpdir(), "wattprint-host-"));
    await writeFile(join(hostDir, "CLAUDE.md"), "# Host\n");
    const result = await wattprint(["agent-rules", "install"], hostDir);
    expect(result.code).toBe(0);
    const agentMd = await readFile(
      join(hostDir, ".wattprint", "agent-rules", "AGENT.md"),
      "utf8",
    );
    expect(agentMd).toContain("Never sacrifice accessibility");
    const claude = await readFile(join(hostDir, "CLAUDE.md"), "utf8");
    expect(claude).toContain(".wattprint/agent-rules/AGENT.md");
  });
});
