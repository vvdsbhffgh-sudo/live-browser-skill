# Install Atlas — every way to get it and connect it

Atlas is a free, open-source **MCP server + Agent Skill** (Node.js +
Playwright). There is no paid download and no account to buy. Pick the
way that fits your tool below — all of them are in this repo, nothing
extra to install from anywhere else.

> **No native APK.** Atlas is a Node.js server, not a phone app, so
> there is no APK to download — and nobody should offer you one. The
> phone route is the **Dashboard PWA**: open the running server's
> dashboard in your phone's browser and **Add to Home screen**; it
> installs like an app (icon, full screen) and shows the live browser.
> A native APK wrapper (Capacitor) is a roadmap idea, not built.
> See "Phone — install the dashboard as an app" below.

## 0. Requirements

- **Node.js 20+** and `npm`.
- A computer (or a small server / VPS) to run Atlas on. The browser
  runs there; your phone and your AI tool connect to it.
- A **dedicated Google account** for the AI browser (created by you,
  by hand — the AI cannot create one). Never your main account, and
  never paste its password anywhere: you type it yourself in the
  headed browser window, once.

## 1. Get the code

```bash
git clone https://github.com/vvdsbhffgh-sudo/live-browser-skill.git
cd live-browser-skill
npm install
npx playwright install chromium
```

No `git`? Download the ZIP from the repo page (Code → Download ZIP)
and unzip it, then run `npm install` inside.

## 2. Run it

| Command | What it starts | Use it for |
|---|---|---|
| `npm start` | MCP server on **stdio** | Claude Code, Cursor, local agents |
| `npm run start:http` | HTTP server + Live View on `http://localhost:3100` | Watching live, REST API, dashboard |
| `atlas` (after `npm link`) | Same as `npm start` | Any terminal, any folder |
| `atlas --http` | Same as `npm run start:http` | Any terminal, any folder |
| `atlas --http --port 4000` | HTTP server on port 4000 | When 3100 is busy |

`npm link` (run once, inside the repo) puts the `atlas` command on
your PATH. `atlas --help` prints usage; `atlas --version` prints the
version. The CLI is a thin wrapper over `server/index.js` — all
behaviour, including the payment guard, lives there.

## 3. Connect your AI tool

### Claude Code (stdio MCP — recommended)

```bash
claude mcp add atlas -- node /path/to/live-browser-skill/server/index.js
```

Or add to your Claude Code MCP config:

```json
{ "mcpServers": { "atlas": { "command": "node", "args": ["/path/to/live-browser-skill/server/index.js"] } } }
```

Full guide: `docs/CLAUDE-CODE.md`.

### Cursor (stdio MCP)

Settings → MCP → add a server:

```json
{ "atlas": { "command": "node", "args": ["/path/to/live-browser-skill/server/index.js"] } }
```

Full guide: `docs/CURSOR.md`.

### Any MCP client (stdio or HTTP)

- **stdio:** command `node`, args `["/path/to/live-browser-skill/server/index.js"]`.
- **Streamable HTTP:** first deploy the server (see §4), then point
  the client at `https://<your-host>/mcp`.

The Agent Skill itself is `SKILL.md` (also at
`.agents/skills/live-browser/SKILL.md`): any agent that reads skills
can use it directly.

### Lovable / Replit (remote MCP only)

Lovable and Replit accept custom MCP servers **only as remote HTTPS
chat connectors while building** — they cannot reach `localhost`, and
the published app does not inherit the browser or the Google session.
Deploy the server first (see §4), then add it as a remote MCP server
in the builder. Full guides: `docs/LOVABLE.md`, `docs/REPLIT.md`.

### REST API (for your own app or script)

Same port as the HTTP server, same payment guard:

```bash
curl http://localhost:3100/api/status
curl -X POST http://localhost:3100/api/navigate \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
curl -X POST http://localhost:3100/api/screenshot --output shot.png
```

`POST /api/navigate` to a checkout URL returns `403` with the
payment-blocked message. Step limit returns `429`.

### Live event stream (SSE)

```bash
curl -N http://localhost:3100/events
```

Streams one JSON event per browser action/error as it happens. The
Live View page (`/` and `/live`) and the Dashboard (`/dashboard`)
are built on it.

## 4. Deploy it so others (and Lovable / Replit) can reach it

- **Railway:** `deploy/railway.md`
- **Render:** `deploy/render.md`
- **Docker:** `deploy/Dockerfile` (`docker build -t atlas .`, then run
  with the port mapped; set `LIVE_BROWSER_PORT` as needed).

Live View has **no auth in this alpha**. Never expose the bare port
to the internet: put a deployed instance behind HTTPS + access
controls (see `SECURITY.md`).

## 5. Phone — install the dashboard as an app (PWA)

1. Start the HTTP server on your computer (`atlas --http`).
2. On your phone, on the same Wi-Fi, open
   `http://<computer-ip>:3100/dashboard` (use the computer's LAN
   address, not `localhost`).
3. In the browser menu choose **Add to Home screen** (Android
   Chrome) or **Share → Add to Home Screen** (iPhone Safari).
4. The Atlas icon appears on your home screen and opens the live
   dashboard full-screen: live screenshot, agents, model router,
   devices, Pause / Resume / Approve / Record.

The PWA needs `dashboard/icon-192.png` and `dashboard/icon-512.png`
(they are in the repo; if your copy lacks them, the dashboard falls
back to the SVG icon). No APK, no Play Store — the install is the
browser's own.

## 6. Real Android phone / Windows / iPhone (optional)

Atlas checks their status; each platform runs as its own separate
project — no code for them is vendored here:

| Platform | Project | Atlas setting | Guide |
|---|---|---|---|
| Android phone | Google Artemis | `ARTEMIS_MCP_URL` | `docs/ARTEMIS.md` |
| Windows desktop | Microsoft UFO | `UFO_MCP_URL` | `docs/PLATFORMS.md` |
| iPhone | iphone-control | `IPHONE_CONTROL_URL` | `docs/PLATFORMS.md` |

Without those URLs set, `phone_status` / `windows_status` /
`iphone_status` report `not-configured` and Atlas never touches a
device.

## 7. Sign in to Google (manual, once, by you)

1. Start with a visible window: `LIVE_BROWSER_HEADED=1 atlas --http`
   (or `LIVE_BROWSER_HEADED=1 npm run start:http`).
2. Ask the agent to run `browser_google_signin` (opens
   accounts.google.com).
3. **Sign in yourself in the browser window** with the dedicated
   Google account. Never paste the password in chat. Never give it
   to the AI.
4. The session is saved in the profile and reused next time.
   The account's address can be recorded locally in your own `.env`
   as `ATLAS_GOOGLE_ACCOUNT` (see `docs/HIKMA-LAB.md`) — never
   commit a real address or any password to the public repo.

## 8. What Atlas will never do (by design)

- **Never pay.** Checkout/payment URLs, pay buttons and card-like
  numbers are blocked in code (`server/guard.js`).
- **Never store a password.** The AI never sees, types, or stores
  any password.
- **Never bypass a human check.** Real headed browser, human pace,
  pause-and-hand-over for CAPTCHAs.
- **Never create a Gmail account.** Google requires human phone
  verification.
- **Never auto-upgrade to a paid model.** The 50+ model router
  (`docs/MODEL-ROUTER.md`) falls back and queues at limits; a paid
  entry is used only if you list it yourself.
