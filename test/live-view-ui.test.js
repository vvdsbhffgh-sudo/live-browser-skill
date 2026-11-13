import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(ROOT, "server/live-view.html"), "utf8");
const server = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("package is Atlas, Alpha 3.1", () => {
  assert.equal(pkg.version, "1.0.3-alpha.1");
  assert.equal(pkg.name, "atlas");
});

test("Live View is Arabic-first and organized", () => {
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /العرض المباشر للمتصفح/);
  // Organized sections: status cards, video, log, errors, how-to.
  for (const id of ["c-browser", "c-title", "c-steps", "c-steps-bar", "c-mode", "c-video"]) {
    assert.ok(html.includes(`id="${id}"`), `missing status card ${id}`);
  }
  assert.match(html, /سجل الإجراءات/);
  assert.match(html, /الأخطاء/);
  assert.match(html, /إزاي تستخدم الصفحة دي/);
});

test("Live View has user controls: navigate box, screenshot, pause/resume/record", () => {
  assert.match(html, /id="nav-url"/);
  assert.match(html, /id="btn-nav"/);
  assert.match(html, /id="btn-shot"/);
  assert.match(html, /id="btn-pause"/);
  assert.match(html, /id="btn-resume"/);
  assert.match(html, /id="btn-record"/);
  assert.match(html, /api\/navigate/);
  assert.match(html, /api\/screenshot/);
});

test("Live View explains itself: last action in Arabic, empty state, connection indicator", () => {
  assert.match(html, /id="last-action"/);
  assert.match(html, /آخر خطوة/);
  assert.match(html, /تشغيل المتصفح/);
  assert.match(html, /فتح صفحة/);
  assert.match(html, /id="empty-state"/);
  assert.match(html, /المتصفح مش شغال لسه/);
  assert.match(html, /id="conn-dot"/);
  assert.match(html, /id="challenge"/);
  assert.match(html, /لا يحلّ اختبار/);
});

test("Live View streams video with fallback and no localhost hardcode", () => {
  assert.match(html, /src="\/video\.mjpeg"/);
  assert.match(html, /latest\.png/);
  assert.doesNotMatch(html, /localhost/);
});

test("server navigate timeouts raised to 60s for slow first loads", () => {
  const hits = server.match(/timeout: 60000/g) || [];
  assert.ok(hits.length >= 4, `expected >= 4 goto timeouts at 60s, got ${hits.length}`);
  assert.doesNotMatch(server, /timeout: 30000/);
});

test("server version is Alpha 3.1 everywhere it is printed", () => {
  assert.ok(server.includes('"1.0.3-alpha.1"'));
  const count = (server.match(/1\.0\.3-alpha\.1/g) || []).length;
  assert.ok(count >= 2, `expected >= 2 version strings in server, got ${count}`);
});

test("human-check research is documented and no bypass tool is in the server", () => {
  const doc = readFileSync(path.join(ROOT, "docs/HUMAN-CHECKS.md"), "utf8");
  assert.match(doc, /2Captcha/);
  assert.match(doc, /CapSolver/);
  assert.match(doc, /stealth/i);
  assert.match(doc, /does NOT add/i);
  assert.doesNotMatch(server, /2captcha|anti-captcha|capsolver|puppeteer-extra|undetected-chromedriver|nodriver|camoufox/i);
});
