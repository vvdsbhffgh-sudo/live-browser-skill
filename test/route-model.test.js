import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRouterConfig, listModels, nextModel } from "../scripts/route-model.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "route-model.js");
const CONFIG = path.join(ROOT, "config", "model-router.example.json");

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, "--config", CONFIG, ...args], { encoding: "utf8" });
}

test("router config has 50+ unique models", () => {
  const config = loadRouterConfig(CONFIG);
  const uniq = new Set(
    Object.values(config.routes).flat().map((e) => `${e.provider}/${e.model}`),
  );
  assert.ok(uniq.size >= 50, `expected 50+ unique models, got ${uniq.size}`);
  assert.ok(Object.keys(config.routes).length >= 4, "expected at least chat/code/vision/phone routes");
  assert.equal(config.limits.neverAutoUpgradeToPaid, true);
});

test("next model for code is a rank-1 entry", () => {
  const config = loadRouterConfig(CONFIG);
  const entry = nextModel(config, "code", []);
  assert.equal(entry.rank, 1);
  assert.ok(entry.provider && entry.model);
});

test("exhausted models are skipped in rank order", () => {
  const config = loadRouterConfig(CONFIG);
  const first = nextModel(config, "chat", []);
  const second = nextModel(config, "chat", [`${first.provider}/${first.model}`]);
  assert.notEqual(`${second.provider}/${second.model}`, `${first.provider}/${first.model}`);
  assert.ok(second.rank >= first.rank, "fallback must not outrank the first pick");
});

test("unknown task throws a clear error", () => {
  const config = loadRouterConfig(CONFIG);
  assert.throws(() => nextModel(config, "teleport", []), /unknown task/);
});

test("all-exhausted reports queue-and-pause, never a paid upgrade", () => {
  const config = loadRouterConfig(CONFIG);
  const all = config.routes.code.map((e) => `${e.provider}/${e.model}`);
  assert.throws(() => nextModel(config, "code", all), /queue-and-pause/);
});

test("CLI prints the next model and --list shows 50+ models", () => {
  const out = run(["--task", "vision"]);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout.trim(), /\//, "expected provider/model on stdout");
  const list = run(["--list"]);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /unique models/);
  const count = Number(list.stdout.match(/(\d+) unique models/)[1]);
  assert.ok(count >= 50, `expected 50+ unique models in --list, got ${count}`);
});

test("CLI exits non-zero for an unknown task", () => {
  const out = run(["--task", "teleport"]);
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /unknown task/);
});
