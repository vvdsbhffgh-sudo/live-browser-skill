# Claude Code setup

Claude Code runs MCP servers locally over **stdio** — the simplest setup,
no deploy needed.

## Steps

### 1. Install

```bash
git clone https://github.com/vvdsbhffgh-sudo/live-browser-skill.git
cd live-browser-skill
npm install
npx playwright install chromium
```

### 2. Add the MCP server

From inside your project directory:

```bash
claude mcp add atlas -- node /absolute/path/to/live-browser-skill/server/index.js
```

Or add it to your project's `.mcp.json`:

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

### 3. Live View (optional but recommended)

In a second terminal, run the HTTP server so you can watch the browser live:

```bash
npm run start:http
# Live View: http://localhost:3100/
```

Note: the stdio server and the HTTP server are two processes sharing the
same profile directory. Start the HTTP server first, then let Claude Code
use the stdio server — or just use the HTTP server alone if you prefer one
process (add it as a remote MCP server at `http://localhost:3100/mcp`).

### 4. Google sign-in (manual, once)

```bash
LIVE_BROWSER_HEADED=1 npm run start:http
```

Then ask Claude Code to run `browser_google_signin`, and **sign in yourself**
in the visible browser window with a **dedicated Google account** — never your
main personal account, never paste the password in chat.

## Use it

> "Open https://example.com in the live browser and click through the
> signup page. Show me screenshots."

Claude Code will use `browser_navigate`, `browser_snapshot` (refs),
`browser_click`, `browser_type`, and `browser_screenshot`.

**Payments are blocked by design** — checkout URLs, pay buttons, and
card numbers are refused with "Payment blocked: this skill never pays."
