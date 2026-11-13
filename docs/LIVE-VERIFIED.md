# Live View — verified live, 2026-11-13 (Alpha 2)

This page records what was actually checked live on 2026-11-13, so "live"
is a verified claim, not a slogan. The check ran on the build machine
(a Linux VM). Anything that needs the public internet from the browser
itself is marked honestly below.

## What "live" means in Atlas

Every browser action the agent takes updates, in real time:

- **Live View** (`http://localhost:3100/` and `/live`) — the current
  screenshot of the browser, refreshed after every action.
- **Status** (`GET /status` and `GET /api/status`) — current URL, title,
  tabs, Google sign-in state, errors, steps used / step budget.
- **Events** (`GET /events`, Server-Sent Events) — a live stream of
  actions and errors as they happen (`hello` first, then one event per
  action).
- **Dashboard** (`/dashboard`) — the same live screenshot plus agents,
  model router, devices, and Pause / Resume / Approve / Record buttons.
- **Session recording** — actions + errors + screenshots saved locally
  to `live/session-<timestamp>.json` (only when you start recording).

You watch it on the machine Atlas runs on. On the same Wi-Fi you can open
the same pages from your phone at `http://<machine-ip>:3100/` (replace
`<machine-ip>` with the machine's LAN address). Live View has **no auth
in this alpha** — keep it on `localhost`, or put a deployed instance
behind HTTPS + access controls (see `SECURITY.md`).

## The check (2026-11-13, fresh server, `node server/index.js --http`)

| Check | Result |
|---|---|
| `npm test` | **62/62 pass, 0 fail** (55 before Alpha 2, +7 router tests in `test/route-model.test.js`) |
| `GET /` (Live View page) | **200**, 7,552 bytes |
| `GET /live` | **200** |
| `GET /status` | **200** |
| `GET /api/status` | **200** |
| `GET /dashboard` | **200**, 17,571 bytes |
| `GET /dashboard/manifest.json` | **200** |
| `GET /latest.png` (before any browsing) | **404** — correct: no screenshot exists until the browser starts |
| `POST /mcp` `initialize` | **200**, returns `atlas` / `1.0.2-alpha`, protocol `2025-03-26` |
| `POST /api/navigate` to a checkout URL | **refused**: `Payment blocked: this skill never pays. Navigation to a checkout/payment URL was refused.` |
| `GET /events` (SSE) | streams `{"type":"hello","actions":[],"errors":[],"steps":0,"maxSteps":100}` then live events |

## Honest limits — what was NOT verified live here

- **Real-site navigation and live screenshots from a real browser
  session.** Chromium in this build VM cannot reach the public internet
  directly (`net::ERR_TUNNEL_CONNECTION_FAILED`), so a live navigation
  (open a real site, see its screenshot in Live View) still needs
  verifying on a machine — or a deploy — with direct egress. Procedure:
  `docs/LIVE-TEST.md`. Do not claim this check passed until it has.
- **Phone / Windows / iPhone live driving.** `phone_status`,
  `windows_status` and `iphone_status` report `not-configured` until
  their own servers are pointed at Atlas; Artemis, UFO and
  iphone-control run separately and were not driven live here.
- **Live View on your phone over the internet.** The pages above are
  local. Reaching them from outside your own network needs a deploy
  with HTTPS + access controls — never expose the bare port publicly.

## How to re-verify (one minute)

```bash
npm test
npm run start:http
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
curl -s http://localhost:3100/api/status
curl -s -N http://localhost:3100/events   # Ctrl-C to stop
```

Then start the browser (`browser_start` tool) and navigate somewhere
real: the Live View screenshot and the event stream should update with
every step. If they don't, that is a real bug — report it with the
`/status` output.
