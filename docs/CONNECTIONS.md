# CONNECTIONS.md — every way to connect to Atlas

Atlas is one server with many doors. Pick the door that matches the
client you are using. All doors share the same guards (payment block,
HTTPS-only, sensitive-action block, step limit, modes) — no door bypasses
another door's rules.

| # | Way in | Endpoint / file | For whom |
|---|---|---|---|
| 1 | MCP over stdio | `npm start` → `node server/index.js` | Claude Code, Cursor, local agents |
| 2 | MCP over Streamable HTTP | `POST https://<host>/mcp` | Lovable, Replit Agent (remote HTTPS only) |
| 3 | REST API | `POST /api/navigate`, `POST /api/screenshot`, `GET /api/status`, `POST /api/pause|resume|record|approve` | An AI running inside your own app |
| 4 | Agent Skill | `SKILL.md` + `.agents/skills/live-browser/SKILL.md` | Any agent that reads Agent Skills |
| 5 | CLI | `npm start`, `npm run start:http`, `npm run list-tools`, `npm run update-deps` | You, in a terminal |
| 6 | SSE live events | `GET /events` (text/event-stream) | Live View, Dashboard, any SSE client |
| 7 | Dashboard (PWA) | `GET /dashboard` | You, in a browser or installed app |

## 1. MCP over stdio (local agents)

```bash
npm install
npx playwright install chromium
npm start
```

Claude Code (see `docs/CLAUDE-CODE.md`):

```bash
claude mcp add atlas -- node /absolute/path/to/live-browser-skill/server/index.js
```

Cursor: add the same command in the MCP settings (`docs/CURSOR.md`).
The server speaks MCP on stdin/stdout; the browser runs on your
machine; the Live View is at `http://localhost:3100/` when you also
run `npm run start:http` (stdio and HTTP are separate processes — run
one or the other, or two servers on different ports/profiles).

## 2. MCP over Streamable HTTP (Lovable / Replit)

```bash
npm run start:http   # Live View + /mcp on http://localhost:3100
```

Deploy the server first (see `deploy/railway.md`, `deploy/render.md`),
then add it as a **custom MCP server** in Lovable (Connectors → Custom
→ MCP) or Replit (Integrations → Add personal MCP server) with the
public URL:

```
https://<your-host>/mcp
```

Honest limits (verified 2026-11-13):

- Lovable and Replit accept custom MCP servers **only as remote HTTPS
  chat connectors while building**. They cannot reach `localhost`.
- The published Lovable/Replit app does **not** inherit the browser or
  the Google session. The browser is a build-time tool for the agent.
- The connector is personal to your account, not part of the app.

## 3. REST API (in-app AI)

Same port, same payment guard, for an AI running **inside your own
app** (your app's own backend calls Atlas; it does not go through
Lovable/Replit's connector):

```bash
curl http://localhost:3100/api/status
curl -X POST http://localhost:3100/api/navigate \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
curl -X POST http://localhost:3100/api/screenshot --output shot.png
curl -X POST http://localhost:3100/api/pause
curl -X POST http://localhost:3100/api/resume
curl -X POST http://localhost:3100/api/record -H 'Content-Type: application/json' -d '{"recording": true}'
curl -X POST http://localhost:3100/api/approve -H 'Content-Type: application/json' -d '{"allow": true}'
```

- `POST /api/navigate` to a checkout URL returns `403` (payment
  blocked); step limit returns `429`.
- `POST /api/approve` allows sensitive actions (delete/send/publish)
  **for this session only** — it is the human pressing Approve in the
  Dashboard. `{"allow": false}` revokes it. It never persists to disk
  and never survives a restart.

## 4. Agent Skill (SKILL.md)

- `SKILL.md` at the repo root, and the identical copy at
  `.agents/skills/live-browser/SKILL.md` (Replit / Claude Code pick it
  up from `.agents/skills/`).
- The skill tells the agent: which tools exist, the workflow (start →
  navigate → snapshot → click/type → verify with screenshots), the
  modes, the safety rules, and the manual Google sign-in. It is
  documentation the agent reads — the tools themselves live in the MCP
  server.

## 5. CLI

```bash
npm start              # stdio MCP server
npm run start:http     # HTTP server + Live View + Dashboard
npm run list-tools     # print languages, modes, routes, plugins
npm run update-deps    # update deps, test-gated, with rollback
npx playwright install chromium
```

Environment variables: see `.env.example` (`LIVE_BROWSER_PORT`,
`LIVE_BROWSER_PROFILE`, `LIVE_BROWSER_HEADED`, `ATLAS_MODE`,
`ARTEMIS_MCP_URL`, `UFO_MCP_URL`, `IPHONE_CONTROL_URL`, …).

## 6. SSE live events

```bash
curl -N http://localhost:3100/events
```

`GET /events` is a `text/event-stream` feed: `hello` (recent actions +
errors on connect), then `action`, `error`, `screenshot`, `paused`,
`resumed`, `recording`, `mode` events as they happen. The Live View
(`server/live-view.html`) and the Dashboard (`dashboard/index.html`)
both consume it. No authentication in 1.0.1-alpha — run on
`localhost` or behind HTTPS + access controls (see `SECURITY.md`).

## 7. Dashboard (PWA)

Open `http://localhost:3100/dashboard` — the Atlas control dashboard
(Material 3 Expressive, see `docs/DESIGN.md`): live screenshot,
agents + their live/offline state, current mode, model-router status,
device status, action log + errors, and Pause / Resume / Approve /
Record buttons. It is a PWA (`manifest.json` + service worker), so the
browser offers "Install" / "Add to Home screen". The service worker
caches only the app shell; `/status`, `/events`, `/latest.png`, and
`/api/*` always come from the network.

## A note on names

If you meant a specific tool called **"Tesbit"**, send its link —
no tool by that name is assumed, invented, or integrated here. A
connection is only documented once the real tool, its real endpoint,
and its real account requirements are known. Nothing in this file
describes a fake integration.
