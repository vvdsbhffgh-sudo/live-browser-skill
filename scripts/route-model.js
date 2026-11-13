// route-model.js — pick the next model for a task from the model-router config.
//
// Atlas does not call model APIs itself: the AI builder (or its agent) does.
// This helper is the executable form of the router: given a task and the models
// already exhausted (rate limit / failure), it prints the next best model in
// rank order (1 = strongest for that task, 3 = weakest fallback), skipping the
// exhausted ones. Ranks judge task strength from public benchmarks, not fame:
// a lesser-known model can outrank a famous one for a specific task.
//
// Usage:
//   node scripts/route-model.js --task code
//   node scripts/route-model.js --task chat --exhausted "openrouter/thinkingmachines/inkling:free,groq/openai/gpt-oss-120b"
//   node scripts/route-model.js --list
//   node scripts/route-model.js --task code --config config/model-router.json
//
// Exit code 0 with "provider/model" on stdout when a model is available;
// exit code 1 with an error on stderr when the task is unknown or every
// model for it is exhausted (queue-and-pause: wait retryDelaySeconds, then
// run again — never silently upgrade to a paid model).

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadRouterConfig(configPath) {
  const candidates = configPath
    ? [path.resolve(configPath)]
    : [
        path.join(ROOT, "config", "model-router.json"),
        path.join(ROOT, "config", "model-router.example.json"),
      ];
  for (const file of candidates) {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf8"));
    }
  }
  throw new Error("no model-router config found (looked for model-router.json, model-router.example.json)");
}

export function listModels(config) {
  const routes = config.routes ?? {};
  return Object.fromEntries(
    Object.entries(routes).map(([task, entries]) => [
      task,
      [...entries].sort((a, b) => a.rank - b.rank || String(a.model).localeCompare(String(b.model))),
    ]),
  );
}

export function nextModel(config, task, exhausted = []) {
  const routes = config.routes ?? {};
  if (!Object.hasOwn(routes, task)) {
    throw new Error(`unknown task "${task}" (known: ${Object.keys(routes).join(", ")})`);
  }
  const exhaustedSet = new Set(
    exhausted.map((x) => String(x).trim()).filter(Boolean),
  );
  const entries = [...routes[task]].sort(
    (a, b) => a.rank - b.rank || String(a.model).localeCompare(String(b.model)),
  );
  for (const entry of entries) {
    const id = `${entry.provider}/${entry.model}`;
    if (exhaustedSet.has(id) || exhaustedSet.has(String(entry.model))) continue;
    return entry;
  }
  const retry = config.limits?.retryDelaySeconds ?? 60;
  throw new Error(
    `all models for "${task}" are exhausted — queue-and-pause: wait ${retry}s, then try again (never auto-upgrade to paid)`,
  );
}

function parseArgs(argv) {
  const args = { task: null, exhausted: [], config: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--task") args.task = argv[++i];
    else if (argv[i] === "--exhausted") args.exhausted = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--list") args.list = true;
    else if (argv[i].startsWith("--task=")) args.task = argv[i].slice("--task=".length);
    else if (argv[i].startsWith("--exhausted=")) args.exhausted = argv[i].slice("--exhausted=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i].startsWith("--config=")) args.config = argv[i].slice("--config=".length);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let config;
  try {
    config = loadRouterConfig(args.config);
  } catch (err) {
    console.error(`route-model: ${err.message}`);
    process.exit(1);
  }
  if (args.list) {
    for (const [task, entries] of Object.entries(listModels(config))) {
      console.log(`[${task}]`);
      for (const e of entries) console.log(`  rank ${e.rank}  ${e.provider}/${e.model}`);
    }
    const uniq = new Set(
      Object.values(config.routes ?? {}).flat().map((e) => `${e.provider}/${e.model}`),
    );
    console.log(`\n${uniq.size} unique models across ${Object.keys(config.routes ?? {}).length} tasks`);
    return;
  }
  if (!args.task) {
    console.error("route-model: --task <chat|code|vision|audio|phone> is required (or use --list)");
    process.exit(1);
  }
  try {
    const entry = nextModel(config, args.task, args.exhausted);
    console.log(`${entry.provider}/${entry.model}`);
  } catch (err) {
    console.error(`route-model: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
