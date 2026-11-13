# Deploy to Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service → Build and deploy from a GitHub repo** →
   pick this repo.
3. Settings:
   - **Environment:** Docker
   - **Dockerfile Path:** `deploy/Dockerfile`
   - **Plan:** pick any (the free plan works for testing; the browser needs
     ~512 MB RAM — if Chromium is killed, use a larger plan).
4. Add a **Persistent Disk** mounted at `/data` (keeps the browser profile —
   and the Google session — across deploys).
5. Set environment variables:
   - `LIVE_BROWSER_PORT=3100`
   - `LIVE_BROWSER_PROFILE=/data/profile`
   - `LIVE_BROWSER_HEADED=0`
   - Optional Wave 2: `LIVE_BROWSER_MAX_STEPS=100`,
     `LIVE_BROWSER_BLOCKED_DOMAINS=`, `LIVE_BROWSER_READONLY=0`
6. Deploy. Render gives you a public URL, e.g.
   `https://live-browser-xxxx.onrender.com`.
7. MCP endpoint: `https://<your-host>/mcp` — add it in Lovable
   (Connectors → Custom MCP) or Replit (Integrations → personal MCP server).
8. Live View: `https://<your-host>/`

Note: on a hosted deploy the browser is headless, so do the first Google
sign-in **locally** first (see README). The session lives in the profile
directory (`/data/profile`).
