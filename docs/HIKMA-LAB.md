# Hikma Lab — using Atlas with the user's Hikma Lab app

The user's app is **Hikma Lab** (معمل الحكمة), at
`hikmalab11.lovable.app`, and its AI is **Zakat al-Hikma** (زكاة الحكمة).
This page documents how that AI uses Atlas — a real browser, a real
Android phone, and a real Windows machine — without putting any
credential in the public repo and without pretending credits have
no limits.

## The setup (one dedicated account, three surfaces)

Atlas is driven by **one dedicated Google account** that the user
creates and owns. That account is the AI's identity in the browser and
on the test phone. It is **never** the user's main personal account.

| Surface | How Atlas uses it | What you set |
|---|---|---|
| **Browser** (Atlas itself) | Signs in once, manually, in the headed browser window; the session persists in the browser profile | `ATLAS_GOOGLE_ACCOUNT` in your own `.env` (local only) |
| **Android phone** (Google Artemis) | The same dedicated Gmail is signed into the test Android phone once; Artemis drives that phone | Same account, on the phone, by hand — see `docs/ARTEMIS.md` |
| **Windows** (Microsoft UFO) | A dedicated low-privilege Windows account runs the desktop agent | A separate Windows account — see `docs/PLATFORMS.md` |

## Steps

1. Clone Atlas and install it (see the README Quickstart).
2. Copy `.env.example` to `.env` and set `ATLAS_GOOGLE_ACCOUNT` to the
   dedicated account's email address. **This file stays on your own
   machine. `.env` is git-ignored; never paste the address — or any
   password — into the public repo, a chat message, or an issue.**
   The exact address is the user's to fill in; the repo ships only the
   empty placeholder.
3. Start the headed server: `LIVE_BROWSER_HEADED=1 npm run start:http`.
4. Ask the agent to run `browser_google_signin`, then **sign in
   yourself** in the browser window with the dedicated account.
   The AI never sees, types, or stores the password.
5. For the phone: point Atlas at your Artemis server
   (`ARTEMIS_MCP_URL`); for Windows: point it at UFO (`UFO_MCP_URL`).
   Both stay separate projects — Atlas only checks their status.
6. Point the Hikma Lab AI at Atlas's MCP server (stdio for Claude
   Code / Cursor, or the deployed HTTPS endpoint for Lovable / Replit
   — see `docs/LOVABLE.md` and `docs/REPLIT.md`).

## What this gives Zakat al-Hikma

- A **live browser** it can drive (navigate, click, type, screenshot,
  tabs) while the user watches everything in the Live View
  (`http://localhost:3100/`), including from their phone on the same
  Wi-Fi — see `docs/LIVE-VERIFIED.md`.
- A **real Android phone** to try things on (Artemis), and a **real
  Windows machine** to try things on (UFO) — same account, same setup.
- A **50+ model router** (`docs/MODEL-ROUTER.md`) that switches models
  by task strength when one hits its free limit, so work continues
  instead of stopping — famous or not, ranked by benchmark, not fame.

## What it does NOT do (read before you rely on it)

- **No credits without limits.** Calling the pool "without limits" is a figure of speech: every
  free provider has a hard cap (OpenRouter `:free`: 20 req/min,
  50/day, 1,000/day after $10 lifetime purchases; Groq free: per-model
  caps; Gemini / SambaNova free tiers: per-model quotas). Pooling 50+
  models raises total free capacity a lot, but it never removes the
  caps. Local Ollama has no meter — its limit is your hardware.
- **No automatic Gmail creation.** Google requires human phone
  verification; the AI cannot create the account itself. The user
  creates it once, by hand.
- **No credential storage.** No email password, no API key, and no
  account address is ever committed to this repo. Keys live in your
  own `.env` (git-ignored) or in the provider's own console.
- **No CAPTCHA bypass.** The agent uses a real headed browser and
  pauses for the user to solve a human check manually.
- **Lovable / Replit cannot reach `localhost`.** The browser is a
  build-time tool; deploy the server first (see `deploy/`) before
  connecting it as a remote MCP server.
