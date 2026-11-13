import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkNavigation,
  checkSecureUrl,
  isLocalhostUrl,
  isSecureUrl,
} from "../server/guard.js";
import { artemisStatus } from "../server/artemis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("version is 1.0.2-alpha", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.version, "1.0.2-alpha");
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  assert.match(src, /1\.0\.2-alpha/);
});

test("HTTPS-only: plain http refused except localhost", () => {
  assert.equal(isSecureUrl("https://example.com/"), true);
  assert.equal(isSecureUrl("http://localhost:3000/dashboard"), true);
  assert.equal(isSecureUrl("http://127.0.0.1:3100/"), true);
  assert.equal(isSecureUrl("http://example.com/"), false);
  assert.equal(isSecureUrl("http://192.168.1.5/"), false);
  assert.equal(isLocalhostUrl("http://localhost:3000/"), true);
  assert.equal(isLocalhostUrl("https://example.com/"), false);
  assert.equal(checkSecureUrl("http://example.com/").ok, false);
  assert.match(checkSecureUrl("http://example.com/").reason, /HTTPS only/);
  assert.equal(checkSecureUrl("https://example.com/").ok, true);
  assert.equal(checkSecureUrl("http://localhost:3000/").ok, true);
});

test("checkNavigation enforces HTTPS-only (localhost still allowed)", () => {
  assert.equal(checkNavigation("http://example.com/").ok, false);
  assert.match(checkNavigation("http://example.com/").reason, /HTTPS only/);
  assert.equal(checkNavigation("https://example.com/").ok, true);
  assert.equal(checkNavigation("http://localhost:3000/dashboard").ok, true);
  // Payment guard still runs: https checkout is still refused.
  assert.equal(checkNavigation("https://example.com/checkout").ok, false);
});

test("no insecure TLS flag anywhere in the server", () => {
  for (const file of ["server/index.js", "server/guard.js", "server/artemis.js"]) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /rejectUnauthorized\s*:\s*false/);
    assert.doesNotMatch(src, /ignore-certificate-errors/);
  }
});

test("Wave 3 tools are registered in the server", () => {
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  for (const tool of [
    "browser_sitemap",
    "browser_pause",
    "browser_resume",
    "phone_status",
  ]) {
    assert.ok(src.includes(`"${tool}"`), `missing tool ${tool}`);
  }
  assert.match(src, /\/api\/pause/);
  assert.match(src, /\/api\/resume/);
  assert.match(src, /\/api\/record/);
  assert.match(src, /pausedGuard/);
});

test("phone_status is not-configured without ARTEMIS_MCP_URL", () => {
  const status = artemisStatus({});
  assert.equal(status.configured, false);
  assert.equal(status.status, "not-configured");
  assert.equal(status.mcpUrl, null);
});

test("phone_status is configured when ARTEMIS_MCP_URL is set", () => {
  const status = artemisStatus({ ARTEMIS_MCP_URL: "http://localhost:8000/mcp" });
  assert.equal(status.configured, true);
  assert.equal(status.status, "configured");
  assert.equal(status.mcpUrl, "http://localhost:8000/mcp");
});

test("Wave 3 docs and configs exist", () => {
  for (const p of [
    "NAME.md",
    "docs/ARTEMIS.md",
    "docs/MODEL-ROUTER.md",
    "docs/MULTI-AGENT.md",
    "docs/PLUGINS.md",
    "config/model-router.example.json",
    "config/agents.example.json",
    "plugins/registry.example.json",
    "server/artemis.js",
  ]) {
    assert.ok(existsSync(path.join(ROOT, p)), p);
  }
});

test("model router states the real OpenRouter free limits, never unlimited", () => {
  const doc = readFileSync(path.join(ROOT, "docs/MODEL-ROUTER.md"), "utf8");
  assert.match(doc, /20 requests per minute/);
  assert.match(doc, /50 requests per day/);
  assert.match(doc, /1,000 requests per day after \$10 lifetime purchases/);
  assert.doesNotMatch(doc, /unlimited 24/i);
  assert.doesNotMatch(doc, /unlimited free/i);
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "config/model-router.example.json"), "utf8"));
  assert.equal(cfg.limits.openrouter_free.perMinute, 20);
  assert.equal(cfg.limits.openrouter_free.perDay, 50);
  assert.equal(cfg.limits.openrouter_free.perDayAfter10UsdLifetime, 1000);
  assert.equal(cfg.limits.neverAutoUpgradeToPaid, true);
  assert.ok(cfg.routes.code && cfg.routes.chat && cfg.routes.vision);
});

test("multi-agent docs state plainly the AI cannot create Gmail accounts", () => {
  const doc = readFileSync(path.join(ROOT, "docs/MULTI-AGENT.md"), "utf8");
  assert.match(doc, /CANNOT create a Gmail account/i);
  assert.match(doc, /human phone verification/i);
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "config/agents.example.json"), "utf8"));
  assert.ok(Array.isArray(cfg.agents) && cfg.agents.length >= 2);
  for (const agent of cfg.agents) {
    assert.ok(agent.browserProfile);
    assert.ok(agent.googleAccount);
    assert.ok(agent.port);
  }
});

test("FEATURES.md has Now / Next / Never and the hard Never lines", () => {
  const doc = readFileSync(path.join(ROOT, "FEATURES.md"), "utf8");
  assert.match(doc, /## ✅ Now/);
  assert.match(doc, /## 📋 Next/);
  assert.match(doc, /## 🚫 Never/);
  assert.match(doc, /Bypassing CAPTCHA/i);
  assert.match(doc, /Automatic Gmail creation/i);
  assert.match(doc, /Unlimited.*free models/i);
  assert.match(doc, /Merging all trending AI repos/i);
  assert.match(doc, /20 requests\/minute, 50\/day, 1,000\/day/);
});

test("NAME.md lists the four candidates", () => {
  const doc = readFileSync(path.join(ROOT, "NAME.md"), "utf8");
  for (const name of ["Baseer", "Nafitha", "Ayn", "Atlas"]) {
    assert.ok(doc.includes(name), name);
  }
});

test("Live View has Pause / Resume / Record buttons", () => {
  const html = readFileSync(path.join(ROOT, "server/live-view.html"), "utf8");
  assert.match(html, /btn-pause/);
  assert.match(html, /btn-resume/);
  assert.match(html, /btn-record/);
  assert.match(html, /\/api\/pause/);
  assert.match(html, /\/api\/resume/);
  assert.match(html, /\/api\/record/);
});

test("README has the Arabic section and the honest-limits section", () => {
  const doc = readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(doc, /بالعربي/);
  assert.match(doc, /Honest limits/);
  assert.match(doc, /1\.0\.2-alpha/);
  assert.match(doc, /ARTEMIS\.md/);
  assert.match(doc, /MODEL-ROUTER\.md/);
});
