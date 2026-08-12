import { cp, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const INSTALL_DIR = ".wattprint/agent-rules";
const REFERENCE_LINE =
  "Green-web coding rules: follow `.wattprint/agent-rules/AGENT.md` (plus the matching `frameworks/*.md` supplement). Installed by `wattprint agent-rules install`.";

export interface InstallResult {
  installedTo: string;
  /** Instruction files a reference line was appended to. */
  referenced: string[];
  log: string[];
}

/**
 * Copy the rules pack into `<targetDir>/.wattprint/agent-rules/` and append a
 * reference line to CLAUDE.md / AGENTS.md when they exist and don't already
 * point at the pack. Re-running updates the pack in place and appends nothing
 * twice.
 */
export async function installAgentRules(targetDir: string): Promise<InstallResult> {
  const packDir = join(dirname(fileURLToPath(import.meta.url)), "..", "pack");
  const installedTo = join(targetDir, INSTALL_DIR);
  await cp(packDir, installedTo, { recursive: true });

  const log = [`Installed green-web rules pack to ${INSTALL_DIR}/`];
  const referenced: string[] = [];
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const path = join(targetDir, name);
    const exists = await stat(path).then(
      (s) => s.isFile(),
      () => false,
    );
    if (!exists) continue;
    const content = await readFile(path, "utf8");
    if (content.includes(`${INSTALL_DIR}/AGENT.md`)) {
      log.push(`${name} already references the pack; left unchanged`);
      continue;
    }
    const separator = content.endsWith("\n") ? "\n" : "\n\n";
    await writeFile(path, `${content}${separator}${REFERENCE_LINE}\n`);
    referenced.push(name);
    log.push(`Added a reference line to ${name}`);
  }
  if (referenced.length === 0 && log.length === 1) {
    log.push(
      "No CLAUDE.md or AGENTS.md found; point your coding agent at " +
        `${INSTALL_DIR}/AGENT.md yourself.`,
    );
  }
  log.push("Commit the pack so agents and teammates get the same rules.");
  return { installedTo, referenced, log };
}
