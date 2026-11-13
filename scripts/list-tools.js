#!/usr/bin/env node
// list-tools — print Atlas's registries: languages, modes, model routes,
// plugins. Reads the JSON files under config/ and prints a human-readable
// summary. No network, no side effects, exit 0 on success.
//
// Usage: npm run list-tools   (node scripts/list-tools.js)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJsonDir(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      out.push({ file, data: JSON.parse(readFileSync(path.join(dir, file), "utf8")) });
    } catch (err) {
      out.push({ file, error: String(err?.message ?? err) });
    }
  }
  return out;
}

function readJsonFile(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const languages = readJsonDir(path.join(ROOT, "config", "code-tools"));
const modes = readJsonDir(path.join(ROOT, "config", "modes"));
const router = readJsonFile(path.join(ROOT, "config", "model-router.example.json"));
const agents = readJsonFile(path.join(ROOT, "config", "agents.example.json"));
const plugins = readJsonFile(path.join(ROOT, "plugins", "registry.example.json"));
const playStore = readJsonFile(path.join(ROOT, "config", "play-store-apps.example.json"));

console.log("Atlas — tools, languages, modes, routes");
console.log("==========================================");
console.log("");

console.log(`Languages (${languages.length}) — config/code-tools/`);
for (const { file, data, error } of languages) {
  if (error || !data) {
    console.log(`  - ${file}: INVALID (${error ?? "unreadable"})`);
    continue;
  }
  console.log(`  - ${data.language} (${(data.extensions ?? []).join(", ")})`);
  console.log(`      runtime: ${data.runtime?.name ?? "?"} — install: ${data.runtime?.install ?? "?"}`);
  console.log(`      run: ${data.run?.command ?? "?"} | test: ${data.test?.command ?? "?"}`);
  console.log(`      format: ${data.formatter?.name ?? "?"} | lint: ${data.linter?.name ?? "?"}`);
  console.log(`      model: ${data.preferredModel?.route ?? "?"} / ${data.preferredModel?.model ?? "?"}`);
}
console.log("");

console.log(`Modes (${modes.length}) — config/modes/`);
for (const { file, data, error } of modes) {
  if (error || !data) {
    console.log(`  - ${file}: INVALID (${error ?? "unreadable"})`);
    continue;
  }
  console.log(`  - ${data.name}${data.language ? ` [${data.language}]` : ""} — ${data.description ?? ""}`);
  console.log(`      model route: ${data.modelRoute ?? "?"} | max steps: ${data.maxSteps ?? "?"} | tools: ${(data.allowedTools ?? []).length}`);
}
console.log("");

if (router?.routes) {
  console.log("Model routes — config/model-router.example.json");
  for (const [kind, chain] of Object.entries(router.routes)) {
    const parts = chain.map((e) => `${e.provider}/${e.model} (rank ${e.rank ?? "?"})`).join(" -> ");
    console.log(`  - ${kind}: ${parts}`);
  }
  const free = router.limits?.openrouter_free;
  if (free) {
    console.log(`    OpenRouter :free limits: ${free.perMinute}/min, ${free.perDay}/day, ${free.perDayAfter10UsdLifetime}/day after $10 lifetime`);
  }
  console.log("");
}

if (agents?.agents) {
  console.log(`Agents (${agents.agents.length}) — config/agents.example.json`);
  for (const a of agents.agents) {
    console.log(`  - ${a.name} (port ${a.port}, route ${a.modelRoute}) — profile ${a.browserProfile}`);
  }
  console.log("");
}

if (plugins?.plugins) {
  console.log(`Plugins in registry (${plugins.plugins.length}) — plugins/registry.example.json (listed, NOT installed)`);
  for (const p of plugins.plugins) {
    console.log(`  - ${p.tool}: ${p.repo} [${p.license}] installed=${p.installed}`);
  }
  console.log("");
}

if (playStore?.apps) {
  console.log(`Play Store apps (${playStore.apps.length}) — config/play-store-apps.example.json (install by hand on the test phone)`);
  for (const a of playStore.apps) {
    console.log(`  - ${a.playStore} [${a.category}] install=${a.install}`);
  }
  console.log("");
}

const invalid = [...languages, ...modes].filter((e) => e.error || !e.data);
if (invalid.length > 0) {
  console.log(`WARNING: ${invalid.length} registry file(s) invalid — see above.`);
  process.exitCode = 1;
} else {
  console.log("All registry files valid.");
}
