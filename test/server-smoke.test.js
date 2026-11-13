import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package.json has the required scripts and deps", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "atlas");
  assert.equal(pkg.version, "1.0.2-alpha");
  assert.equal(pkg.scripts["list-tools"], "node scripts/list-tools.js");
  assert.equal(pkg.scripts["update-deps"], "bash scripts/update-deps.sh");
  assert.equal(pkg.scripts.start, "node server/index.js");
  assert.equal(pkg.scripts["start:http"], "node server/index.js --http");
  assert.match(pkg.scripts.test, /node --test/);
  assert.ok(pkg.dependencies["@modelcontextprotocol/sdk"]);
  assert.ok(pkg.dependencies.playwright);
  assert.ok(pkg.dependencies.zod);
});

test("server files exist", () => {
  assert.ok(existsSync(path.join(ROOT, "server/index.js")));
  assert.ok(existsSync(path.join(ROOT, "server/guard.js")));
  assert.ok(existsSync(path.join(ROOT, "server/artemis.js")));
  assert.ok(existsSync(path.join(ROOT, "server/platforms.js")));
  assert.ok(existsSync(path.join(ROOT, "server/modes.js")));
  assert.ok(existsSync(path.join(ROOT, "server/live-view.html")));
  assert.ok(existsSync(path.join(ROOT, "scripts/list-tools.js")));
  assert.ok(existsSync(path.join(ROOT, "scripts/update-deps.sh")));
});

test("live-view.html serves the Live View UI", () => {
  const html = readFileSync(path.join(ROOT, "server/live-view.html"), "utf8");
  assert.match(html, /LIVE/);
  assert.match(html, /\/latest\.png/);
  assert.match(html, /\/events/);
  assert.match(html, /\/status/);
});

test("SKILL.md exists at root and under .agents/skills", () => {
  for (const p of ["SKILL.md", ".agents/skills/live-browser/SKILL.md"]) {
    assert.ok(existsSync(path.join(ROOT, p)), p);
    const text = readFileSync(path.join(ROOT, p), "utf8");
    assert.match(text, /name: atlas/);
    assert.match(text, /never pays/i);
    assert.match(text, /Atlas/);
  }
  // The two copies must stay in sync.
  const a = readFileSync(path.join(ROOT, "SKILL.md"), "utf8");
  const b = readFileSync(path.join(ROOT, ".agents/skills/live-browser/SKILL.md"), "utf8");
  assert.equal(a, b);
});

test("docs and deploy files exist", () => {
  for (const p of [
    "docs/LOVABLE.md",
    "docs/REPLIT.md",
    "docs/CLAUDE-CODE.md",
    "docs/CURSOR.md",
    "docs/ARTEMIS.md",
    "docs/PLATFORMS.md",
    "docs/LIVE-TEST.md",
    "docs/MODEL-ROUTER.md",
    "docs/FREE-MODELS.md",
    "docs/MULTI-AGENT.md",
    "docs/PLUGINS.md",
    "docs/CODE-TOOLS.md",
    "docs/FAMOUS-TOOLS.md",
    "docs/DESIGN.md",
    "docs/CONNECTIONS.md",
    "docs/UPDATES.md",
    "NAME.md",
    "config/model-router.example.json",
    "config/agents.example.json",
    "config/play-store-apps.example.json",
    "plugins/registry.example.json",
    "deploy/Dockerfile",
    "deploy/railway.md",
    "deploy/render.md",
    "FEATURES.md",
    "README.md",
    "LICENSE",
    "SECURITY.md",
    ".env.example",
    ".gitignore",
  ]) {
    assert.ok(existsSync(path.join(ROOT, p)), p);
  }
});

test("server source declares the payment guard and the MCP tools", () => {
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  for (const tool of [
    "browser_start",
    "browser_navigate",
    "browser_snapshot",
    "browser_click",
    "browser_type",
    "browser_press",
    "browser_screenshot",
    "browser_status",
    "browser_google_signin",
    "browser_stop",
    // Wave 2 tools
    "browser_tabs",
    "browser_full_screenshot",
    "browser_extract_text",
    "browser_set_viewport",
    // Wave 3 + final tools
    "browser_sitemap",
    "browser_pause",
    "browser_resume",
    "browser_mode",
    "phone_status",
    "windows_status",
    "iphone_status",
  ]) {
    assert.ok(src.includes(`"${tool}"`), `missing tool ${tool}`);
  }
  assert.match(src, /checkNavigation/);
  assert.match(src, /checkTyping/);
  assert.match(src, /checkSensitive/);
  assert.match(src, /checkStepLimit/);
  assert.match(src, /checkDomains/);
  assert.match(src, /LIVE_BROWSER_READONLY/);
  assert.match(src, /LIVE_BROWSER_MAX_STEPS/);
  assert.match(src, /StreamableHTTPServerTransport/);
  assert.match(src, /StdioServerTransport/);
  assert.match(src, /launchPersistentContext/);
  // REST API
  assert.match(src, /\/api\/navigate/);
  assert.match(src, /\/api\/screenshot/);
  assert.match(src, /\/api\/status/);
  // Session recording + error log
  assert.match(src, /session-/);
  assert.match(src, /errorLog/);
});
