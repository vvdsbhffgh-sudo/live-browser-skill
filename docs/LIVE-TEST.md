# LIVE-TEST — testing Atlas the way a real person would

This is the test you can actually run, and the one that matters: Atlas,
driving a **real headed browser** with a **persistent profile**, on a
**real website**, while you watch the **Live View**. No mocks, no
simulated pages, no fake screenshots.

It does not test bypassing CAPTCHA or any human check — that is
never built (see `FEATURES.md`, **Never**, and `SECURITY.md`, "Human
checks"). If a human check appears during the live test, that is a
*passing* observation of the guard working: the agent stops, and you
solve it manually. Record that it happened.

## Before you start

- [ ] Node.js 20+ installed.
- [ ] `npm install` and `npx playwright install chromium` done in the repo.
- [ ] `npm test` green (33+ tests) — the unit gate, before the live test.
- [ ] A **dedicated Google account** for the AI browser (not your main
      account), if the test includes Google sign-in.
- [ ] A real website you are allowed to test (e.g. your own site, or a
      public demo site). Do not test against someone else's login or
      checkout.

## The live test (about 10 minutes)

### 1. Start Atlas with a visible window

```bash
LIVE_BROWSER_HEADED=1 npm run start:http
```

Open the Live View in your own browser: `http://localhost:3100/`.
You should see the LIVE badge, "browser not started yet", and the
Pause / Resume / Record buttons.

### 2. Start the browser and navigate (agent does this)

Ask the agent (Claude Code / Cursor / your MCP client) to:

1. `browser_start` — the Chromium window appears on your screen.
   Confirm in the Live View that the screenshot matches the window.
2. `browser_navigate` to a real site, e.g. `https://example.com` and
   then your own site's homepage.
3. `browser_snapshot` — check the refs listed match what you see.
4. `browser_screenshot` — compare the Live View image with the real
   window. They must show the same page.

**What to record:** the URL in the Live View, the screenshot, and
whether the headed window and the Live View agree. If they disagree,
stop — that is a real bug.

### 3. Click and type at human pace (agent does this)

Ask the agent to click a real link (by ref) and type into the site's
search box (if it has one), then `browser_press` Enter. Watch the Live
View: each action appears in the log, the screenshot refreshes, and the
actions happen at a human pace — short delays between steps, not a
machine-gun burst.

**What to record:** the action log lines, and that no action happened
without a log line.

### 4. Pause and take over (you do this)

1. Press **Pause** in the Live View (or ask for `browser_pause`).
2. Ask the agent to navigate somewhere else — it must be **refused**
   with "Paused".
3. Click something yourself in the headed Chromium window.
4. Press **Resume** — the agent can act again.

**What to record:** the refusal while paused, and that your own click
worked while the agent was paused.

### 5. Google sign-in (you do this, once)

1. Ask the agent for `browser_google_signin` (opens accounts.google.com).
2. **Sign in yourself** in the headed window with the dedicated Google
   account. Type the password yourself; complete any 2-step check
   yourself.
3. Ask the agent for `browser_status` — it should report a signed-in
   Google account.
4. Stop the server (`Ctrl+C`) and start it again. Ask for
   `browser_status` — the session must still be there (persistent
   profile). You did **not** sign in twice.

### 6. The guards (agent tries, Atlas refuses)

Ask the agent to try each of these and record the refusal:

- Navigate to a checkout URL (e.g. any `/checkout` page) → "Payment
  blocked".
- Navigate to `http://example.com` (plain http, not localhost) →
  "HTTPS only".
- Click a "Pay now" / "Delete" element → refused (payment / sensitive).
- If a CAPTCHA or "are you human?" check appears at any point: the
  agent must stop. **You** solve it manually in the headed window, then
  resume. Record that it happened and that the agent did not try to
  go around it.

### 7. Modes (agent does this)

Ask the agent for `browser_mode` (view), then switch to `research`
mode and try to type into a form — it must be refused (research mode
does not allow typing). Switch back to `coding`.

## Pass / fail

The live test **passes** when:

- The headed window and the Live View show the same pages, live.
- Every agent action has a log line and a fresh screenshot.
- Pause actually stops the agent; Resume actually restarts it.
- The Google session survives a restart (signed in once, by you).
- Every guard refusal above happened with a clear message.
- Any human check that appeared was solved by you, manually, with the
  agent stopped — and recorded as such.

The live test **fails** (file a bug) when:

- The Live View and the headed window disagree.
- An action happens with no log line.
- The agent acts while paused, or pays, or types a card number.
- The agent tries to work around a human check instead of stopping.

## Known limitation (recorded 2026-11-13)

Chromium in the build VM could not reach the public internet directly
(`ERR_TUNNEL_CONNECTION_FAILED`), so real-site navigation could not be
verified there. Run this live test on your own machine (or a deploy
with direct egress) — that is the remaining verification step, and the
result belongs in the test record, not in a claim.
