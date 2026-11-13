---
name: atlas
description: Use when the user asks the AI to browse a website live, log in with Google, test a site, click through pages, fill a form, or watch what the browser is doing. Atlas gives the agent a real Chromium browser it can drive, with a dedicated Google login, a live view of every action, switchable modes, and optional phone/desktop status checks. Never use for payments — Atlas never pays.
---

# Atlas

Give the agent a real browser it can drive — with a live view of everything it does.

## What this is

**Atlas** (Alpha 3, 1.0.3-alpha) is a free, open-source MCP server (Node.js + Playwright)
that gives an AI builder — Claude Code, Cursor, Lovable, Replit Agent — a real
Chromium browser:

- **Real browsing:** navigate, snapshot (accessibility tree + clickable refs),
  click, type, press keys, screenshot, **tabs**, **full-page screenshots**,
  **page-text extraction**, **viewport presets** (desktop / mobile / tablet),
  **page sitemap** (headings + links).
- **Its own Google login:** the browser keeps a persistent profile. The user
  signs in once, manually, with a **dedicated Google account** (never their
  main personal account). The session persists across restarts.
- **Live view:** real live video of the browser (`/video.mjpeg`, MJPEG from
  the renderer's CDP screencast) plus every action logged at
  `http://localhost:3100/` — the user watches everything live, including
  **console & network errors**. **Pause / Resume / Record** buttons let the
  user take over the browser and start/stop recording. Video is picture only
  (a browser screencast has no audio channel). If a site shows a human check
  (Cloudflare "Just a moment..."), Atlas pauses and shows a banner — it never
  solves, clicks through, or bypasses the check.
- **Modes:** `browser_mode` switches between coding, content, research,
  testing, chat, and language modes (coding-python, coding-web, coding-api,
  coding-scripts, content-writing). Each mode sets its model route, its
  allowed tools, and its step budget — see `config/modes/`.
- **Devices (status only):** `phone_status` (Google Artemis Android),
  `windows_status` (Microsoft UFO), `iphone_status` (iphone-control).
  Each returns `not-configured` unless its endpoint is set — see
  `docs/PLATFORMS.md`. Atlas never touches a device by itself.
- **No payments, ever:** checkout/payment pages are blocked in code, and
  card-like numbers are never typed. See `server/guard.js`.
- **Guardrails:** HTTPS-only navigation, read-only mode, domain allow/block
  lists, sensitive-action block (delete/send/publish), a step limit, and a
  session recording (`live/session-<timestamp>.json`).
- **REST API** on the same port (`POST /api/navigate`, `POST /api/screenshot`,
  `GET /api/status`) with the same payment guard, for an AI running inside
  the user's own app.
- **Code tools registry:** `config/code-tools/` has one JSON file per
  language (python, javascript, typescript, go, rust, java, csharp, php,
  sql, html-css, bash) with runtime, run/test commands, formatter and
  linter — see `docs/CODE-TOOLS.md`. List everything with
  `npm run list-tools`.

## What this is NOT

- Not a paid feature and not a way to pay for anything.
- Not password storage: the AI never sees, types, or stores any password.
- Not a runtime feature for end users: in Lovable / Replit, the browser is a
  **build-time tool for the agent**, not something the published app inherits.
  Lovable and Replit accept custom MCP servers only as remote HTTPS connectors
  while building, and they cannot reach `localhost` — deploy the server first
  (see `deploy/`) or expose it with a tunnel, then add its URL.
- Not a CAPTCHA bypass: there is no CAPTCHA solver anywhere in Atlas. When a
  human check appears, stop and let the user solve it manually (see Safety).
- Not every language in the world: the code-tools registry is extensible —
  a new language is one JSON file (see `docs/CODE-TOOLS.md`).

## Setup

```bash
npm install
npx playwright install chromium
npm start            # stdio MCP server (Claude Code / Cursor)
npm run start:http   # HTTP server + Live View on http://localhost:3100
# Or after `npm link`: `atlas --http` (see docs/INSTALL.md for every connection method).
```

Config via environment variables (see `.env.example`):

- `LIVE_BROWSER_PORT` — default `3100`
- `LIVE_BROWSER_PROFILE` — default `./.live-browser-profile`
- `LIVE_BROWSER_HEADED=1` — show a visible browser window (needed for the
  manual Google sign-in; default is headless)
- `LIVE_BROWSER_READONLY=1` — block click and type (read-only mode)
- `LIVE_BROWSER_ALLOW_SENSITIVE=1` — allow delete/send/publish actions
  (default: blocked — a human approves by setting this)
- `LIVE_BROWSER_MAX_STEPS` — max mutating actions per run (default `100`,
  overridden by the current mode's own limit)
- `LIVE_BROWSER_ALLOWED_DOMAINS` / `LIVE_BROWSER_BLOCKED_DOMAINS` —
  comma-separated domain lists (blocked wins; subdomains included)
- `ATLAS_MODE` — starting mode (default `coding`)
- `ARTEMIS_MCP_URL` / `UFO_MCP_URL` / `IPHONE_CONTROL_URL` — device
  endpoints (unset = `not-configured`)

## Workflow for the agent

1. **Check the mode** with `browser_mode` (no arguments). Switch modes
   when the task changes — e.g. `coding-python` for a Python task,
   `research` for read-only reading, `testing` for visual checks.
2. **Start the browser** with `browser_start`. Tell the user the Live View
   link: `http://localhost:3100/` — they can watch every step, pause you,
   and take over.
3. **Navigate** with `browser_navigate` (https only, except localhost;
   `file://` and `chrome://` are blocked).
4. **Snapshot** with `browser_snapshot` to see the page: interactive elements
   come with `[ref=N]` markers. Use those refs — never guess selectors.
   Use `browser_sitemap` for the page's link tree when you need an overview.
5. **Click / type** with `browser_click` / `browser_type` using the ref.
   Press `Enter` etc. with `browser_press`. Atlas paces actions at a human
   speed — never try to speed it up or batch around the guards.
6. **Verify with screenshots**: call `browser_screenshot` after important
   steps and describe what is actually visible — never claim success from a
   tool result alone.
7. **Check status** with `browser_status` (current URL/title, tabs, Google
   sign-in state, console/network errors, steps used, recent actions).
8. **Tabs**: `browser_tabs` with `action=list|new|switch|close`.
   **Mobile check**: `browser_set_viewport` with `preset=mobile|tablet|desktop`.
   **Text**: `browser_extract_text` for the page's visible text.
9. **Pause when the user takes over**: if the user presses Pause in the
   Live View (or a human check appears), stop immediately. Resume only
   with `browser_resume` when they tell you to.

## Google sign-in (manual, once, by the user)

1. Start the server with `LIVE_BROWSER_HEADED=1` so the window is visible.
2. Call `browser_google_signin`. It opens https://accounts.google.com.
3. **The user signs in themselves in the browser window**, with a dedicated
   Google account created for the AI browser. They type the password
   themselves and complete any 2-step check themselves.
4. Never ask for the password in chat. Never type it. Never store it.
5. The session is saved in the browser profile and reused next time.
   Call `browser_status` afterwards to confirm the signed-in state.

## Safety rules (hard rules — do not work around them)

- **Never pay.** If a tool refuses with "Payment blocked", stop that path and
  tell the user plainly. Do not try another URL, button, or wording to get
  around the block.
- **Never type a card number** (13–19 digits) or fill a payment form.
- **Never ask for, accept, or store a password or token.**
- Only open `https://` URLs (plain `http://` only for localhost).
- **Never bypass a human check.** If a CAPTCHA or "are you human?" check
  appears, stop, tell the user, and let them solve it manually in the
  browser window. There is no CAPTCHA solver in Atlas, and no plugin for
  one will ever be accepted. Do not try another URL or wording to dodge it.
- If a click is refused as a **sensitive action** (delete/send/publish), do
  not rephrase it to dodge the guard — ask the user to do it themselves or
  to set `LIVE_BROWSER_ALLOW_SENSITIVE=1`.
- If a tool is refused by the **current mode**, do not switch modes silently
  to dodge it — tell the user and ask which mode to use.
- In **read-only mode** (`LIVE_BROWSER_READONLY=1`) do not click or type;
  navigate, snapshot, and screenshot only.
- Respect the **step limit**: when it is reached, summarise what was done and
  stop; do not restart the server to dodge it without telling the user.
- Show the user the Live View link whenever the browser is running, and
  narrate what the browser is doing in plain language.

## Tools

| Tool | What it does |
|---|---|
| `browser_start` | Start (or reuse) the browser |
| `browser_navigate` | Go to a URL (payment / http URLs refused) |
| `browser_snapshot` | Accessibility tree + clickable refs |
| `browser_click` | Click by ref or selector |
| `browser_type` | Type into a field by ref or selector |
| `browser_press` | Press a key (Enter, Tab, Escape…) |
| `browser_screenshot` | Screenshot (also updates Live View) |
| `browser_full_screenshot` | Full-page screenshot |
| `browser_extract_text` | Visible page text + word count |
| `browser_sitemap` | Page link tree: headings + links |
| `browser_tabs` | List / new / switch / close tabs |
| `browser_set_viewport` | Presets: desktop / mobile / tablet, or custom size |
| `browser_status` | URL, title, tabs, Google state, errors, steps, session file |
| `browser_pause` | Pause the agent so the user can take over |
| `browser_resume` | Resume the agent after a pause |
| `browser_mode` | View / switch mode (coding, research, coding-python, …) |
| `browser_google_signin` | Open Google sign-in for manual login |
| `browser_stop` | Close the browser (profile is kept) |
| `phone_status` | Artemis Android phone attached? (`not-configured` unless set) |
| `windows_status` | Microsoft UFO Windows desktop attached? (`not-configured` unless set) |
| `iphone_status` | iphone-control iPhone attached? (`not-configured` unless set) |

## REST API (same port, same payment guard)

- `GET /api/status` — same JSON as `/status`
- `POST /api/navigate` — `{"url": "https://…"}` (403 on payment/blocked URLs, 429 on step limit)
- `POST /api/screenshot` — `{"fullPage": false}` — returns a PNG
- `POST /api/pause` / `POST /api/resume` / `POST /api/record` — Live View controls

## Roadmap

See `FEATURES.md` for what is shipped (Now), what is planned (Next), and
what will never be built (Never — including CAPTCHA bypass, automatic
Gmail creation, "unlimited" free models, and merging trending repos).

## Platform guides

- Claude Code / local agents: `docs/CLAUDE-CODE.md`
- Cursor: `docs/CURSOR.md`
- Lovable: `docs/LOVABLE.md` (remote MCP only — deploy first)
- Replit: `docs/REPLIT.md` (remote MCP only — deploy first)
- Deploy the HTTP server: `deploy/railway.md`, `deploy/render.md`
- Dashboard (PWA control panel): open `/dashboard` on the running server — live screenshot, agents, model router, Pause / Resume / Approve / Record. Design tokens: `docs/DESIGN.md`
- Every connection method: `docs/CONNECTIONS.md` (MCP stdio, MCP HTTP, REST, Skill, CLI, SSE, Dashboard)
- Platforms (Android / Windows / iPhone): `docs/PLATFORMS.md`
- Free models (pooled): `docs/FREE-MODELS.md`
- Code tools registry: `docs/CODE-TOOLS.md`
- Famous tools (official integrations only): `docs/FAMOUS-TOOLS.md`
- Live test (test like a real person): `docs/LIVE-TEST.md`
