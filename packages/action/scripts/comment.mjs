// Upserts the sticky wattprint comment on the current PR. Runs on plain Node
// inside the composite action: no dependencies, GitHub REST via fetch.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKER, renderComment } from "./render.mjs";

const ciDir = process.argv[2] ?? ".wattprint-ci";

function readJson(name) {
  const path = join(ciDir, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

const headScan = readJson("head-scan.json");
if (!headScan) {
  console.error(`No ${ciDir}/head-scan.json found; nothing to report`);
  process.exit(1);
}
const body = renderComment({
  diff: readJson("diff.json"),
  budget: readJson("budget.json"),
  headScan,
  baseScan: readJson("base-scan.json"),
});

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) appendFileSync(summaryPath, `${body}\n`);

if (process.env.WATTPRINT_DRY_RUN === "true") {
  console.log(body);
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;
const event = eventPath && existsSync(eventPath) ? JSON.parse(readFileSync(eventPath, "utf8")) : {};
const prNumber = event.pull_request?.number ?? event.issue?.number;

if (!token || !repo || !prNumber) {
  console.log("Not a pull-request context (or no token); comment written to step summary only.");
  process.exit(0);
}

const api = `https://api.github.com/repos/${repo}`;
const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
};

async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} -> ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

let existing = null;
for (let page = 1; page <= 10 && !existing; page++) {
  const comments = await request(
    `${api}/issues/${prNumber}/comments?per_page=100&page=${page}`,
  );
  existing = comments.find((c) => typeof c.body === "string" && c.body.includes(MARKER)) ?? null;
  if (comments.length < 100) break;
}

if (existing) {
  await request(`${api}/issues/comments/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
  console.log(`Updated sticky comment ${existing.id}`);
} else {
  const created = await request(`${api}/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  console.log(`Posted sticky comment ${created.id}`);
}
