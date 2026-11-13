import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, helpText, version } from "../server/cli.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "server", "cli.js");

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 15000 });
}

test("version matches package.json", () => {
  assert.equal(version(), "1.0.3-alpha");
});

test("--help prints usage and exits 0", () => {
  const out = run(["--help"]);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /atlas 1\.0\.3-alpha/);
  assert.match(out.stdout, /--http/);
  assert.match(out.stdout, /never pays/i);
});

test("--version prints just the version", () => {
  const out = run(["--version"]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), "1.0.3-alpha");
});

test("parseArgs handles --http, --port and unknown args", () => {
  assert.deepEqual(parseArgs(["--http"]), { http: true, port: null, version: false, help: false, extra: [] });
  assert.equal(parseArgs(["--http", "--port", "4000"]).port, "4000");
  assert.equal(parseArgs(["--port=4000"]).port, "4000");
  assert.deepEqual(parseArgs(["--bogus"]).extra, ["--bogus"]);
});

test("unknown argument exits non-zero with a hint", () => {
  const out = run(["--bogus"]);
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /unknown argument/);
});

test("non-numeric --port exits non-zero", () => {
  const out = run(["--http", "--port", "abc"]);
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /--port must be a number/);
});
