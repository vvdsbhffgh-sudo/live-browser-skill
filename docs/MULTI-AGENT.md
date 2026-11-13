# Multi-agent — one agent, one browser, one account, one device

Several agents can work side by side, but they must never share a browser
profile, a Google account, or a phone. Each agent gets its own everything.
That isolation is the whole design: one agent's session, cookies, and
mistakes cannot leak into another's.

Config: [`config/agents.example.json`](../config/agents.example.json)
(copy it to `config/agents.json` and edit it — git-ignored).

## One agent = one of each

| Agent | Browser profile | Google account | Phone / emulator (if any) |
|---|---|---|---|
| `coder` | `./.profiles/coder` | `coder-<you>@gmail.com` (dedicated) | emulator-5554 |
| `writer` | `./.profiles/writer` | `writer-<you>@gmail.com` (dedicated) | — |
| `tester` | `./.profiles/tester` | `tester-<you>@gmail.com` (dedicated) | spare test phone |

Start each agent as its own server process with its own env:

```bash
LIVE_BROWSER_PROFILE=./.profiles/coder LIVE_BROWSER_PORT=3101 npm run start:http
LIVE_BROWSER_PROFILE=./.profiles/writer LIVE_BROWSER_PORT=3102 npm run start:http
LIVE_BROWSER_PROFILE=./.profiles/tester LIVE_BROWSER_PORT=3103 npm run start:http
```

Different ports, different profiles, different Live Views
(`http://localhost:3101/`, `:3102/`, `:3103/`). The model router
(`docs/MODEL-ROUTER.md`) decides which model each agent uses; the agent
config decides which browser and account it drives.

## The AI CANNOT create a Gmail account itself — plain fact

Google requires **human phone verification** to create a Gmail account.
There is no API, no tool, and no setting that lets an AI agent create a
Gmail account on its own, and this project will not pretend otherwise or
try to work around it. **The user creates each account manually:**

1. Create one dedicated Google account per agent (a test account, never
   your main personal account).
2. Sign in once, manually, in that agent's browser (`browser_google_signin`,
   headed mode) or on that agent's test device.
3. Complete phone verification yourself. The session then persists in that
   agent's profile.

If anyone promises "the AI creates its own Gmail accounts", they are
selling a bypass that will get the account locked. We do not build that.

## Rules for multi-agent runs

- **Never share a profile dir** between two running servers. Playwright
  will corrupt the profile or the two agents will fight over the same
  tabs.
- **Never share a phone.** One Artemis device per agent; see
  `docs/ARTEMIS.md` (dedicated test device only).
- **Never share a model key's quota blindly.** Free limits (OpenRouter
  `:free`: 20/min, 50/day) are per key, not per agent — two agents burn
  through them twice as fast. Give heavy agents the local Ollama route.
- **Pause is per agent.** Pausing the coder's browser does not pause the
  writer's. Use each agent's own Live View.
- **One agent's payment guard is every agent's payment guard.** The
  "never pays" rule is in the code every agent runs; there is no agent
  with a "paying" role.
