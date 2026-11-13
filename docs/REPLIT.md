# Replit setup

**Honest summary (verified 2026-11-13):** Replit Agent accepts custom MCP
servers only as **remote HTTPS servers** while building. It cannot reach
`localhost`, and the browser is **not** inherited by the published app — it is
a build-time tool for the agent, not a runtime feature for your end users.

## What you get

While you build in Replit, Replit Agent can drive a real Chromium browser:
open pages, click through your site, log in with a dedicated Google account,
and you watch every step live. Your deployed Repl does **not** get a browser.

## Steps

### 1. Deploy the server (pick one)

- Railway: follow `deploy/railway.md`
- Render: follow `deploy/render.md`
- Or deploy this repo itself as a Replit (Node.js, run `npm run start:http`).

You will get a public HTTPS URL, e.g. `https://live-browser-xxxx.up.railway.app`.

> Quick test alternative: expose your local server with a tunnel
> (`cloudflared tunnel --url http://localhost:3100` or `ngrok http 3100`)
> and use the tunnel's `https://…` URL.

### 2. Add it in Replit

1. Open your Replit → **Integrations** (or Agent's MCP / integrations panel).
2. Choose **Add personal MCP server** / **Custom MCP server**.
3. Server URL: `https://<your-host>/mcp`
4. Transport: **Streamable HTTP** (if asked). No auth header — do not put
   any password or token here.
5. Save. Replit should list the tools (`browser_navigate`, `browser_snapshot`,
   `browser_click`, …).

### 3. Use it

Ask Replit Agent, for example:

> "Open my site in the live browser, test the signup flow, and show me
> screenshots of what you see."

- Watch it live at `https://<your-host>/` (the Live View page).
- Google sign-in: ask the agent to run `browser_google_signin`, then **you**
  sign in manually with a **dedicated Google account** (never your main
  personal account, never paste the password in chat). On a hosted deploy the
  browser is headless, so do the first sign-in **locally**
  (`LIVE_BROWSER_HEADED=1 npm run start:http`) first — the session lives in
  the profile directory.
- **Payments are blocked by design.** "Payment blocked" means the guard works.

## Limits (please read)

- Replit cannot connect to `http://localhost:3100` — a public HTTPS URL is required.
- The published Repl does **not** inherit the browser or the Google session.
- Replit's MCP UI may change; look for "personal MCP server" / "custom MCP"
  in Replit's docs if the panel looks different.
