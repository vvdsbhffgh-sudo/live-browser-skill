# Security Policy

## What this project never does

- **Never pays.** Checkout/payment pages and card numbers are blocked in code
  (`server/guard.js`). No tool can submit a payment.
- **Never handles passwords.** Google sign-in is manual, by the user, in the
  browser window. Never paste a password in chat, in an issue, or in any file.
- **No credentials in the repo.** No tokens, API keys, or session files are
  committed (`.live-browser-profile/`, `live/`, and `.env` are git-ignored).
- **Never bypasses CAPTCHA or "are you human?" checks, and never uses a
  CAPTCHA solver.** When one appears, the agent stops and the user solves
  it manually. See "Human checks" below and `FEATURES.md` (Never).
- **Never creates Gmail accounts.** Google requires human phone verification;
  the user creates each account manually. See `docs/MULTI-AGENT.md`.

## HTTPS-only (Wave 3)

- **The browser only navigates to `https://` URLs.** Plain `http://` is
  refused except for `localhost` / `127.0.0.1` (local dev servers and the
  local Live View). This is enforced in `server/guard.js`
  (`checkSecureUrl`) and covered by tests.
- **TLS certificate verification is never disabled.** This project contains
  no `rejectUnauthorized: false`, no `--ignore-certificate-errors`, and no
  other insecure-TLS flag anywhere. If a site's certificate is invalid, the
  browser refuses it — that is the correct behaviour.
- **Deployed instances must be behind HTTPS.** When the server is deployed
  (Railway / Render / Fly.io / a tunnel), serve it over `https://` — either
  the platform's TLS or a reverse proxy / tunnel that terminates TLS
  (e.g. Cloudflare Tunnel). Lovable and Replit only accept remote MCP
  servers over HTTPS anyway. Never expose the plain-HTTP server directly
  to the public internet: the Live View, the REST API, and `/mcp` have no
  authentication in 1.0.1-alpha (Live View auth is on the roadmap in
  `FEATURES.md`). Bind to `localhost` when running locally, and use a
  tunnel with access controls when sharing it.

## Security model (what protects you, in one place)

Atlas is designed so that no single failure gives an agent — or an
attacker who tricks it — the keys to everything:

1. **HTTPS-only transport.** The browser navigates to `https://` only
   (except `localhost`). Plain `http://` to any other host is refused in
   code (`server/guard.js`, `checkSecureUrl`).
2. **TLS certificate verification, always on.** This project never sets
   `rejectUnauthorized: false`, `--ignore-certificate-errors`, or any
   insecure-TLS flag. A site with an invalid, expired, or mismatched
   certificate is refused by the browser — that is the correct behaviour,
   not a bug to work around.
3. **Local data only.** The browser profile (including the Google session
   cookie), the session recordings, and the screenshots live in
   `.live-browser-profile/` and `live/` on the machine running the server.
   Both are git-ignored. Nothing in this project uploads them anywhere.
4. **Audit log.** Every tool call is logged (time, tool, summarised args,
   result) to the Live View and to `live/session-<timestamp>.json`. You
   can see everything the agent did, after the fact as well as live.
5. **Least privilege by default.** Read-only mode, domain allow/block
   lists, the sensitive-action block (delete/send/publish need explicit
   human approval), the step limit, and the per-mode allowed tools
   (`config/modes/`) all narrow what the agent may do. A mode can only
   narrow, never widen past a guard.
6. **Human in the loop for the irreversible.** Payments are impossible by
   design; sensitive actions need approval; human checks (CAPTCHA) are
   solved by the user, not the agent (see below).
7. **No credentials in the repo.** No tokens, API keys, or session files
   are committed. Model keys and the Artemis key are yours, in your own
   environment, sent only to the provider you configured.

**No absolute guarantee.** Nothing in this document is a promise that
nothing can ever go wrong. A browser that logs into real accounts and
clicks real buttons is a powerful tool, and no list of controls makes
that risk zero: a site can change, a provider can change its limits, a
model can misread a page, and a human can approve the wrong thing. What
this project guarantees is the *design*: the controls above are in the
code, they are tested, and they fail closed (a refused action stops the
agent; it does not silently continue). You stay responsible for what you
approve, which accounts you connect, and which device you attach. If you
want stronger isolation, run Atlas on a dedicated machine or VM with a
dedicated test account and a dedicated test phone — that is the safest
setup, and the one the docs recommend.

## Human checks — CAPTCHA / "are you human?"

Atlas does **not** bypass human verification, and it contains **no
CAPTCHA solver** of any kind. What it does instead is the legitimate
approach, and only that:

- **A real, headed browser.** The agent drives a genuine Chromium
  window (headed mode when you sign in), not a headless bot profile
  pretending to be a browser.
- **A persistent profile with real history.** The same profile dir is
  reused across runs, so the browser has ordinary cookies and browsing
  history — like a person's browser, because that is what it is: your
  browser, driven by an agent you supervise.
- **Human pace.** The agent pauses briefly between actions (a short
  settle delay after clicks and key presses) instead of hammering a
  site at machine speed.
- **Pause and hand over.** When a CAPTCHA or "are you human?" check
  appears, the agent **stops** — it does not try another URL, another
  button, or another wording to get around it. It tells you, and you
  solve the check yourself in the browser window (or press Pause in the
  Live View and take over), then tell the agent to continue with
  `browser_resume`.

Any tool, plugin, or configuration that defeats human verification is
out of scope for this project and will not be accepted as a contribution.

## Recording: voice, video, and session (Wave 3)

- **Recording starts and stops only on your command.** The Live View
  Record button, `POST /api/record`, and the session-recording flag are
  the only controls. Nothing records in the background without you
  starting it, and the button always shows the current state.
- **Recordings are stored locally only** — in `live/` on the machine
  running the server (git-ignored, never uploaded). Nothing is sent to
  any cloud service by this project.
- **Voice/video:** the same rule applies when voice or video recording
  ships (roadmap in `FEATURES.md`): it starts/stops only on your command,
  is stored locally, and is never streamed to a third party by this
  project. If you use a cloud transcription or vision model, that is your
  own configured provider, under your own account and key.
- **Pause before you take over:** use Pause in the Live View (or
  `browser_pause`) before typing anything sensitive yourself in the
  browser — the agent cannot act while paused.

## Human approval before sensitive actions

- Delete / send / publish / remove are refused unless
  `LIVE_BROWSER_ALLOW_SENSITIVE=1` is explicitly set. A human-approval
  queue in the Live View (Approve / Reject) is on the roadmap.
- The step limit (`LIVE_BROWSER_MAX_STEPS`, default 100) and the domain
  allow/block lists bound what any agent — including a compromised or
  confused one — can do in one run.

## Phone (Artemis)

- Use a **dedicated test device only** — never your personal phone or
  personal accounts (see `docs/ARTEMIS.md`). The phone's model key is
  yours, paid by you, stored in your own environment.
- This skill only checks whether the Artemis MCP endpoint answers
  (`phone_status`); it issues no phone actions itself.

## Use a dedicated Google account

Sign in with a Google account created for the AI browser — never your main
personal account. If that account is ever compromised, revoke it from the
Google account security page; the browser profile only holds a session
cookie, not your password.

## Reporting a vulnerability

Open a GitHub issue titled `[security]` with a description of the problem and
steps to reproduce. Do not include any password, token, or personal data.
