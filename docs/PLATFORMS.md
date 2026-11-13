# Platforms — Android, Windows, iPhone (honest, no copied code)

Atlas itself is a **browser** skill: it drives a real Chromium browser on
the machine it runs on. The devices below are **separate open-source
projects** that Atlas can *talk to* — it does not contain, copy, or
re-implement any of their code. Each platform has its own status tool that
returns `not-configured` until you point Atlas at that project's own
server. Nothing here installs or starts those projects for you.

| Platform | Project | Status tool | Env var |
|---|---|---|---|
| Android (real phone / emulator) | Google Artemis (`google/artemis`, Apache 2.0) | `phone_status` | `ARTEMIS_MCP_URL` |
| Windows (real laptop / PC) | Microsoft UFO / UFO² (`microsoft/UFO`, MIT) | `windows_status` | `UFO_MCP_URL` |
| iPhone (real iPhone) | iphone-control (open, via WebDriverAgent / XCUITest) | `iphone_status` | `IPHONE_CONTROL_URL` |

## Android — Google Artemis

Fully documented in [`docs/ARTEMIS.md`](ARTEMIS.md). In short: Artemis is
Google's open-source agent (Apache 2.0, published 13 August 2026) that
drives a real Android phone or emulator over MCP. You need Python 3.12+,
a real Android device with USB Debugging or an emulator, a **dedicated
test device** (never your personal phone/accounts), and a separate model
API key paid by you. Android only — no iOS yet, no voice yet. The phone
flow is: you create a dedicated Gmail account manually once, sign it into
the test phone, install the Play Store apps once
(`config/play-store-apps.example.json`), and Artemis drives the phone.

## Windows — Microsoft UFO / UFO² (real laptop)

**What it is:** UFO is Microsoft's open-source **Windows AgentOS**
([microsoft/UFO](https://github.com/microsoft/UFO), MIT license, Python).
UFO² is the desktop AgentOS layer: it drives real Windows applications
through **UI Automation, Win32, and COM** — not just screenshots — with a
two-tier architecture: a **HostAgent** that decomposes a task and picks
applications, and per-application **AppAgents** that operate each app.
It supports **MCP** (its action layer is served as MCP servers), and it
runs on **Windows 10/11**.

**Requirements (all of them):**

1. A real Windows 10/11 machine with UFO installed per its own README
   (Python, its dependencies, and a model key of your own).
2. UFO's own MCP server running, so Atlas can point at it
   (`UFO_MCP_URL`).
3. **A dedicated Windows user account with low privileges for the
   agent.** This is the important one — see below.

**The safety warning (read this before you connect it):**

UFO runs **as the logged-in Windows user and has no sandbox**. There is
no permission/approval model built into UFO itself: an agent that can
click can click *anything that user can click* — open files, change
settings, install things, send mail as that user. Atlas's own guards
(payment block, sensitive-action block, step limit, domain lists) apply
to the *browser*, not to a UFO-driven desktop. So:

- Run UFO only under a **dedicated, low-privilege Windows account**
  created for the agent — never your main admin account, never an
  account with your files, mail, and banking in reach.
- Keep the agent's account empty: no personal documents, no saved
  passwords, no admin rights.
- Require **human confirmation before sensitive actions** on the
  desktop (delete, send, install, change settings). Atlas asks you;
  UFO on its own will not.
- If a desktop task asks for a password, a payment, or an install —
  you do it yourself, or stop the task.

**Connecting it to Atlas:**

```bash
# 1. Install and run UFO separately, per its own README (microsoft/UFO).
# 2. Point Atlas at UFO's MCP endpoint:
UFO_MCP_URL=http://localhost:<ufo-mcp-port>/mcp npm run start:http
```

Then `windows_status` reports `not-configured` (default), or
`configured` + whether the endpoint answers. Atlas only checks the
endpoint; desktop tasks run through UFO's own tools, not through Atlas.

## iPhone — iOS is closed (read this first)

**There is no third-party agent that drives an iPhone screen the way
Artemis drives Android.** iOS is a closed system: Apple does not give
third parties a debug bridge like Android's ADB. Artemis itself puts
iOS **on its roadmap only** — it does not exist yet. Anyone who tells
you "iPhone works just like Android" is selling something that does not
exist. **Do not expect iPhone to be as easy as Android. It is not.**

**The one documented route: iphone-control**

The open **iphone-control** tool lets an AI agent use a real iPhone or
iPad plugged into a Mac or Linux machine — look at the screen, tap,
type, open apps — through MCP tools, on top of Apple's own
**WebDriverAgent (WDA) / XCUITest** automation. (Docs:
<https://derrors.github.io/iphone-control/en/guide/what-is-iphone-control>)

**Requirements (all of them, and all done by you, once, by hand):**

1. **A real iPhone, iOS 17 or later**, plugged in by **USB** to a
   **Mac or Linux** machine. A spare test iPhone — never your main phone.
2. **Developer Mode on** (Settings → Privacy & Security → Developer
   Mode; the switch appears after a developer tool has seen the phone).
3. **Trust the computer** on the phone, **trust the developer
   certificate** (Settings → General → VPN & Device Management), and
   **enable UI Automation** (Settings → Developer).
4. **A free Apple ID** (a dedicated one is recommended) to sign
   WebDriverAgent. Free signatures **expire after 7 days** and must be
   renewed (re-signed) — the tool re-signs automatically where it can,
   but an expired Apple ID session needs you to sign in again.
5. **Enter the lock passcode manually on the phone after a reboot.**
   iOS asks for the passcode to allow UI automation; no tool can skip
   that — it is an Apple security rule. The agent waits; you type it.

**What that means in practice:** iPhone control needs a Mac/Linux host,
a cable, a weekly re-sign, and you, in person, for trust prompts and the
passcode. It is a spare-phone bridge for patient, supervised use — not a
"plug in any iPhone and go" feature. Budget an afternoon for the first
setup, and expect to re-sign every 7 days on a free Apple ID (a paid
Apple Developer account, $99/year, signs for a year instead).

**Connecting it to Atlas:**

```bash
# 1. Set up iphone-control separately, per its own docs, on the Mac/Linux host.
# 2. Point Atlas at its endpoint:
IPHONE_CONTROL_URL=http://localhost:<iphone-control-port>/mcp npm run start:http
```

Then `iphone_status` reports `not-configured` (default), or `configured`
+ whether the endpoint answers. Atlas only checks the endpoint; iPhone
tasks run through iphone-control's own tools, not through Atlas.

## The honest comparison

| | Android (Artemis) | Windows (UFO) | iPhone (iphone-control) |
|---|---|---|---|
| Real device control | Yes | Yes | Yes, with much more setup |
| Needs a host machine | Linux/Mac/Windows + USB | The Windows PC itself | Mac or Linux + USB cable |
| Dedicated test device/account | Yes | Yes (low-privilege Windows account) | Yes (spare iPhone + dedicated Apple ID) |
| Re-signing / renewal | No | No | Yes — every 7 days (free Apple ID) |
| Human steps | Sign in once, by hand | Human confirmation for sensitive desktop actions | Trust prompts + lock passcode by hand, after reboots |
| Sandbox | No — dedicated device | **No — dedicated account is the sandbox** | iOS sandbox, but WDA runs with your trust |
| Difficulty | Medium | Medium | Hard — never as easy as Android |
