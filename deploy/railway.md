# Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway detects the `deploy/Dockerfile` automatically (or set the builder
   to Dockerfile with path `deploy/Dockerfile`).
4. Add a **Volume** mounted at `/data` (keeps the browser profile — and the
   Google session — across deploys).
5. Set variables:
   - `LIVE_BROWSER_PORT=3100` (or leave unset; Railway sets `PORT` — if your
     Railway service uses `PORT`, set `LIVE_BROWSER_PORT` to the same value
     or change the code's default. Simplest: set `LIVE_BROWSER_PORT=3100`
     and expose port 3100.)
   - `LIVE_BROWSER_PROFILE=/data/profile`
   - `LIVE_BROWSER_HEADED=0`
   - Optional Wave 2: `LIVE_BROWSER_MAX_STEPS=100`,
     `LIVE_BROWSER_BLOCKED_DOMAINS=`, `LIVE_BROWSER_READONLY=0`
6. Deploy. Railway gives you a public URL, e.g.
   `https://live-browser-xxxx.up.railway.app`.
7. MCP endpoint: `https://<your-host>/mcp` — add it in Lovable
   (Connectors → Custom MCP) or Replit (Integrations → personal MCP server).
8. Live View: `https://<your-host>/`

Note: on a hosted deploy the browser is headless, so do the first Google
sign-in **locally** first (see README), then copy the profile — or accept
that hosted sign-in needs the profile directory synced. The session lives
in the profile directory (`/data/profile`).
