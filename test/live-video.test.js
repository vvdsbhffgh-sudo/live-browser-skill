import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("live video: CDP screencast wired to an MJPEG endpoint", () => {
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  // CDP screencast (works on every Playwright version; no 1.59 API needed).
  assert.match(src, /Page\.startScreencast/);
  assert.match(src, /Page\.screencastFrame/);
  assert.match(src, /Page\.screencastFrameAck/);
  assert.match(src, /newCDPSession/);
  assert.match(src, /stopScreencast/);
  // MJPEG endpoint serving the frames.
  assert.match(src, /\/video\.mjpeg/);
  assert.match(src, /multipart\/x-mixed-replace/);
  assert.match(src, /atlasframe/);
  assert.match(src, /videoClients/);
  // Status reports the video stream and viewer count.
  assert.match(src, /liveVideo:/);
  assert.match(src, /videoLive:/);
  assert.match(src, /videoViewers:/);
});

test("live video: Live View page streams it, with a still fallback", () => {
  const html = readFileSync(path.join(ROOT, "server/live-view.html"), "utf8");
  assert.match(html, /src="\/video\.mjpeg"/);
  assert.match(html, /\/latest\.png/); // fallback when the stream is unavailable
  assert.match(html, /id="c-video"/); // video status shown in the status cards (Alpha 3.1)
  assert.match(html, /فيديو مباشر/);
});

test("public host: no localhost links on a hosted deploy", () => {
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  assert.match(src, /RAILWAY_PUBLIC_DOMAIN/);
  assert.match(src, /ATLAS_PUBLIC_URL/);
  assert.match(src, /PUBLIC_BASE/);
  // Status and tool messages use the public base, not a hardcoded localhost.
  assert.match(src, /liveView: `\$\{PUBLIC_BASE\}\/`/);
  assert.match(src, /mcpEndpoint: `\$\{PUBLIC_BASE\}\/mcp`/);
  assert.match(src, /liveVideo: `\$\{PUBLIC_BASE\}\/video\.mjpeg`/);
  assert.doesNotMatch(src, /liveView: `http:\/\/localhost:/);
  assert.doesNotMatch(src, /mcpEndpoint: `http:\/\/localhost:/);
});

test("human checks: detected, surfaced, paused — never solved or bypassed", () => {
  const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");
  assert.match(src, /detectChallenge/);
  assert.match(src, /checkChallenge/);
  assert.match(src, /just a moment/i);
  assert.match(src, /__cf_chl_/);
  assert.match(src, /challenge_detected/);
  assert.match(src, /never solves a human check/i);
  // No solver, no stealth-bypass, no captcha service anywhere in the server.
  assert.doesNotMatch(src, /2captcha|captchasolver|anti-captcha/i);
  assert.doesNotMatch(src, /puppeteer-extra|stealth/i);
  const html = readFileSync(path.join(ROOT, "server/live-view.html"), "utf8");
  assert.match(html, /id="challenge"/);
  assert.match(html, /لا يحلّ اختبار/);
  assert.match(html, /challenge/);
});
