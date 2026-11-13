# Google Artemis — real Android phone control (docs + status only)

Artemis is Google's own open-source agent for driving a **real Android
phone** — not a browser tab pretending to be a phone. This repo does **not**
contain, copy, or re-implement any Artemis code. Artemis runs separately, on
your machine, and this skill only checks whether its MCP server is reachable
(`phone_status` tool, `ARTEMIS_MCP_URL`).

## What Artemis is

- **Project:** [google/artemis](https://github.com/google/artemis) on GitHub.
- **License:** Apache 2.0 (open source).
- **Published:** 13 August 2026.
- **What it does:** takes plain-language instructions and carries them out on
  a real Android phone or emulator — opens apps, taps, types, checks the
  result, collects logs and screenshots. It exposes its own MCP server
  (`mobile_run_task`, `mobile_manage_task`, `mobile_get_device_state`,
  `mobile_inspect_trace`, `mobile_diagnose`) for Claude Code, Antigravity,
  Cursor, Codex, Windsurf and others.
- **No tagged releases yet:** install from source and pin a commit SHA if you
  need a frozen version.

## Requirements (all of them — there is no shortcut)

1. **Python 3.12+** on the machine that hosts Artemis.
2. **A real Android phone with USB Debugging enabled, or an emulator.**
   The phone must be connected before you start.
3. **A DEDICATED test device — never your personal phone, never your
   personal accounts.** The agent taps, installs, logs in and changes things
   on that phone. Use a spare phone / emulator and test accounts only.
   If the device holds your photos, messages, banking or main Google
   account, do not connect it.
4. **A separate model API key, paid by you to your provider**
   (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.). Artemis is free code; the
   model it drives is not free. The key is yours, stored in your own
   environment, never in this repo and never pasted in chat.
5. **Artemis's own MCP server running** (e.g. `artemis mcp --install claude`
   for Claude Code). This skill does not start Artemis for you.

## What it cannot do (honest limits)

- **Android only. No iOS yet** — iOS support is on Artemis's roadmap, not
  available.
- **No voice yet** — Artemis tasks are text instructions; there is no voice
  control of the phone in the current version.
- **No hosted version** — there is no cloud Artemis to point at; it runs on
  your machine, next to the device.
- **Benchmark claims are Google's own** (99%+ on the AndroidWorld suite, as
  reported in the Artemis README). Treat that as a showcase figure, not an
  independent verification.
- **The AI cannot create the Google account on the phone for you.**
  Google requires human phone verification for new accounts — the user
  creates each account manually (see `docs/MULTI-AGENT.md`).

## The phone flow, step by step (confirmed)

This is the flow the user confirmed. Every step is done by the **user**,
once, by hand. The AI never does any of these steps itself:

1. **Create a dedicated Gmail account manually, once.** A test account,
   created by you in a browser, with human phone verification. The AI
   cannot create Gmail accounts (Google requires human phone
   verification) — see `docs/MULTI-AGENT.md`.
2. **Sign that account into a test Android phone.** A dedicated test
   device — a spare phone or an emulator — never your personal phone and
   never your personal accounts. If the device holds your photos,
   messages, banking, or main Google account, do not use it.
3. **Install the needed Play Store apps once, yourself, from the Play
   Store on that phone.** Pick from the curated list in
   [`config/play-store-apps.example.json`](../config/play-store-apps.example.json)
   (browser, Maps, YouTube, Gmail, Drive, Files, …) — copy it to
   `config/play-store-apps.json`, tick what you need, install those apps
   from the Play Store. Artemis can then open the apps you installed.
4. **Artemis drives the real phone.** With the device connected (USB
   Debugging or emulator) and Artemis running, the AI carries out tasks
   on that phone through Artemis's own MCP tools — opening apps, tapping,
   typing, checking results, collecting screenshots and logs.

**App updates:** updates come from the Play Store itself, on the device —
enable auto-update in the Play Store app (Play Store → Settings →
Auto-update apps) or update apps manually there. There is no tool in this
project that installs or updates apps, and nothing here bypasses Play
Store verification. Any tool that claimed to sideload or force-install
apps past the store would be a bypass — we do not build that.

## Connecting it to this skill

```bash
# 1. Install and run Artemis separately, per its own README:
git clone https://github.com/google/artemis.git && cd artemis && ./start.sh

# 2. Point this skill at the Artemis MCP endpoint:
ARTEMIS_MCP_URL=http://localhost:8000/mcp npm run start:http
```

Then ask the agent for `phone_status`:

- **Not configured** (`ARTEMIS_MCP_URL` unset): the skill controls the
  desktop browser only. It cannot touch any phone. This is the default.
- **Configured + reachable:** the Artemis server answers. Phone tasks still
  run through Artemis's own tools — this skill only reports status; it does
  not issue phone taps itself.

## Safety rules for the phone

- Dedicated device, dedicated test Google account, nothing personal on it.
- The payment guard in this repo applies to the browser. On the phone,
  Artemis has its own safety layers — and the same rule applies: never let
  any agent complete a purchase, and never enter real card details on a
  test device.
- If a phone task asks for a password, 2-step code, or payment — you do it
  yourself on the device, or stop the task.
