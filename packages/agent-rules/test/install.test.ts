import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { INSTALL_DIR, installAgentRules } from "../src/index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "wattprint-rules-"));
});

describe("installAgentRules", () => {
  it("copies the full pack into the host repo", async () => {
    const result = await installAgentRules(dir);
    expect(result.installedTo).toBe(join(dir, INSTALL_DIR));
    const agentMd = await readFile(join(dir, INSTALL_DIR, "AGENT.md"), "utf8");
    expect(agentMd).toContain("Never sacrifice accessibility");
    expect(agentMd).toContain("modeled estimates");
    const frameworks = await readdir(join(dir, INSTALL_DIR, "frameworks"));
    expect(frameworks.sort()).toEqual(["astro.md", "nextjs.md", "plain-html.md", "sveltekit.md"]);
  });

  it("appends a reference line to existing CLAUDE.md and AGENTS.md", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "# Project\n\nExisting instructions.\n");
    await writeFile(join(dir, "AGENTS.md"), "# Agents\n");
    const result = await installAgentRules(dir);
    expect(result.referenced.sort()).toEqual(["AGENTS.md", "CLAUDE.md"]);
    const claude = await readFile(join(dir, "CLAUDE.md"), "utf8");
    expect(claude).toContain("Existing instructions.");
    expect(claude).toContain(".wattprint/agent-rules/AGENT.md");
  });

  it("is idempotent about the reference line", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "# Project\n");
    await installAgentRules(dir);
    const once = await readFile(join(dir, "CLAUDE.md"), "utf8");
    const second = await installAgentRules(dir);
    expect(second.referenced).toEqual([]);
    expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe(once);
  });

  it("tells the user what to do when no instruction file exists", async () => {
    const result = await installAgentRules(dir);
    expect(result.log.join("\n")).toContain("No CLAUDE.md or AGENTS.md found");
  });
});
