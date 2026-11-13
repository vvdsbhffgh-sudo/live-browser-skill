# FEATURES.md — Now / Next / Never

Version **1.0.2-alpha (Alpha 2)**. ✅ = shipped and tested. 📋 = planned, not built.
Anything under **Never** will not be built, however often it is asked for —
the reason is written next to it.

## ✅ Now — shipped in v1

- **MCP server, two transports** — stdio (Claude Code / Cursor) and Streamable
  HTTP (`/mcp`) for Lovable / Replit remote connectors.
- **Real Chromium browser** — persistent profile, Google sign-in is manual,
  once, by the user, with a dedicated Google account.
- **Core tools** — start, navigate, snapshot (refs), click, type, press keys,
  screenshot, status, Google sign-in, stop.
- **Payment guard (hard rule)** — checkout/payment URLs, pay buttons, and
  card-like numbers are refused in code (`server/guard.js`), with tests.
- **Live View** — screenshot, current URL, live action log over SSE at
  `http://localhost:3100/` (English + short Arabic section).
- **Platform guides** — Claude Code, Cursor, Lovable, Replit (with the honest
  note that Lovable/Replit need a deployed remote MCP server and the published
  app does not inherit the browser), plus Railway/Render deploy guides.

## ✅ Now — shipped in Wave 2

- **Tabs** — `browser_tabs` (list / new / switch / close).
- **Full-page screenshot + page text** — `browser_full_screenshot`,
  `browser_extract_text` (visible text, word count, truncated at 20,000 chars).
- **Mobile / tablet / desktop emulation** — `browser_set_viewport` presets
  (desktop 1280×800, mobile 390×844 with touch emulation, tablet 820×1180)
  or custom sizes.
- **Console & network error log** — console errors, page errors, failed
  requests, HTTP ≥ 400, shown in `browser_status`, `/status`, and Live View.
- **Domain allow/block lists** — `LIVE_BROWSER_ALLOWED_DOMAINS`,
  `LIVE_BROWSER_BLOCKED_DOMAINS` (comma-separated; blocked wins; subdomains
  included). A click that lands on a blocked domain goes back.
- **Read-only mode** — `LIVE_BROWSER_READONLY=1` blocks click and type.
- **Sensitive-action protection** — delete / send / publish / remove are
  refused unless `LIVE_BROWSER_ALLOW_SENSITIVE=1` (a human approves by
  setting the flag).
- **Session recording** — every action + error is saved to
  `live/session-<timestamp>.json`, with numbered screenshots alongside it.
- **Step limit** — `LIVE_BROWSER_MAX_STEPS` (default 100); mutating actions
  stop with a clear message when the budget is spent.
- **REST API next to MCP** (same port, same payment guard) —
  `POST /api/navigate`, `POST /api/screenshot`, `GET /api/status`.

## ✅ Now — shipped in Wave 3 (1.0.1-alpha)

- **Page sitemap** — `browser_sitemap`: heading outline + every link on the
  page (up to 200) as a link tree.
- **Pause / Resume** — `browser_pause` / `browser_resume` MCP tools and
  Pause / Resume buttons in the Live View. While paused, mutating actions
  are refused; read-only tools keep working, so you can take over the
  browser yourself and hand it back.
- **Record button in the Live View** — recording (session file +
  screenshots, stored locally in `live/`) starts and stops only on your
  command (`POST /api/record`, the Live View button, or the tools).
- **Phone status** — `phone_status` MCP tool: `not-configured` unless
  `ARTEMIS_MCP_URL` is set; when set, it checks whether the Artemis MCP
  endpoint answers. Artemis itself stays a separate Google project — see
  `docs/ARTEMIS.md`. No Artemis code is vendored or copied here.
- **HTTPS-only** — plain `http://` is refused except for localhost (local
  dev / Live View). TLS verification is never disabled anywhere in this
  project.
- **Model router (config + docs)** — `config/model-router.example.json` +
  `docs/MODEL-ROUTER.md`: automatic model switching by task
  (code / chat / vision), Ollama local, OpenRouter `:free`, Gemini free
  tier, fallback chain, queue + pause at the limit.
- **Multi-agent (config + docs)** — `config/agents.example.json` +
  `docs/MULTI-AGENT.md`: one agent = one browser profile + one Google
  account + one device/emulator.
- **Plugins (registry + docs)** — `plugins/registry.example.json` +
  `docs/PLUGINS.md`: install a GitHub tool on demand, only after a license
  check, pinned to a commit SHA.
- **Name candidates** — `NAME.md`: بصير Baseer, نافذة Nafitha, عين Ayn,
  أطلس Atlas (pick pending).

## ✅ Now — shipped in Alpha 2 (1.0.2-alpha)

- **50+ model router, ranked by strength — not fame.** `config/model-router.example.json` now lists 50 unique free models across OpenRouter `:free`, Groq free, Gemini free tier, SambaNova free tier and local Ollama, in five routes (chat, code, vision, audio, phone). Rank 1 = strongest for that task, judged on public benchmarks — a lesser-known model can outrank a famous one. `scripts/route-model.js` is the executable router: `node scripts/route-model.js --task code` prints the next model, skipping exhausted ones; when all are exhausted it says queue-and-pause, never silently upgrades to paid. Calling the pool "without limits" was a figure of speech: every provider still has a hard cap (see `docs/FREE-MODELS.md`).
- **Live View verified, not just claimed.** `docs/LIVE-VERIFIED.md` records the 2026-11-13 live check: tests 55/55 green (now 61 with the router tests), Live View `/` 200, `/status` 200, `/live` 200, `/dashboard` 200, MCP initialize returns `atlas` / `1.0.2-alpha`, checkout navigation refused with "Payment blocked: this skill never pays", SSE `/events` streams live actions. Honest limit kept: real-site navigation and live screenshots still need a machine with direct internet egress — this build VM's Chromium cannot reach the public internet.
- **Hikma Lab setup.** `docs/HIKMA-LAB.md` documents the user's Hikma Lab app (hikmalab11.lovable.app) and its Zakat al-Hikma AI using Atlas: dedicated Google account via `ATLAS_GOOGLE_ACCOUNT` in your own `.env` (never committed, never in the public repo), browser + Android phone (Artemis) + Windows (UFO) all from one setup.

## ✅ Now — shipped in the final wave (1.0.1-alpha, Atlas)

- **Name decided: Atlas.** Version Alpha 2 (1.0.2-alpha). The repo keeps the
  technical name `live-browser-skill` until publishing; the product,
  the package, the MCP server, and all titles are Atlas (see `NAME.md`).
- **Modes library** — `config/modes/` (coding, content, research,
  testing, chat): each mode sets its preferred model route, its allowed
  tools, and its step budget. Switch with the `browser_mode` tool.
  A mode can only narrow what the agent may do, never widen past a guard.
- **Pooled free models** — `docs/FREE-MODELS.md`: OpenRouter `:free`
  (20/min, 50/day, 1,000/day after $10 lifetime), Gemini free tier, Groq
  free tier, and local Ollama, pooled by the router with queue + pause
  at each provider's cap. Large pooled free credit — never limitless.
  Models are ranked by strength for the task, not by fame
  (`rank` in `config/model-router.example.json`).
- **Play Store apps list** — `config/play-store-apps.example.json`: the
  curated apps to install once, by hand, on the test Android phone
  (browser, Maps, YouTube, Gmail, Drive, Files, …). Updates come from
  the Play Store's own auto-update on the device.
- **Dependency updates, tested** — `scripts/update-deps.sh` +
  `docs/UPDATES.md`: update, run `npm test` as the gate, roll back on
  failure. No blind update to latest.
- **Documented security model** — `SECURITY.md` now states the full
  model (HTTPS-only, TLS verification, local data only, audit log,
  least privilege, human in the loop) and states plainly that there is
  **no absolute guarantee** nothing can ever go wrong.
- **Platforms** — `docs/PLATFORMS.md` + `windows_status` /
  `iphone_status` tools: Windows via Microsoft UFO (MIT, dedicated
  low-privilege account — UFO has no sandbox), iPhone via iphone-control
  (WebDriverAgent/XCUITest, iOS 17+, 7-day free signing; never as easy
  as Android — iOS is closed).
- **Live test** — `docs/LIVE-TEST.md`: test Atlas like a real person
  (headed browser, persistent profile, real site, Live View).
- **Code tools registry** — `config/code-tools/` (11 languages) +
  `docs/CODE-TOOLS.md` + `npm run list-tools` (`scripts/list-tools.js`).
- **Famous tools** — `docs/FAMOUS-TOOLS.md`: official integrations only
  (UFO, Artemis, GitHub MCP, Playwright, Ollama, OpenRouter); closed /
  paid tools are never copied or auto-merged.
- **Dashboard (PWA)** — `dashboard/` served at `/dashboard`: Material 3
  Expressive control panel (live screenshot, agents + live state, model
  router, devices, action log, Pause / Resume / Approve / Record),
  installable as an app (manifest + service worker, app-shell cache
  only). Tokens documented in `docs/DESIGN.md`; every connection method
  in `docs/CONNECTIONS.md`.

## 📋 Next — planned, not built yet

### Live View & session
- [ ] Session replay: step through a recorded session in the Live View.
- [ ] Download session (JSON + screenshots) as a zip from the Live View.
- [ ] Live View auth (a simple token) for deployed instances.
- [ ] Video recording of the session (Playwright `video` option).

### Tabs & browsing
- [ ] Tab screenshots / thumbnails in the Live View tab list.
- [ ] Restore last session's tabs on restart.
- [ ] Wait-for helpers (`browser_wait_for` text/selector/timeout).

### Forms & files
- [ ] Form filling from a JSON object (`browser_fill_form`).
- [ ] File upload (`browser_upload`) and download capture (save to `live/`).
- [ ] Select / checkbox / radio helpers by ref.

### Mobile (Artemis)
- [ ] `phone_run_task` passthrough: send a task to a configured Artemis
      server and stream its result back (Artemis itself does the driving).
- [ ] Named device presets (iPhone 15, Pixel 8, iPad) with UA + viewport —
      browser emulation only, not a real phone.
- [ ] Geolocation / timezone / locale emulation per session.

### Network & console
- [ ] Full network log (method, URL, status, size) with a filter in Live View.
- [ ] `browser_console` tool to read recent console output on demand.
- [ ] Block / mock requests (e.g. block trackers) via route rules.

### Extraction
- [ ] Extract tables as JSON (`browser_extract_tables`).
- [ ] Extract links / images lists as JSON.
- [ ] Save extracted text/tables to `live/` files.

### Domains & safety
- [ ] Per-domain rules file (allow/deny + read-only per domain).
- [ ] Human-approval queue: sensitive actions wait in the Live View for the
      user to Approve / Reject instead of a static env flag.
- [ ] Audit log export (signed, append-only) for compliance.
- [ ] Per-tool rate limiting.

### API & SDK
- [ ] JavaScript SDK (`@live-browser/sdk`) wrapping the REST API for an AI
      running **inside** the user's own app (in-app agent use).
- [ ] WebSocket live feed (in addition to SSE).
- [ ] OpenAPI spec for the REST API.

### One-click deploy
- [ ] Deploy button for Railway / Render / Fly.io from the README.
- [ ] `docker compose` file for local one-command run.
- [ ] GitHub Action that runs the skill's own test-suite against a demo site.

### Local models
- [ ] Ollama support: let a local model drive the browser through the same
      MCP tools (no cloud model needed) — documented setup, no API keys.
- [ ] Optional vision check: describe the latest screenshot with a local
      vision model and compare it with the expected state.

### Voice & video
- [ ] Voice notes in the Live View: the user records a spoken instruction
      and the agent receives it as text (transcribed locally or by the
      model the user configured). Voice recording also starts/stops only
      on the user's command and is stored locally.

## 🚫 Never — will not be built

- **Bypassing CAPTCHA or "are you human?" checks, and any CAPTCHA solver.**
  We will NOT build this, and no CAPTCHA-solving plugin will
  ever be accepted. What we build instead is the legitimate approach
  only: a real headed browser, a persistent profile with ordinary
  cookies and history, human pace (short delays between actions), and
  pause-and-hand-over — when a human check appears, the agent stops and
  the user solves it manually in the browser window. See `SECURITY.md`
  ("Human checks"). Any tool that defeats human verification gets
  accounts locked and sites broken, and it is not what this project is
  for.
- **Automatic Gmail creation by the AI.** Google requires human phone
  verification for new accounts. The user creates each account manually
  (see `docs/MULTI-AGENT.md`). No workaround will be added.
- **"Unlimited" free models, 24-hour non-stop free use.** There is no
  such thing. OpenRouter `:free` is 20 requests/minute, 50/day, 1,000/day
  after $10 lifetime purchases; Gemini and Groq free tiers have their own
  caps. Pooling them (`docs/FREE-MODELS.md`) gives large pooled free
  credit, not limitless use. The router queues and pauses at each
  provider's limit; it never claims otherwise.
- **Merging all trending AI repos into this repo.** This repo stays a
  browser skill. Other projects keep their own licenses, maintainers,
  and security histories. Plugins link to them one at a time, after a
  license check — they are never absorbed wholesale.
- **Bypassing Play Store verification** (sideloading or force-installing
  apps past the store). Apps are installed once, by hand, from the Play
  Store on the test phone, and updated by the Play Store's own
  auto-update on the device. See `docs/ARTEMIS.md`.
- **Payments, password handling, or silent publishing.** Non-negotiable
  since v1: the skill never pays, never sees a password, and never
  publishes or sends anything without human approval.

## How to propose a feature

Open a GitHub issue with the use case (what you want the agent to do in the
browser) rather than only the mechanism. Safety rules are non-negotiable:
nothing in the roadmap will ever add payments, password handling, silent
publishing, CAPTCHA bypass, or automatic account creation.
