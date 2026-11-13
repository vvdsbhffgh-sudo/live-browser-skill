import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModes, isToolAllowedInMode } from "../server/modes.js";
import { windowsStatus, iphoneStatus } from "../server/platforms.js";
import { artemisStatus } from "../server/artemis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package is Atlas, Alpha 2", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "atlas");
  assert.equal(pkg.version, "1.0.2-alpha");
  // Repo URL stays the technical name until publishing (see NAME.md).
  assert.match(pkg.repository.url, /live-browser-skill/);
});

test("NAME.md records Atlas as decided", () => {
  const doc = readFileSync(path.join(ROOT, "NAME.md"), "utf8");
  assert.match(doc, /Atlas.*decided/i);
  assert.match(doc, /Alpha 2/);
});

test("modes: all 10 modes load, with language modes", () => {
  const modes = loadModes(ROOT);
  assert.ok(modes.size >= 10, `expected >=10 modes, got ${modes.size}`);
  for (const name of [
    "coding", "content", "research", "testing", "chat",
    "coding-python", "coding-web", "coding-api", "coding-scripts",
    "content-writing",
  ]) {
    assert.ok(modes.has(name), `missing mode ${name}`);
    const m = modes.get(name);
    assert.ok(m.modelRoute, `${name}: modelRoute`);
    assert.ok(Number.isInteger(m.maxSteps) && m.maxSteps > 0, `${name}: maxSteps`);
    assert.ok(Array.isArray(m.allowedTools) && m.allowedTools.length > 0, `${name}: allowedTools`);
  }
  assert.equal(modes.get("coding-python").language, "python");
  assert.match(modes.get("coding-web").language, /javascript/);
  assert.match(modes.get("content-writing").language, /markdown/);
});

test("modes: research forbids typing, coding allows it, missing dir falls back", () => {
  const modes = loadModes(ROOT);
  assert.equal(isToolAllowedInMode(modes.get("research"), "browser_type"), false);
  assert.equal(isToolAllowedInMode(modes.get("research"), "browser_navigate"), true);
  assert.equal(isToolAllowedInMode(modes.get("coding"), "browser_type"), true);
  // Read-only/status tools are always allowed, even in chat mode.
  assert.equal(isToolAllowedInMode(modes.get("chat"), "browser_status"), true);
  assert.equal(isToolAllowedInMode(modes.get("chat"), "browser_mode"), true);
  // A missing config dir still yields the built-in core modes.
  const fallback = loadModes(path.join(ROOT, "does-not-exist"));
  assert.ok(fallback.has("coding"));
  assert.equal(fallback.get("coding").maxSteps, 100);
});

test("code-tools registry: 11 languages, all valid with required fields", () => {
  const dir = path.join(ROOT, "config", "code-tools");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  assert.deepEqual(files, [
    "bash.json", "csharp.json", "go.json", "html-css.json", "java.json",
    "javascript.json", "php.json", "python.json", "rust.json", "sql.json",
    "typescript.json",
  ]);
  for (const file of files) {
    const d = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    assert.ok(d.language, `${file}: language`);
    assert.ok(d.runtime?.name, `${file}: runtime.name`);
    assert.ok(d.runtime?.install, `${file}: runtime.install`);
    assert.ok(d.run?.command, `${file}: run.command`);
    assert.ok(d.test?.command, `${file}: test.command`);
    assert.ok(d.formatter?.name, `${file}: formatter.name`);
    assert.ok(d.linter?.name, `${file}: linter.name`);
    assert.ok(["code", "chat", "vision"].includes(d.preferredModel?.route), `${file}: preferredModel.route`);
    assert.ok(Array.isArray(d.extensions) && d.extensions.length > 0, `${file}: extensions`);
  }
});

test("list-tools script prints the registries and passes", () => {
  const out = execFileSync("node", [path.join(ROOT, "scripts", "list-tools.js")], { encoding: "utf8" });
  assert.match(out, /Languages \(11\)/);
  assert.match(out, /python/);
  assert.match(out, /Modes \(10\)/);
  assert.match(out, /coding-python/);
  assert.match(out, /rank 1/);
  assert.match(out, /All registry files valid\./);
});

test("model router: every entry has a rank 1-3 and Groq is in the pool", () => {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "config", "model-router.example.json"), "utf8"));
  const providers = new Set();
  for (const [kind, chain] of Object.entries(cfg.routes)) {
    assert.ok(Array.isArray(chain) && chain.length > 0, kind);
    for (const entry of chain) {
      providers.add(entry.provider);
      assert.ok(Number.isInteger(entry.rank) && entry.rank >= 1 && entry.rank <= 3,
        `${kind}/${entry.model}: rank must be 1-3, got ${entry.rank}`);
    }
  }
  assert.ok(providers.has("groq"), "Groq must be in the pool");
  assert.ok(providers.has("openrouter"));
  assert.ok(providers.has("ollama"));
  const doc = readFileSync(path.join(ROOT, "docs", "MODEL-ROUTER.md"), "utf8");
  assert.match(doc, /rank/i);
  assert.match(doc, /not by fame|not on how famous/i);
  assert.match(doc, /Otter/);
});

test("platform status tools: not-configured without env, configured with it", () => {
  assert.equal(artemisStatus({}).status, "not-configured");
  assert.equal(windowsStatus({}).status, "not-configured");
  assert.equal(iphoneStatus({}).status, "not-configured");
  assert.equal(windowsStatus({ UFO_MCP_URL: "http://localhost:9000/mcp" }).status, "configured");
  assert.equal(iphoneStatus({ IPHONE_CONTROL_URL: "http://localhost:9001/mcp" }).status, "configured");
  assert.equal(artemisStatus({ ARTEMIS_MCP_URL: "http://localhost:8000/mcp" }).status, "configured");
});

test("PLATFORMS.md is honest about all three platforms", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "PLATFORMS.md"), "utf8");
  assert.match(doc, /Microsoft UFO/);
  assert.match(doc, /MIT/);
  assert.match(doc, /HostAgent/);
  assert.match(doc, /no sandbox/i);
  assert.match(doc, /low-privilege/i);
  assert.match(doc, /iphone-control/);
  assert.match(doc, /iOS 17/);
  assert.match(doc, /7 days/);
  assert.match(doc, /never as easy as Android/i);
  assert.match(doc, /closed system/i);
});

test("LIVE-TEST.md documents the real-person test, not a bypass", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "LIVE-TEST.md"), "utf8");
  assert.match(doc, /headed/i);
  assert.match(doc, /persistent profile/i);
  assert.match(doc, /Live View/);
  assert.match(doc, /Pause/);
  assert.match(doc, /does not test bypassing CAPTCHA/i);
  assert.match(doc, /solve it manually/i);
});

test("FREE-MODELS.md pools free providers and never claims limitless", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "FREE-MODELS.md"), "utf8");
  assert.match(doc, /OpenRouter/);
  assert.match(doc, /20 requests\/minute, 50\/day/);
  assert.match(doc, /Groq/);
  assert.match(doc, /Gemini/);
  assert.match(doc, /Ollama/);
  assert.match(doc, /pooled|مجمّع/);
  assert.doesNotMatch(doc, /unlimited/i);
  assert.match(doc, /never limitless|not limitless|Nothing here is limitless/i);
});

test("FAMOUS-TOOLS.md: official integrations only, closed tools never copied", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "FAMOUS-TOOLS.md"), "utf8");
  for (const name of ["Microsoft UFO", "Google Artemis", "GitHub MCP", "Playwright", "Ollama", "OpenRouter"]) {
    assert.ok(doc.includes(name), `missing ${name}`);
  }
  assert.match(doc, /Copilot/);
  assert.match(doc, /cannot be copied|never copies|never copied/i);
  assert.match(doc, /official MCP/i);
  assert.match(doc, /after you approve|after your approval/i);
  assert.match(doc, /No fake integration/i);
});

test("CODE-TOOLS.md is honest about the registry", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "CODE-TOOLS.md"), "utf8");
  assert.match(doc, /does not literally|not.*literally.*every language/i);
  assert.match(doc, /one JSON file/i);
  assert.match(doc, /model writes the code/i);
});

test("SECURITY.md: security model + no absolute guarantee + human checks", () => {
  const doc = readFileSync(path.join(ROOT, "SECURITY.md"), "utf8");
  assert.match(doc, /Security model/);
  assert.match(doc, /No absolute guarantee/);
  assert.match(doc, /Human checks/);
  assert.match(doc, /CAPTCHA solver/);
  assert.match(doc, /Human pace/);
  assert.match(doc, /TLS certificate verification, always on/i);
});

test("FEATURES.md Never covers solver, Play Store bypass, and Gmail", () => {
  const doc = readFileSync(path.join(ROOT, "FEATURES.md"), "utf8");
  assert.match(doc, /CAPTCHA solver/i);
  assert.match(doc, /Bypassing Play Store verification/i);
  assert.match(doc, /Automatic Gmail creation/i);
  assert.match(doc, /Merging all trending AI repos/i);
});

test("update-deps script exists, is a script, and has a rollback", () => {
  const p = path.join(ROOT, "scripts", "update-deps.sh");
  assert.ok(existsSync(p));
  assert.ok(statSync(p).mode & 0o111, "update-deps.sh must be executable");
  const script = readFileSync(p, "utf8");
  assert.match(script, /rollback/i);
  assert.match(script, /npm test/);
  const doc = readFileSync(path.join(ROOT, "docs", "UPDATES.md"), "utf8");
  assert.match(doc, /No blind update/i);
  assert.match(doc, /roll back/i);
});

test("dashboard: PWA files exist and manifest is valid", () => {
  for (const p of [
    "dashboard/index.html",
    "dashboard/manifest.json",
    "dashboard/sw.js",
    "dashboard/icon.svg",
    "dashboard/icon-192.png",
    "dashboard/icon-512.png",
  ]) {
    assert.ok(existsSync(path.join(ROOT, p)), p);
    assert.ok(statSync(path.join(ROOT, p)).size > 0, p);
  }
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "dashboard", "manifest.json"), "utf8"));
  assert.match(manifest.name, /Atlas/);
  assert.equal(manifest.start_url, "/dashboard/");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  const html = readFileSync(path.join(ROOT, "dashboard", "index.html"), "utf8");
  assert.match(html, /--md-primary/);
  assert.match(html, /--md-spring/);
  assert.match(html, /Material 3 Expressive/);
  assert.match(html, /btn-pause/);
  assert.match(html, /btn-resume/);
  assert.match(html, /btn-approve/);
  assert.match(html, /btn-record/);
  assert.match(html, /\/status/);
  assert.match(html, /\/events/);
  assert.match(html, /serviceWorker/);
});

test("dashboard: service worker caches the shell only, never live data", () => {
  const sw = readFileSync(path.join(ROOT, "dashboard", "sw.js"), "utf8");
  assert.match(sw, /atlas-dashboard-v1/);
  assert.match(sw, /\/status/);
  assert.match(sw, /\/events/);
  assert.match(sw, /\/latest\.png/);
  assert.match(sw, /NEVER cached|never cached/i);
});

test("server wires /dashboard and /api/approve and feeds the dashboard", () => {
  const src = readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
  assert.match(src, /\/dashboard/);
  assert.match(src, /\/api\/approve/);
  assert.match(src, /sessionAllowSensitive/);
  assert.match(src, /effectiveAllowSensitive/);
  assert.match(src, /agents: AGENTS_CONFIG/);
  assert.match(src, /modelRouter: ROUTER_CONFIG/);
  assert.match(src, /allowSensitive: effectiveAllowSensitive/);
});

test("DESIGN.md documents the tokens and is honest about Stitch and v0", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "DESIGN.md"), "utf8");
  assert.match(doc, /Material 3 Expressive/);
  assert.match(doc, /--md-primary/);
  assert.match(doc, /--md-spring/);
  assert.match(doc, /Google Stitch/);
  assert.match(doc, /Vercel v0/);
  assert.match(doc, /not a package|web tool/i);
  assert.match(doc, /did not install/i);
});

test("CONNECTIONS.md documents every way in, and names no fake Tesbit", () => {
  const doc = readFileSync(path.join(ROOT, "docs", "CONNECTIONS.md"), "utf8");
  for (const s of ["stdio", "/mcp", "REST API", "SKILL.md", "npm start", "/events", "/dashboard"]) {
    assert.ok(doc.includes(s), `missing ${s}`);
  }
  assert.match(doc, /Tesbit/);
  assert.match(doc, /no tool by that name is assumed|send its link/i);
  assert.doesNotMatch(doc, /Tesbit.*integrat/i);
});

test("play-store-apps example is a curated, honest list", () => {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "config", "play-store-apps.example.json"), "utf8"));
  assert.ok(Array.isArray(cfg.apps) && cfg.apps.length >= 6);
  const names = cfg.apps.map((a) => a.playStore);
  for (const n of ["Chrome", "Google Maps", "YouTube", "Gmail", "Google Drive"]) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
  assert.match(cfg.comment, /auto-update/i);
  assert.match(cfg.comment, /bypass/i);
});
