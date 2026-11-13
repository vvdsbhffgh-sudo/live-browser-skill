# Cursor setup

Cursor runs MCP servers locally over **stdio** — no deploy needed.

## Steps

### 1. Install

```bash
git clone https://github.com/vvdsbhffgh-sudo/live-browser-skill.git
cd live-browser-skill
npm install
npx playwright install chromium
```

### 2. Add the MCP server

Open Cursor → **Settings → Tools & MCP** (or `Cursor Settings → MCP`) →
**Add custom MCP server**, and paste:

```json
{
  "mcpServers": {
    "live-browser": {
      "command": "node",
      "args": ["/absolute/path/to/live-browser-skill/server/index.js"]
    }
  }
}
```

Or add the same block to your project's `.cursor/mcp.json`.

### 3. Live View (optional but recommended)

In a terminal, run:

```bash
npm run start:http
# Live View: http://localhost:3100/
```

### 4. Google sign-in (manual, once)

```bash
LIVE_BROWSER_HEADED=1 npm run start:http
```

Then ask Cursor's agent to run `browser_google_signin`, and **sign in yourself**
in the visible browser window with a **dedicated Google account** — never your
main personal account, never paste the password in chat.

## Use it

In Cursor's Agent/Chat, ask for example:

> "Open my site in the live browser, test the login flow, and show me
> what you see."

The agent uses `browser_navigate`, `browser_snapshot` (refs),
`browser_click`, `browser_type`, and `browser_screenshot`.

**Payments are blocked by design** — checkout URLs, pay buttons, and
card numbers are refused with "Payment blocked: this skill never pays."
