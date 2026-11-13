# Human checks ("Are you human?" / Cloudflare "Just a moment...")

Research date: 2026-11-13. Sources: trawl.me anti-bot guide (2026), browseract.com
CAPTCHA guides (2026), decodo.com Cloudflare guide (2026).

## What exists

| Tool / approach | What it does | Cost | What it cannot do |
|---|---|---|---|
| **2Captcha / Anti-Captcha** (human-powered solving services) | Real people solve a challenge you forward to them | $0.50–$3 per 1,000 solves, 15–30 s each | reCAPTCHA v3 (invisible scoring — nothing to hand to a human), Cloudflare Turnstile (~40% success), DataDome (not offered) |
| **CapSolver** (AI solver) | ML model solves challenges | $0.40–$0.90 per 1,000 solves, 1–3 s | Same limits as above; Turnstile success is low |
| **Stealth plugins** (puppeteer-extra-plugin-stealth, playwright-stealth, undetected-chromedriver / nodriver) | Patch the headless browser to hide automation signals (`navigator.webdriver`, plugin list, canvas noise, TLS fingerprint) | Free (open source) | Modern stacks check 200+ signals (TLS, WebGL, audio, fonts, behavioral timing). Every detection update breaks them for days/weeks — a maintenance treadmill. Open, unresolved detection issues against Cloudflare Managed Challenge |
| **Stealth browsers** (Camoufox, SeleniumBase UC mode, Patchright) | Fingerprint spoofing built into the browser instead of patched at runtime | Free (open source) | Stronger than plugins, still not a guarantee; same maintenance treadmill |
| **Residential proxies** | Real home IPs instead of datacenter IPs | Paid per GB | Fix the IP signal only, not the browser fingerprint |
| **Real headed browser + persistent profile + human solves once** | The browser is genuinely real: real history, cookies, your own IP | Free (your machine) | Needs a human once per check — this is Atlas's design |

## Why Atlas does NOT add any of these

1. **It is the agreed hard line.** Atlas never solves a human check — no solver,
   no stealth library. SECURITY.md, "Human checks".
2. **It would not work on Railway anyway.** The hosted Atlas runs on a shared
   datacenter IP — the worst possible signal for Cloudflare. Stealth plugins
   and solvers fail most often exactly there; adding one would likely get the
   server's IP flagged harder and break the browsing that works today.
3. **Modern challenges are verdicts, not puzzles.** Turnstile / reCAPTCHA v3 /
   Managed Challenge score the whole session (TLS, rendering, behavior,
   history). There is no puzzle to send to a solver.
4. **Maintenance treadmill.** Every Cloudflare detection update breaks stealth
   tools until the community catches up — days to weeks of breakage, forever.

## What Atlas does instead

- Detects a challenge (Cloudflare `__cf_chl_` / `cdn-cgi/challenge` / "Just a
  moment..." titles) → shows a banner in Live View and **auto-pauses** the AI.
- The legitimate path: solve the check once in a visible browser (a local
  headed Atlas run, or your own browser). The persistent profile then keeps
  the session, so the same site usually stops challenging you.

This document records the research so the decision is visible. It is not an
endorsement of any bypass tool, and none of them is installed in Atlas.
