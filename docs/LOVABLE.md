# Lovable setup

**Honest summary (verified 2026-11-13):** Lovable accepts custom MCP servers
only as **remote HTTPS chat connectors while building**. It cannot reach
`localhost`, and the browser is **not** inherited by the published app — it is
a build-time tool for the agent, not a runtime feature for your end users.

## What you get

While you build in Lovable, its AI can drive a real Chromium browser: open
pages, click through your site, log in with a dedicated Google account, and
you watch every step live. Your published app does **not** get a browser.

## Steps

### 1. Deploy the server (pick one)

- Railway: follow `deploy/railway.md`
- Render: follow `deploy/render.md`
- Any host that can run the Dockerfile in `deploy/Dockerfile` with port 3100

You will get a public HTTPS URL, e.g. `https://live-browser-xxxx.up.railway.app`.

> Alternative for a quick test: expose your local server with a tunnel
> (`cloudflared tunnel --url http://localhost:3100` or `ngrok http 3100`)
> and use the tunnel's `https://…` URL. Tunnels are fine for testing, not
> for anything long-lived.

### 2. Add it in Lovable

1. Open your Lovable project → **Connectors** (or **Integrations**).
2. Choose **Custom MCP** / **Add personal MCP server**.
3. Server URL: `https://<your-host>/mcp`
4. Transport: **Streamable HTTP** (if asked). No API key / no auth header —
   do not put any password or token here.
5. Save. Lovable should list the tools (`browser_navigate`, `browser_snapshot`,
   `browser_click`, …).

### 3. Use it

Ask Lovable's AI, in plain language, for example:

> "Open my site in the live browser, click through the signup flow, and
> tell me what you see."

- Watch it live at `https://<your-host>/` (the Live View page).
- Google sign-in: ask the AI to run `browser_google_signin`, then **you**
  sign in manually in the visible browser with a **dedicated Google account**
  (never your main personal account, never paste the password in chat).
  On a hosted deploy the browser is headless, so do the first sign-in
  **locally** (`LIVE_BROWSER_HEADED=1 npm run start:http`), then deploy —
  the session lives in the profile directory.
- **Payments are blocked by design.** If the AI reports "Payment blocked",
  that is the skill working as intended.

## Limits (please read)

- Lovable cannot connect to `http://localhost:3100` — a public HTTPS URL is required.
- The published Lovable app does **not** inherit the browser or the Google session.
- Lovable's MCP support may change; if the Connectors screen looks different,
  look for "Custom MCP server" / "Remote MCP" in Lovable's docs.
