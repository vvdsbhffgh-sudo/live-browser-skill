// Atlas — MCP server + Live View.
//
// One file, two transports:
//   * stdio (default)  — Claude Code, Cursor, local agents.
//   * Streamable HTTP  — `node server/index.js --http`, port LIVE_BROWSER_PORT
//                         (default 3100). Serves the MCP endpoint at /mcp and
//                         the Live View UI at / and /live (SSE /events,
//                         screenshot /latest.png, status /status).
//
// The browser is a persistent Chromium profile (Playwright
// launchPersistentContext). Google sign-in is MANUAL, once, by the user, in
// a visible browser window, with a DEDICATED Google account (never a main
// personal account). No password is ever typed, stored, or sent to the AI.
//
// HARD RULE — Atlas never pays. Every navigation / click / typing goes
// through server/guard.js first. See SECURITY.md and README.md.

import { createServer as createHttpServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import {
  checkAction,
  checkDomains,
  checkNavigation,
  checkSecureUrl,
  checkSensitive,
  checkStepLimit,
  checkTyping,
  parseDomainList,
  PAYMENT_REFUSAL,
} from "./guard.js";
import { artemisStatus, checkArtemisReachable } from "./artemis.js";
import { windowsStatus, iphoneStatus } from "./platforms.js";
import {
  DEFAULT_MODE,
  isToolAllowedInMode,
  loadModes,
  modeMaxSteps,
} from "./modes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.LIVE_BROWSER_PORT || 3100);
// Public base URL for links shown to the user. On Railway the platform sets
// RAILWAY_PUBLIC_DOMAIN automatically; ATLAS_PUBLIC_URL overrides it for
// any other host. Never report localhost on a hosted deploy — a phone
// clicking http://localhost:3100/ reaches itself, not this server.
const PUBLIC_BASE =
  process.env.ATLAS_PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : null) ||
  `http://localhost:${PORT}`;
const PROFILE_DIR = process.env.LIVE_BROWSER_PROFILE
  ? path.resolve(process.env.LIVE_BROWSER_PROFILE)
  : path.join(ROOT, ".live-browser-profile");
const HEADED = process.env.LIVE_BROWSER_HEADED === "1";
const LIVE_DIR = path.join(ROOT, "live");
const LATEST_PNG = path.join(LIVE_DIR, "latest.png");

// Wave 2 env config (read live from process.env so a restart picks them up).
const READONLY = () => process.env.LIVE_BROWSER_READONLY === "1";
const ALLOW_SENSITIVE = () => process.env.LIVE_BROWSER_ALLOW_SENSITIVE === "1";
const MAX_STEPS = () => Number(process.env.LIVE_BROWSER_MAX_STEPS || 100);
const domainLists = () => ({
  allowed: parseDomainList(process.env.LIVE_BROWSER_ALLOWED_DOMAINS || ""),
  blocked: parseDomainList(process.env.LIVE_BROWSER_BLOCKED_DOMAINS || ""),
});

const startedAt = new Date().toISOString();
const actionLog = []; // { time, tool, args, result }
const errorLog = []; // { time, kind, message, url } — console/page/network errors
const sseClients = new Set();
let latestScreenshot = null; // Buffer | null
let stepCount = 0; // mutating browser actions in this session

// Live video (CDP screencast -> MJPEG): a real moving picture of the
// browser, streamed to the Live View. Frames are JPEGs from the renderer;
// MJPEG carries picture only — there is no audio channel in a browser
// screencast, and Atlas never adds one.
const videoClients = new Set(); // HTTP responses streaming multipart frames
let cdpSession = null;
let cdpPage = null;
let lastFrame = null; // Buffer | null — most recent screencast frame

// Human-check state: when a page shows a "are you human?" challenge
// (Cloudflare "Just a moment..." etc.), Atlas pauses and surfaces it —
// it never solves, clicks through, or bypasses the check.
let challengeActive = false;

function broadcastFrame(buf) {
  lastFrame = buf;
  latestScreenshot = buf;
  const head = Buffer.from(
    `--atlasframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`,
  );
  for (const res of videoClients) {
    try {
      res.write(head);
      res.write(buf);
      res.write("\r\n");
    } catch {
      // Client gone; cleaned up on 'close'.
    }
  }
}

async function startScreencast() {
  if (!page || cdpSession) return;
  try {
    cdpSession = await page.context().newCDPSession(page);
    cdpPage = page;
    cdpSession.on("Page.screencastFrame", async (params) => {
      try {
        broadcastFrame(Buffer.from(params.data, "base64"));
      } finally {
        await cdpSession
          ?.send("Page.screencastFrameAck", { sessionId: params.sessionId })
          .catch(() => {
            // Session died mid-stream; clear it so the next watch restarts it.
            cdpSession = null;
            cdpPage = null;
          });
      }
    });
    await cdpSession.send("Page.startScreencast", {
      format: "jpeg",
      quality: 55,
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 2,
    });
  } catch {
    cdpSession = null;
    cdpPage = null;
  }
}

async function stopScreencast() {
  if (!cdpSession) return;
  const s = cdpSession;
  cdpSession = null;
  cdpPage = null;
  await s.send("Page.stopScreencast").catch(() => {});
  await s.detach().catch(() => {});
}

/** Run the screencast only while someone is watching the Live View. */
async function ensureScreencast() {
  if (!page) return;
  if (cdpPage !== page) await stopScreencast();
  if (videoClients.size > 0 && !cdpSession) await startScreencast();
  if (videoClients.size === 0 && cdpSession) await stopScreencast();
}

/** Page title with a timeout — a stuck page must never hang a request. */
async function titleWithTimeout(pg, ms = 3000) {
  try {
    return await Promise.race([
      pg.title(),
      new Promise((resolve) => setTimeout(() => resolve(""), ms)),
    ]);
  } catch {
    return "";
  }
}

const CHALLENGE_PATTERNS = [
  /just a moment/i,
  /attention required/i,
  /verify you are human/i,
  /are you a robot/i,
  /checking your browser/i,
  /please verify/i,
];

async function detectChallenge() {
  if (!page) return null;
  try {
    const url = page.url();
    const title = await titleWithTimeout(page);
    if (url.includes("__cf_chl_") || url.includes("/cdn-cgi/challenge")) {
      return { kind: "cloudflare", detail: title || "Cloudflare human check" };
    }
    if (CHALLENGE_PATTERNS.some((re) => re.test(title))) {
      return { kind: "human-check", detail: title };
    }
  } catch {}
  return null;
}

/** On a human check: surface it in the Live View and pause the agent.
 * Atlas never solves, clicks through, or bypasses a human check — a human
 * solves it once in a visible browser, or the agent goes elsewhere. */
async function checkChallenge(source) {
  const hit = await detectChallenge();
  if (hit && !challengeActive) {
    challengeActive = true;
    paused = true;
    broadcast({
      type: "challenge",
      url: await currentUrl(),
      reason: hit.detail,
      time: new Date().toISOString(),
    });
    broadcast({ type: "paused", time: new Date().toISOString() });
    logAction(
      "challenge_detected",
      { source },
      `Human check on ${await currentUrl()}: ${hit.detail}. Browser paused — Atlas never solves a human check; a human solves it in a visible browser.`,
    );
  } else if (!hit && challengeActive) {
    challengeActive = false;
    broadcast({ type: "challenge_cleared", time: new Date().toISOString() });
  }
  return hit;
}

// Wave 3 state: pause stops mutating browser actions (read-only tools keep
// working); recording gates the session file + per-action screenshots.
// Recording (screenshots + action log saved to live/) starts and stops only
// on the user's command — via the Live View Record button, browser_pause /
// browser_resume, or POST /api/record. Nothing is recorded silently.
let paused = false;
let recording = true;

// Modes library (config/modes/*.json, built-in defaults as fallback).
// A mode narrows what the agent may do; it never widens past a guard.
const MODES = loadModes(ROOT);
let currentModeName = process.env.ATLAS_MODE || DEFAULT_MODE;
if (!MODES.has(currentModeName)) currentModeName = DEFAULT_MODE;
const currentMode = () => MODES.get(currentModeName);
/** Effective step budget: the current mode's limit, else the env default. */
const effectiveMaxSteps = () => modeMaxSteps(currentMode(), MAX_STEPS());

// Human approval for sensitive actions, granted in this session only by
// the user pressing Approve in the Dashboard (POST /api/approve). It never
// persists to disk and never survives a restart.
let sessionAllowSensitive = false;
/** True when sensitive actions are allowed: env flag OR this session's approval. */
const effectiveAllowSensitive = () => ALLOW_SENSITIVE() || sessionAllowSensitive;

// Config snapshots for the Dashboard (read once at startup, best-effort):
// agents list + model-router routes. The Dashboard shows them with live
// probes of its own; these are config, not live state.
function loadJsonConfig(name, fallbackName) {
  for (const file of [path.join(ROOT, "config", name), path.join(ROOT, "config", fallbackName)]) {
    try {
      if (existsSync(file)) {
        return { data: JSON.parse(readFileSync(file, "utf8")), source: path.basename(file) };
      }
    } catch {
      // Invalid JSON -> try the fallback, then give up (null).
    }
  }
  return { data: null, source: null };
}
const AGENTS_CONFIG = loadJsonConfig("agents.json", "agents.example.json");
const ROUTER_CONFIG = loadJsonConfig("model-router.json", "model-router.example.json");

// Session recording: live/session-<timestamp>.json + shot files next to it.
const SESSION_ID = new Date().toISOString().replace(/[:.]/g, "-");
const SESSION_FILE = path.join(LIVE_DIR, `session-${SESSION_ID}.json`);
let screenshotSeq = 0;

// ---------------------------------------------------------------------------
// Browser state
// ---------------------------------------------------------------------------
let context = null;
let page = null;
/** ref (string) -> { selector, text, role } for the last snapshot. */
let refMap = new Map();

function logAction(tool, args, result) {
  const entry = {
    time: new Date().toISOString(),
    tool,
    args: summariseArgs(args),
    result: String(result ?? "").slice(0, 500),
  };
  actionLog.push(entry);
  if (actionLog.length > 200) actionLog.shift();
  broadcast({ type: "action", ...entry });
  saveSession();
  return entry;
}

/** Persist the session recording (action log + errors + step count).
 * Best-effort, and only while recording is on (the user can stop it from
 * the Live View). Never breaks the browser for it. */
function saveSession() {
  if (!recording) return;
  try {
    mkdirSync(LIVE_DIR, { recursive: true });
    writeFileSync(
      SESSION_FILE,
      JSON.stringify(
        {
          session: SESSION_ID,
          startedAt,
          updatedAt: new Date().toISOString(),
          profile: PROFILE_DIR,
          steps: stepCount,
          maxSteps: effectiveMaxSteps(),
          actions: actionLog,
          errors: errorLog,
        },
        null,
        2,
      ),
    );
  } catch {
    // Session recording is best-effort; never break the browser for it.
  }
}

function logError(kind, message, url = "") {
  const entry = {
    time: new Date().toISOString(),
    kind,
    message: String(message ?? "").slice(0, 500),
    url: String(url ?? "").slice(0, 500),
  };
  errorLog.push(entry);
  if (errorLog.length > 100) errorLog.shift();
  broadcast({ type: "error", ...entry });
  saveSession();
  return entry;
}

/** Refuse when the step budget is spent. Returns a reason string or null. */
function stepGuard() {
  const check = checkStepLimit(stepCount, effectiveMaxSteps());
  return check.ok ? null : check.reason;
}

/** Count one mutating step; call after the step guard passed. */
function countStep() {
  stepCount += 1;
}

/** Domain-list guard for a URL. Returns a reason string or null. */
function domainGuard(url) {
  const { allowed, blocked } = domainLists();
  const check = checkDomains(url, allowed, blocked);
  return check.ok ? null : check.reason;
}

/** Read-only guard for click/type. Returns a reason string or null. */
function readonlyGuard() {
  if (currentMode()?.readonly) {
    return `Read-only mode is on for the current mode (${currentModeName}): clicking and typing are disabled. Switch modes with browser_mode to allow edits.`;
  }
  return READONLY()
    ? "Read-only mode is on (LIVE_BROWSER_READONLY=1): clicking and typing are disabled. Unset it to allow edits."
    : null;
}

/** Mode guard for a mutating tool. Returns a reason string or null. */
function modeGuard(tool) {
  return isToolAllowedInMode(currentMode(), tool)
    ? null
    : `Blocked by the current mode (${currentModeName}): ${tool} is not allowed in this mode. ` +
      `Use browser_mode to view the mode's allowed tools or switch modes.`;
}

/** Human pace: a short delay before acting, like a person — not a
 * machine-gun burst. Legitimate pacing only; it does not hide automation
 * and never bypasses any human check (see SECURITY.md). */
function humanPace(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pause guard for mutating tools. Returns a reason string or null. */
function pausedGuard() {
  return paused
    ? "Paused: the browser is paused by the user. Call browser_resume (or press Resume in the Live View) to continue. Read-only tools (snapshot, screenshot, status, sitemap) still work while paused."
    : null;
}

function statusSnapshot() {
  return {
    name: "atlas",
    version: "1.0.3-alpha",
    startedAt,
    port: PORT,
    headed: HEADED,
    readonly: READONLY(),
    mode: currentModeName,
    modelRoute: currentMode()?.modelRoute ?? null,
    maxSteps: effectiveMaxSteps(),
    steps: stepCount,
    browserRunning: Boolean(page),
    url: page ? page.url() : null,
    tabs: context ? context.pages().length : 0,
    actions: actionLog.length,
    errors: errorLog.slice(-20),
    recentActions: actionLog.slice(-20),
    sessionFile: SESSION_FILE,
    liveView: `${PUBLIC_BASE}/`,
    liveVideo: `${PUBLIC_BASE}/video.mjpeg`,
    videoLive: Boolean(cdpSession),
    videoViewers: videoClients.size,
    challenge: challengeActive,
    mcpEndpoint: `${PUBLIC_BASE}/mcp`,
    paused,
    recording,
    allowSensitive: effectiveAllowSensitive(),
    phone: artemisStatus(),
    windows: windowsStatus(),
    iphone: iphoneStatus(),
    agents: AGENTS_CONFIG.data?.agents ?? [],
    agentsSource: AGENTS_CONFIG.source,
    modelRouter: ROUTER_CONFIG.data
      ? {
          routes: ROUTER_CONFIG.data.routes ?? {},
          note: "Pooled free models — large pooled credit, never limitless. Rank 1 = strongest for the task.",
        }
      : null,
  };
}

function summariseArgs(args) {
  if (!args || typeof args !== "object") return args ?? null;
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    const s = String(v ?? "");
    // Never log anything that could be a secret or a long blob.
    out[k] = s.length > 120 ? `${s.slice(0, 120)}…` : s;
  }
  return out;
}

function broadcast(payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(line);
    } catch {
      // Client gone; cleaned up on 'close'.
    }
  }
}

async function refreshScreenshot() {
  if (!page) return;
  try {
    const buf = await page.screenshot({ type: "png" });
    latestScreenshot = buf;
    await mkdir(LIVE_DIR, { recursive: true });
    await writeFile(LATEST_PNG, buf);
    screenshotSeq += 1;
    await writeFile(
      path.join(LIVE_DIR, `session-${SESSION_ID}-shot-${String(screenshotSeq).padStart(3, "0")}.png`),
      buf,
    ).catch(() => {});
    broadcast({ type: "screenshot", time: new Date().toISOString() });
  } catch {
    // Screenshot is best-effort; the tool result still stands.
  }
}

/** Attach console / page-error / network-failure listeners to a page. */
function attachPageListeners(pg) {
  pg.on("console", (msg) => {
    if (msg.type() === "error") logError("console", msg.text(), pg.url());
  });
  pg.on("pageerror", (err) => logError("pageerror", err?.message ?? String(err), pg.url()));
  pg.on("requestfailed", (req) =>
    logError("requestfailed", req.failure()?.errorText ?? "request failed", req.url()),
  );
  pg.on("response", (res) => {
    if (res.status() >= 400) logError("http", `HTTP ${res.status()}`, res.url());
  });
  pg.on("frameravigated", () => {
    refreshScreenshot().catch(() => {});
    // A human check can appear on any navigation — surface it, never solve it.
    if (pg === page) checkChallenge("navigation").catch(() => {});
  });
}

async function ensureBrowser() {
  if (context && page) {
    await ensureScreencast();
    return { context, page };
  }
  await mkdir(PROFILE_DIR, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED,
    viewport: { width: 1280, height: 800 },
    args: ["--no-sandbox"],
  });
  page = context.pages()[0] ?? (await context.newPage());
  for (const p of context.pages()) attachPageListeners(p);
  context.on("page", (p) => attachPageListeners(p));
  await ensureScreencast();
  return { context, page };
}

async function currentUrl() {
  return page ? page.url() : "";
}

async function detectGoogleAccount() {
  // Best-effort only: read visible account text, never any password.
  if (!page) return null;
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const signedIn =
      /welcome|hi,|signed in|my account|google account/i.test(text) &&
      !/sign in to continue|sign in with google/i.test(text.slice(0, 500));
    return { email: email?.[0] ?? null, looksSignedIn: Boolean(signedIn) };
  } catch {
    return null;
  }
}

async function buildSnapshot() {
  const { page: pg } = await ensureBrowser();
  const url = pg.url();
  const title = await pg.title().catch(() => "");
  // Interactive elements with stable refs for click/type.
  const elements = await pg
    .evaluate(() => {
      const out = [];
      const nodes = document.querySelectorAll(
        "a, button, input, select, textarea, [role='button'], [role='link'], [contenteditable='true']",
      );
      let i = 0;
      for (const el of nodes) {
        if (i >= 120) break;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const text = (el.innerText || el.value || el.getAttribute("aria-label") || el.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 80);
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute("type") || "";
        const role = el.getAttribute("role") || tag;
        out.push({ ref: String(++i), tag, type, role, text });
      }
      return out;
    })
    .catch(() => []);
  refMap = new Map(elements.map((e) => [e.ref, e]));
  const lines = elements.map(
    (e) => `[ref=${e.ref}] ${e.role}${e.type ? ` (${e.type})` : ""} ${e.text ? `"${e.text}"` : ""}`,
  );
  const tree = await pg
    .accessibility.snapshot()
    .then((snap) => JSON.stringify(snap, null, 2).slice(0, 4000))
    .catch(() => "(accessibility tree unavailable)");
  return [
    `URL: ${url}`,
    `Title: ${title}`,
    ``,
    `Interactive elements (use the ref with browser_click / browser_type):`,
    ...(lines.length ? lines : ["(none found)"]),
    ``,
    `Accessibility tree (truncated):`,
    tree,
  ].join("\n");
}

async function resolveTarget(refOrSelector) {
  const { page: pg } = await ensureBrowser();
  const key = String(refOrSelector ?? "").trim();
  if (refMap.has(key)) {
    const el = refMap.get(key);
    // Re-find by nth interactive element in document order.
    const idx = Number(key) - 1;
    return {
      locator: pg.locator(
        "a, button, input, select, textarea, [role='button'], [role='link'], [contenteditable='true']",
      ).nth(idx),
      text: el.text,
    };
  }
  return { locator: pg.locator(key).first(), text: "" };
}

async function elementText(locator) {
  try {
    return (await locator.innerText({ timeout: 2000 }).catch(() => "")) || "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// MCP server factory (a fresh server per transport so HTTP stays stateless)
// ---------------------------------------------------------------------------
function createMcpServer() {
  const server = new McpServer({
    name: "atlas",
    version: "1.0.3-alpha",
  });

  server.registerTool(
    "browser_start",
    { title: "Start browser", description: "Start (or reuse) the persistent Chromium browser and report its status and the Live View URL.", inputSchema: {} },
    async () => {
      await ensureBrowser();
      const url = await currentUrl();
      const msg = `Browser ready. Current URL: ${url || "(blank)"}. Live View: ${PUBLIC_BASE}/`;
      logAction("browser_start", {}, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_navigate",
    { title: "Navigate", description: "Navigate the browser to an http(s) URL. Checkout/payment URLs are always refused.", inputSchema: { url: z.string().describe("http(s) URL to open") } },
    async ({ url }) => {
      const check = checkNavigation(url);
      if (!check.ok) {
        logAction("browser_navigate", { url }, check.reason);
        return { content: [{ type: "text", text: check.reason }], isError: true };
      }
      const blocked = domainGuard(url);
      if (blocked) {
        logAction("browser_navigate", { url }, blocked);
        return { content: [{ type: "text", text: blocked }], isError: true };
      }
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_navigate", { url }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_navigate");
      if (modeBlocked) {
        logAction("browser_navigate", { url }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_navigate", { url }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      countStep();
      const { page: pg } = await ensureBrowser();
      await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const challenge = await checkChallenge("browser_navigate");
      const msg =
        `Navigated to ${pg.url()} — ${await titleWithTimeout(pg)}` +
        (challenge
          ? `\nNote: this page shows a human check (${challenge.detail}). Atlas paused here and will not solve it — solve it once in a visible browser, or navigate elsewhere.`
          : "");
      logAction("browser_navigate", { url }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_snapshot",
    { title: "Snapshot", description: "Return the current page as an accessibility tree plus interactive elements with refs for browser_click / browser_type.", inputSchema: {} },
    async () => {
      const snap = await buildSnapshot();
      logAction("browser_snapshot", {}, `snapshot of ${await currentUrl()}`);
      await refreshScreenshot();
      return { content: [{ type: "text", text: snap }] };
    },
  );

  server.registerTool(
    "browser_click",
    { title: "Click", description: "Click an element by snapshot ref (e.g. \"3\") or CSS selector. Payment elements are always refused.", inputSchema: { ref: z.string().describe("Snapshot ref number or CSS selector") } },
    async ({ ref }) => {
      const ro = readonlyGuard();
      if (ro) {
        logAction("browser_click", { ref }, ro);
        return { content: [{ type: "text", text: ro }], isError: true };
      }
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_click", { ref }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_click");
      if (modeBlocked) {
        logAction("browser_click", { ref }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const { locator, text: knownText } = await resolveTarget(ref);
      const url = await currentUrl();
      const text = knownText || (await elementText(locator));
      const check = checkAction({ url, text });
      if (!check.ok) {
        logAction("browser_click", { ref }, check.reason);
        return { content: [{ type: "text", text: check.reason }], isError: true };
      }
      const sensitive = checkSensitive(text, effectiveAllowSensitive());
      if (!sensitive.ok) {
        logAction("browser_click", { ref }, sensitive.reason);
        return { content: [{ type: "text", text: sensitive.reason }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_click", { ref }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      countStep();
      await humanPace();
      await locator.click({ timeout: 10000 });
      await new Promise((r) => setTimeout(r, 800));
      // A click may navigate somewhere new — a blocked domain is refused
      // after the fact by going back.
      const afterUrl = await currentUrl();
      const blocked = domainGuard(afterUrl);
      if (blocked) {
        await page.goBack().catch(() => {});
        const msg = `${blocked} Went back to ${await currentUrl()}.`;
        logAction("browser_click", { ref }, msg);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      const msg = `Clicked ${ref} (${text.slice(0, 80) || "element"}). Now at ${afterUrl}`;
      logAction("browser_click", { ref }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_type",
    { title: "Type", description: "Type text into an element by snapshot ref or CSS selector. Card-like numbers (13-19 digits) are always refused.", inputSchema: { ref: z.string().describe("Snapshot ref number or CSS selector"), text: z.string().describe("Text to type") } },
    async ({ ref, text }) => {
      const ro = readonlyGuard();
      if (ro) {
        logAction("browser_type", { ref }, ro);
        return { content: [{ type: "text", text: ro }], isError: true };
      }
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_type", { ref }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_type");
      if (modeBlocked) {
        logAction("browser_type", { ref }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const check = checkTyping(text);
      if (!check.ok) {
        logAction("browser_type", { ref }, check.reason);
        return { content: [{ type: "text", text: check.reason }], isError: true };
      }
      const { locator } = await resolveTarget(ref);
      const elText = await elementText(locator);
      const actionCheck = checkAction({ url: await currentUrl(), text: elText });
      if (!actionCheck.ok) {
        logAction("browser_type", { ref }, actionCheck.reason);
        return { content: [{ type: "text", text: actionCheck.reason }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_type", { ref }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      countStep();
      await humanPace();
      await locator.fill(text, { timeout: 10000 }).catch(async () => {
        await locator.click({ timeout: 5000 });
        await locator.pressSequentially(text, { timeout: 10000 });
      });
      const msg = `Typed into ${ref}.`;
      logAction("browser_type", { ref, text }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_press",
    { title: "Press key", description: "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown).", inputSchema: { key: z.string().describe("Key name, e.g. Enter") } },
    async ({ key }) => {
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_press", { key }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_press");
      if (modeBlocked) {
        logAction("browser_press", { key }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_press", { key }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      countStep();
      const { page: pg } = await ensureBrowser();
      await pg.keyboard.press(key);
      await new Promise((r) => setTimeout(r, 500));
      const msg = `Pressed ${key}. Now at ${await currentUrl()}`;
      logAction("browser_press", { key }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_screenshot",
    { title: "Screenshot", description: "Take a screenshot of the current page. Also saved to live/latest.png and shown in the Live View.", inputSchema: {} },
    async () => {
      const { page: pg } = await ensureBrowser();
      const buf = await pg.screenshot({ type: "png" });
      latestScreenshot = buf;
      await mkdir(LIVE_DIR, { recursive: true });
      await writeFile(LATEST_PNG, buf);
      logAction("browser_screenshot", {}, `screenshot ${buf.length} bytes`);
      broadcast({ type: "screenshot", time: new Date().toISOString() });
      return {
        content: [
          { type: "image", data: buf.toString("base64"), mimeType: "image/png" },
          { type: "text", text: `Screenshot taken (${buf.length} bytes). Live View: ${PUBLIC_BASE}/` },
        ],
      };
    },
  );

  server.registerTool(
    "browser_status",
    { title: "Status", description: "Report browser status: current URL/title, whether a Google account looks signed in, Live View URL, recent actions.", inputSchema: {} },
    async () => {
      const url = await currentUrl();
      const title = page ? await page.title().catch(() => "") : "";
      const google = page && url.includes("google.com") ? await detectGoogleAccount() : null;
      const tabs = context
        ? await Promise.all(
            context.pages().map(async (p, i) => ({
              index: i,
              active: p === page,
              url: p.url(),
              title: await p.title().catch(() => ""),
            })),
          )
        : [];
      const status = {
        running: Boolean(page),
        headed: HEADED,
        readonly: READONLY(),
        steps: stepCount,
        maxSteps: effectiveMaxSteps(),
        profile: PROFILE_DIR,
        url,
        title,
        google,
        tabs,
        errors: errorLog.slice(-20),
        errorCount: errorLog.length,
        sessionFile: SESSION_FILE,
        liveView: `${PUBLIC_BASE}/`,
        liveVideo: `${PUBLIC_BASE}/video.mjpeg`,
        recentActions: actionLog.slice(-10),
      };
      logAction("browser_status", {}, `status: ${url || "(browser not started)"}`);
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    },
  );

  server.registerTool(
    "browser_google_signin",
    {
      title: "Google sign-in",
      description: "Open Google sign-in in the browser so the USER can sign in manually once with a DEDICATED Google account. The AI never sees or types any password.",
      inputSchema: {},
    },
    async () => {
      const { page: pg } = await ensureBrowser();
      await pg.goto("https://accounts.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
      await refreshScreenshot();
      const detected = await detectGoogleAccount();
      const headedNote = HEADED
        ? "The browser window is visible (headed mode)."
        : "The browser is headless right now: restart the server with LIVE_BROWSER_HEADED=1 so the sign-in window is visible on your screen, then call this tool again.";
      const msg = [
        "Google sign-in opened at https://accounts.google.com.",
        "",
        "THE USER signs in manually, once, in the visible browser window:",
        "  1. Use a DEDICATED Google account created for the AI browser — never your main personal account.",
        "  2. Type the password yourself in the browser. Never paste it in chat and never give it to the AI.",
        "  3. Complete any 2-step check yourself. The session is saved in the browser profile and persists across restarts.",
        "",
        headedNote,
        `Live View (watch the sign-in happen): ${PUBLIC_BASE}/`,
        detected?.email
          ? `A Google account already looks signed in: ${detected.email}`
          : "No signed-in Google account detected yet — sign in manually, then call browser_status to confirm.",
      ].join("\n");
      logAction("browser_google_signin", {}, msg.split("\n")[0]);
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_stop",
    { title: "Stop browser", description: "Close the browser. The profile (including the Google session) is kept and reused next time.", inputSchema: {} },
    async () => {
      await stopScreencast();
      if (context) {
        await context.close().catch(() => {});
        context = null;
        page = null;
        refMap = new Map();
      }
      const msg = `Browser closed. Profile kept — the Google session will still be there next time. Session recording saved to ${SESSION_FILE}.`;
      logAction("browser_stop", {}, msg);
      saveSession();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  // ---- Wave 2 tools -------------------------------------------------------

  server.registerTool(
    "browser_tabs",
    {
      title: "Manage tabs",
      description: "List, open, switch to, or close browser tabs. action=list|new|switch|close; index is the tab number from list (0-based); url is used with action=new.",
      inputSchema: {
        action: z.enum(["list", "new", "switch", "close"]).describe("list, new, switch, or close"),
        index: z.number().int().min(0).optional().describe("Tab index (0-based) for switch/close"),
        url: z.string().optional().describe("URL to open for action=new"),
      },
    },
    async ({ action, index, url }) => {
      const { page: pg } = await ensureBrowser();
      const pages = () => context.pages();
      if (action === "list") {
        const tabs = await Promise.all(
          pages().map(async (p, i) => ({
            index: i,
            active: p === page,
            url: p.url(),
            title: await p.title().catch(() => ""),
          })),
        );
        const msg = JSON.stringify(tabs, null, 2);
        logAction("browser_tabs", { action }, `${tabs.length} tab(s)`);
        return { content: [{ type: "text", text: msg }] };
      }
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_tabs", { action }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_tabs");
      if (modeBlocked) {
        logAction("browser_tabs", { action }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_tabs", { action }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      if (action === "new") {
        if (url) {
          const check = checkNavigation(url);
          if (!check.ok) {
            logAction("browser_tabs", { action, url }, check.reason);
            return { content: [{ type: "text", text: check.reason }], isError: true };
          }
          const blocked = domainGuard(url);
          if (blocked) {
            logAction("browser_tabs", { action, url }, blocked);
            return { content: [{ type: "text", text: blocked }], isError: true };
          }
        }
        countStep();
        const p = await context.newPage();
        attachPageListeners(p);
        page = p;
        if (url) await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const msg = `Opened tab ${pages().length - 1}: ${p.url()}`;
        logAction("browser_tabs", { action, url }, msg);
        await refreshScreenshot();
        return { content: [{ type: "text", text: msg }] };
      }
      if (action === "switch") {
        const list = pages();
        if (index == null || index < 0 || index >= list.length) {
          const msg = `No tab ${index}. There are ${list.length} tab(s) (0-${list.length - 1}).`;
          logAction("browser_tabs", { action, index }, msg);
          return { content: [{ type: "text", text: msg }], isError: true };
        }
        countStep();
        page = list[index];
        await page.bringToFront().catch(() => {});
        const msg = `Switched to tab ${index}: ${page.url()}`;
        logAction("browser_tabs", { action, index }, msg);
        await refreshScreenshot();
        return { content: [{ type: "text", text: msg }] };
      }
      // close
      const list = pages();
      if (index == null || index < 0 || index >= list.length) {
        const msg = `No tab ${index}. There are ${list.length} tab(s) (0-${list.length - 1}).`;
        logAction("browser_tabs", { action, index }, msg);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      if (list.length <= 1) {
        const msg = "Cannot close the last tab. Use browser_stop to close the browser.";
        logAction("browser_tabs", { action, index }, msg);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      countStep();
      const closing = list[index];
      const wasActive = closing === page;
      await closing.close();
      if (wasActive) page = context.pages()[0];
      const msg = `Closed tab ${index}. ${context.pages().length} tab(s) left. Active: ${page.url()}`;
      logAction("browser_tabs", { action, index }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_full_screenshot",
    { title: "Full-page screenshot", description: "Screenshot the entire page (not just the viewport). Also updates the Live View.", inputSchema: {} },
    async () => {
      const { page: pg } = await ensureBrowser();
      const buf = await pg.screenshot({ type: "png", fullPage: true });
      latestScreenshot = buf;
      await mkdir(LIVE_DIR, { recursive: true });
      screenshotSeq += 1;
      const file = path.join(LIVE_DIR, `session-${SESSION_ID}-full-${String(screenshotSeq).padStart(3, "0")}.png`);
      await writeFile(file, buf);
      await writeFile(LATEST_PNG, buf);
      logAction("browser_full_screenshot", {}, `full-page screenshot ${buf.length} bytes -> ${file}`);
      broadcast({ type: "screenshot", time: new Date().toISOString() });
      return {
        content: [
          { type: "image", data: buf.toString("base64"), mimeType: "image/png" },
          { type: "text", text: `Full-page screenshot taken (${buf.length} bytes). Saved to ${file}.` },
        ],
      };
    },
  );

  server.registerTool(
    "browser_extract_text",
    { title: "Extract page text", description: "Extract the visible text of the current page (truncated to 20,000 characters) with URL, title, and word count.", inputSchema: {} },
    async () => {
      const { page: pg } = await ensureBrowser();
      const text = await pg.evaluate(() => document.body?.innerText ?? "");
      const words = text.split(/\s+/).filter(Boolean).length;
      const out = [
        `URL: ${pg.url()}`,
        `Title: ${await pg.title().catch(() => "")}`,
        `Words: ${words} (showing first 20,000 characters)`,
        ``,
        text.slice(0, 20000),
      ].join("\n");
      logAction("browser_extract_text", {}, `extracted ${words} words from ${pg.url()}`);
      return { content: [{ type: "text", text: out }] };
    },
  );

  const VIEWPORT_PRESETS = {
    desktop: { width: 1280, height: 800, mobile: false },
    mobile: { width: 390, height: 844, mobile: true },
    tablet: { width: 820, height: 1180, mobile: false },
  };

  server.registerTool(
    "browser_set_viewport",
    {
      title: "Set viewport",
      description: "Resize the browser viewport. Presets: desktop (1280x800), mobile (390x844, touch emulation), tablet (820x1180). Or pass custom width/height.",
      inputSchema: {
        preset: z.enum(["desktop", "mobile", "tablet"]).optional().describe("Preset size"),
        width: z.number().int().min(200).max(4000).optional().describe("Custom width in px"),
        height: z.number().int().min(200).max(4000).optional().describe("Custom height in px"),
      },
    },
    async ({ preset, width, height }) => {
      const isPaused = pausedGuard();
      if (isPaused) {
        logAction("browser_set_viewport", { preset }, isPaused);
        return { content: [{ type: "text", text: isPaused }], isError: true };
      }
      const modeBlocked = modeGuard("browser_set_viewport");
      if (modeBlocked) {
        logAction("browser_set_viewport", { preset }, modeBlocked);
        return { content: [{ type: "text", text: modeBlocked }], isError: true };
      }
      const steps = stepGuard();
      if (steps) {
        logAction("browser_set_viewport", { preset }, steps);
        return { content: [{ type: "text", text: steps }], isError: true };
      }
      countStep();
      const { page: pg } = await ensureBrowser();
      const size = preset
        ? VIEWPORT_PRESETS[preset]
        : { width: width ?? 1280, height: height ?? 800, mobile: false };
      const w = width ?? size.width;
      const h = height ?? size.height;
      const mobile = preset ? size.mobile : false;
      try {
        const cdp = await pg.context().newCDPSession(pg);
        if (mobile) {
          await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: w, height: h, deviceScaleFactor: 2, mobile: true,
          });
          await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
        } else {
          await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
          await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false, maxTouchPoints: 0 }).catch(() => {});
          await pg.setViewportSize({ width: w, height: h });
        }
      } catch {
        await pg.setViewportSize({ width: w, height: h });
      }
      const msg = `Viewport set to ${w}x${h}${preset ? ` (${preset}${mobile ? ", mobile/touch emulation" : ""})` : ""}.`;
      logAction("browser_set_viewport", { preset, width: w, height: h }, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  // ---- Wave 3 tools -------------------------------------------------------

  server.registerTool(
    "browser_sitemap",
    {
      title: "Page sitemap",
      description: "Return a link tree of the current page: URL, title, heading outline (h1-h3), and every link with its text (up to 200). Read-only — works while paused.",
      inputSchema: {},
    },
    async () => {
      const { page: pg } = await ensureBrowser();
      const data = await pg
        .evaluate(() => {
          const headings = [...document.querySelectorAll("h1, h2, h3")].map((h) => ({
            level: h.tagName.toLowerCase(),
            text: (h.innerText || "").trim().replace(/\s+/g, " ").slice(0, 120),
          }));
          const links = [];
          for (const a of document.querySelectorAll("a[href]")) {
            if (links.length >= 200) break;
            const href = a.getAttribute("href") || "";
            if (!href || href.startsWith("javascript:")) continue;
            links.push({
              text: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80),
              href: href.slice(0, 500),
            });
          }
          return { headings, links };
        })
        .catch(() => ({ headings: [], links: [] }));
      const out = [
        `URL: ${pg.url()}`,
        `Title: ${await pg.title().catch(() => "")}`,
        ``,
        `Headings (${data.headings.length}):`,
        ...(data.headings.length
          ? data.headings.map((h) => `  ${h.level.toUpperCase()}  ${h.text}`)
          : ["  (none)"]),
        ``,
        `Links (${data.links.length}, showing up to 200):`,
        ...(data.links.length
          ? data.links.map((l) => `  - ${l.text || "(no text)"}  →  ${l.href}`)
          : ["  (none)"]),
      ].join("\n");
      logAction("browser_sitemap", {}, `sitemap of ${pg.url()}: ${data.links.length} links, ${data.headings.length} headings`);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.registerTool(
    "browser_pause",
    {
      title: "Pause browser",
      description: "Pause the browser: mutating actions (navigate, click, type, press, tabs, viewport) are refused until browser_resume. Read-only tools keep working. Use it to take control yourself in the Live View.",
      inputSchema: {},
    },
    async () => {
      paused = true;
      broadcast({ type: "paused", time: new Date().toISOString() });
      const msg = "Browser paused. Mutating actions are refused until browser_resume. You can take over in the browser window / Live View now.";
      logAction("browser_pause", {}, msg);
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "browser_resume",
    {
      title: "Resume browser",
      description: "Resume the browser after browser_pause so the agent can act again.",
      inputSchema: {},
    },
    async () => {
      paused = false;
      broadcast({ type: "resumed", time: new Date().toISOString() });
      const msg = `Browser resumed. ${stepCount}/${effectiveMaxSteps()} steps used.`;
      logAction("browser_resume", {}, msg);
      await refreshScreenshot();
      return { content: [{ type: "text", text: msg }] };
    },
  );

  server.registerTool(
    "phone_status",
    {
      title: "Phone status (Artemis)",
      description: "Report whether a Google Artemis Android phone is connected via its MCP server. Returns not-configured unless ARTEMIS_MCP_URL is set. This skill never touches a phone by itself — Artemis runs separately (see docs/ARTEMIS.md).",
      inputSchema: {},
    },
    async () => {
      const status = artemisStatus();
      if (!status.configured) {
        const msg = [
          "Phone: not-configured.",
          status.message,
          "",
          "What this means: the desktop browser tools work as usual; there is no phone attached.",
          "To attach a real Android phone, follow docs/ARTEMIS.md (dedicated test device, USB Debugging or emulator, your own paid model key).",
        ].join("\n");
        logAction("phone_status", {}, "phone: not-configured");
        return { content: [{ type: "text", text: msg }] };
      }
      const live = await checkArtemisReachable(status.mcpUrl);
      const out = {
        ...status,
        reachable: live.reachable,
        httpStatus: live.status,
        check: live.message,
        note: "Artemis itself is a separate Google project (google/artemis, Apache 2.0). This skill only checks its MCP endpoint; phone tasks run through Artemis's own tools (mobile_run_task etc.), not through this skill.",
      };
      logAction("phone_status", {}, `phone: configured, reachable=${live.reachable}`);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    },
  );

  server.registerTool(
    "browser_mode",
    {
      title: "View / switch mode",
      description: "View the current mode, or switch modes (coding, content, research, testing, chat, coding-python, coding-web, coding-api, coding-scripts, content-writing). Each mode sets a preferred model route, allowed tools, and a step budget. A mode can only narrow what the agent may do, never widen past a guard. Call with no arguments to view, or with name to switch.",
      inputSchema: {
        name: z.string().optional().describe("Mode to switch to, e.g. coding, research, coding-python, content-writing"),
      },
    },
    async ({ name }) => {
      if (!name) {
        const mode = currentMode();
        const all = [...MODES.values()].map((m) => ({
          name: m.name,
          description: m.description,
          modelRoute: m.modelRoute,
          maxSteps: m.maxSteps,
          readonly: m.readonly,
          allowedTools: m.allowedTools,
        }));
        const out = {
          current: currentModeName,
          currentMode: mode,
          available: all,
          note: "Switch with browser_mode {name}. Modes are defined in config/modes/*.json (coding, content, research, testing, chat).",
        };
        logAction("browser_mode", {}, `viewed mode: ${currentModeName}`);
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }
      const key = String(name).trim().toLowerCase();
      if (!MODES.has(key)) {
        const msg = `Unknown mode "${name}". Available modes: ${[...MODES.keys()].join(", ")}. Current mode is still ${currentModeName}.`;
        logAction("browser_mode", { name }, msg);
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      currentModeName = key;
      const mode = currentMode();
      const msg = [
        `Mode switched to ${key} — ${mode.description}`,
        `Model route: ${mode.modelRoute}. Step budget: ${mode.maxSteps} (used so far: ${stepCount}).`,
        `Allowed tools: ${mode.allowedTools.join(", ")}`,
        "Modes narrow what the agent may do; the payment guard, HTTPS-only rule, and sensitive-action block still apply.",
      ].join("\n");
      logAction("browser_mode", { name: key }, msg.split("\n")[0]);
      broadcast({ type: "mode", mode: key, time: new Date().toISOString() });
      return { content: [{ type: "text", text: msg }] };
    },
  );

  // Small helper for the two device status tools below: report the status,
  // and when an endpoint is configured, check it answers (short timeout,
  // no credentials, best-effort).
  async function deviceStatusTool(toolName, label, status, checkUrl) {
    if (!status.configured) {
      const msg = `${label}: not-configured.\n${status.message}`;
      logAction(toolName, {}, `${label}: not-configured`);
      return { content: [{ type: "text", text: msg }] };
    }
    const live = await checkArtemisReachable(status.url);
    const out = {
      ...status,
      reachable: live.reachable,
      httpStatus: live.status,
      check: live.message,
      note: "This skill only checks the endpoint; the device itself is driven by that project's own tools, not by Atlas.",
    };
    logAction(toolName, {}, `${label}: configured, reachable=${live.reachable}`);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }

  server.registerTool(
    "windows_status",
    {
      title: "Windows status (UFO)",
      description: "Report whether a Microsoft UFO Windows desktop is attached via its MCP server. Returns not-configured unless UFO_MCP_URL is set. UFO runs as the logged-in Windows user with no sandbox — use a dedicated low-privilege Windows account (see docs/PLATFORMS.md).",
      inputSchema: {},
    },
    async () => deviceStatusTool("windows_status", "Windows (UFO)", windowsStatus()),
  );

  server.registerTool(
    "iphone_status",
    {
      title: "iPhone status (iphone-control)",
      description: "Report whether an iPhone is attached via the open iphone-control tool (WebDriverAgent/XCUITest). Returns not-configured unless IPHONE_CONTROL_URL is set. iOS is closed: this is harder than Android and never as easy — real iPhone over USB to Mac/Linux, iOS 17+, Developer Mode, free Apple ID signing renewed every 7 days (see docs/PLATFORMS.md).",
      inputSchema: {},
    },
    async () => deviceStatusTool("iphone_status", "iPhone (iphone-control)", iphoneStatus()),
  );

  return server;
}

// ---------------------------------------------------------------------------
// Live View HTTP server (also hosts the Streamable HTTP MCP endpoint)
// ---------------------------------------------------------------------------
/** Read a JSON request body. Returns null on empty/invalid body. */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function handleHttp(req, res) {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/mcp") {
    // Streamable HTTP MCP endpoint (stateless: one transport per request).
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed; POST JSON-RPC to /mcp" }));
      return;
    }
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    }).catch(() => null);
    if (!body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    res.on("close", () => transport.close().catch(() => {}));
    return;
  }

  if (url.pathname === "/api/status") {
    const snap = statusSnapshot();
    snap.title = page ? await titleWithTimeout(page) : null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snap));
    return;
  }

  if (url.pathname === "/api/navigate" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || typeof body.url !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: 'POST {"url": "https://…"} required' }));
      return;
    }
    // Same guards as the MCP tool: payment guard, domain lists, step limit.
    const check = checkNavigation(body.url);
    if (!check.ok) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: check.reason }));
      return;
    }
    const blocked = domainGuard(body.url);
    if (blocked) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: blocked }));
      return;
    }
    const steps = stepGuard();
    if (steps) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: steps }));
      return;
    }
    countStep();
    try {
      const { page: pg } = await ensureBrowser();
      await pg.goto(body.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      logAction("api_navigate", { url: body.url }, `REST navigated to ${pg.url()}`);
      await refreshScreenshot();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, url: pg.url(), title: await pg.title().catch(() => ""), steps: stepCount }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
    }
    return;
  }

  if (url.pathname === "/api/screenshot" && req.method === "POST") {
    const body = await readJsonBody(req).catch(() => ({}));
    try {
      const { page: pg } = await ensureBrowser();
      const buf = await pg.screenshot({ type: "png", fullPage: Boolean(body?.fullPage) });
      latestScreenshot = buf;
      await mkdir(LIVE_DIR, { recursive: true });
      await writeFile(LATEST_PNG, buf);
      logAction("api_screenshot", { fullPage: Boolean(body?.fullPage) }, `REST screenshot ${buf.length} bytes`);
      broadcast({ type: "screenshot", time: new Date().toISOString() });
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
    }
    return;
  }

  // Wave 3: Live View control endpoints — Pause / Resume / Record.
  // Recording (session file + per-action screenshots) starts and stops only
  // on the user's command, via these endpoints or the Live View buttons.
  if (url.pathname === "/api/approve" && req.method === "POST") {
    // Human approval for sensitive actions, this session only. It is the
    // user pressing Approve in the Dashboard. Never persisted, never
    // survives a restart; {"allow": false} revokes it.
    const body = await readJsonBody(req);
    if (!body || typeof body.allow !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: 'POST {"allow": true|false} required' }));
      return;
    }
    sessionAllowSensitive = body.allow;
    broadcast({ type: "approval", allowSensitive: sessionAllowSensitive, time: new Date().toISOString() });
    logAction(
      "api_approve",
      { allow: sessionAllowSensitive },
      `Sensitive actions ${sessionAllowSensitive ? "approved for this session" : "approval revoked"} by the human in the Dashboard`,
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, allowSensitive: sessionAllowSensitive, paused, recording }));
    return;
  }

  if (url.pathname === "/api/pause" && req.method === "POST") {
    paused = true;
    broadcast({ type: "paused", time: new Date().toISOString() });
    logAction("api_pause", {}, "Browser paused from Live View");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, paused: true, recording }));
    return;
  }

  if (url.pathname === "/api/resume" && req.method === "POST") {
    paused = false;
    broadcast({ type: "resumed", time: new Date().toISOString() });
    logAction("api_resume", {}, "Browser resumed from Live View");
    await refreshScreenshot();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, paused: false, recording }));
    return;
  }

  if (url.pathname === "/api/record" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || typeof body.recording !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: 'POST {"recording": true|false} required' }));
      return;
    }
    recording = body.recording;
    broadcast({ type: "recording", recording, time: new Date().toISOString() });
    logAction("api_record", { recording }, `Recording ${recording ? "started" : "stopped"} from Live View`);
    if (recording) saveSession();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, paused, recording }));
    return;
  }

  if (url.pathname === "/status") {
    const snap = statusSnapshot();
    snap.title = page ? await titleWithTimeout(page) : null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snap));
    return;
  }

  if (url.pathname === "/video.mjpeg") {
    // Real live video of the browser: MJPEG stream of CDP screencast frames.
    // Picture only — a browser screencast has no audio channel. The stream
    // starts the screencast on first viewer and stops it on last disconnect,
    // so an idle server costs nothing. Until the browser starts, the stream
    // stays open and the first frame arrives when it does.
    res.writeHead(200, {
      "Content-Type": "multipart/x-mixed-replace; boundary=atlasframe",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    });
    videoClients.add(res);
    if (lastFrame) {
      try {
        res.write(
          `--atlasframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${lastFrame.length}\r\n\r\n`,
        );
        res.write(lastFrame);
        res.write("\r\n");
      } catch {}
    }
    await ensureScreencast();
    req.on("close", () => {
      videoClients.delete(res);
      ensureScreencast().catch(() => {});
    });
    return;
  }

  if (url.pathname === "/latest.png") {
    if (latestScreenshot) {
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      res.end(latestScreenshot);
      return;
    }
    if (existsSync(LATEST_PNG)) {
      const buf = await readFile(LATEST_PNG);
      latestScreenshot = buf;
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      res.end(buf);
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No screenshot yet — start the browser first." }));
    return;
  }

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(
      `data: ${JSON.stringify({ type: "hello", actions: actionLog.slice(-20), errors: errorLog.slice(-20), steps: stepCount, maxSteps: effectiveMaxSteps() })}\n\n`,
    );
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // Atlas Dashboard (PWA) — serves dashboard/ as static files.
  // Path traversal is blocked: the resolved file must stay inside dashboard/.
  if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
    const dashDir = path.join(__dirname, "..", "dashboard");
    let rel = url.pathname === "/dashboard" ? "index.html" : decodeURIComponent(url.pathname.slice("/dashboard/".length));
    if (rel === "") rel = "index.html";
    const file = path.normalize(path.join(dashDir, rel));
    if (file !== dashDir && !file.startsWith(dashDir + path.sep)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    try {
      const buf = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(buf);
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/live") {
    const html = await readFile(path.join(__dirname, "live-view.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const useHttp = process.argv.includes("--http");

// Save the session recording on shutdown.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    saveSession();
    process.exit(0);
  });
}

if (useHttp) {
  const httpServer = createHttpServer((req, res) => {
    handleHttp(req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    });
  });
  httpServer.listen(PORT, () => {
    console.log(`Atlas Live View: ${PUBLIC_BASE}/`);
    console.log(`Atlas live video: ${PUBLIC_BASE}/video.mjpeg`);
    console.log(`Atlas MCP endpoint: ${PUBLIC_BASE}/mcp`);
    console.log(`Live View status: ${PUBLIC_BASE}/status`);
  });
} else {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Atlas MCP server running on stdio");
}
