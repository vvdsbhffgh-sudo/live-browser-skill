# Famous tools — what Atlas can integrate, officially only

Atlas integrates with other tools **only through their official,
public integration** — their MCP server, their public API, or their
published package — with **your account and your key**, and only after
**you approve it**. Atlas never copies another tool's code into itself,
and never pretends to "be" another tool.

## Open / free tools that integrate officially

| Tool | License | How Atlas connects | Account / key needed |
|---|---|---|---|
| **Microsoft UFO / UFO²** | MIT | UFO's own MCP server — point Atlas at it with `UFO_MCP_URL` (`windows_status`). See `docs/PLATFORMS.md`. | Your own model key; dedicated low-privilege Windows account |
| **Google Artemis** | Apache 2.0 | Artemis's own MCP server — `ARTEMIS_MCP_URL` (`phone_status`). See `docs/ARTEMIS.md`. | Your own model key; dedicated test Android device + test Google account |
| **GitHub MCP** | GitHub's official MCP server | The GitHub connector (OAuth) + repository selection in Muse; Atlas code can also call the GitHub CLI/API with your auth | Your GitHub account; you choose which repos it may reach |
| **Playwright** | Apache 2.0 | Bundled dependency of Atlas itself (`npm install`, `npx playwright install chromium`) | None — no account, no key |
| **Ollama** | MIT | Local HTTP API on your machine (`http://localhost:11434`) — the model router's local route | None — no account, no key; models run on your hardware |
| **OpenRouter** | Public API (free tier + paid) | Model router's OpenRouter route, with **your** API key in your own environment | Your OpenRouter account + key (free tier: 20/min, 50/day, 1,000/day after $10 lifetime) |

Also integrable the same way (official MCP/API, your account, your
approval): Gemini (Google AI Studio key), Groq (Groq console key) — see
`docs/FREE-MODELS.md` and `docs/MODEL-ROUTER.md`.

## Closed / paid tools — the hard line

Tools that are **closed-source or paid** — GitHub Copilot is the usual
example, and the same applies to any other closed AI coding tool — are
**not** copied, cloned, or "merged" into Atlas:

- **Their code cannot be copied.** It is proprietary; there is no
  license that allows it, and no clean-room claim makes it legitimate.
- **They cannot be auto-merged.** There is no mechanism that absorbs a
  closed product into an open repo.
- **Integration, if any, is only through their official MCP server or
  public API, with your account and your key, after you approve it.**
  If the vendor offers an MCP server or an API, Atlas can talk to it
  exactly like any other MCP server — as a separate service, under your
  account, metered by the vendor. If the vendor offers no public
  integration, there is no integration. That is the whole answer.

**No fake integration will ever be invented here.** If a table, a doc,
or a tool in this repo claims Atlas "includes" or "contains" a closed
product, that claim is wrong — report it as a bug.

## How to add an integration

1. Check the license (open) or the vendor's public integration docs
   (closed, API/MCP only).
2. Note the account/key it needs and who pays for it (you, to the
   vendor — never through Atlas).
3. Add it as a *separate* config entry (env var + status tool), the way
   Artemis, UFO, and iphone-control are done — never by copying code.
4. Document it in this file and in `docs/PLATFORMS.md` where relevant.
