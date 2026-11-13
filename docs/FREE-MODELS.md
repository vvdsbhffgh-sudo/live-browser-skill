# Free models, pooled — large free credit, never limitless

Atlas is model-agnostic: any MCP client can drive the browser, and the
model router (`docs/MODEL-ROUTER.md`,
`config/model-router.example.json`) picks which model answers each task.
This page lists the **real free providers** the router can pool, with the
real limits of each. Pooling them raises the total free capacity a lot —
but every provider still has a hard cap. Nothing here is limitless, and
nothing runs "24 hours non-stop for free" on a cloud free tier. The only
option with no per-request meter is a local model, and its limit is your
own hardware.

## The providers

| Provider | Free offer | Hard limit (as published) | Best for |
|---|---|---|---|
| **OpenRouter `:free` models** | Free models with `:free` suffix | **20 requests/minute, 50/day, 1,000/day after $10 lifetime purchases** | Chat, drafting, light code |
| **Gemini free tier** | Free tier in Google AI Studio | Per-model, per-day quotas that change over time — check the current numbers in AI Studio before relying on them | Vision (screenshots), chat |
| **Groq free tier** | Free tier in the Groq console | Per-model rate limits (requests/minute, tokens/minute, requests/day) published in the Groq docs/console — check the current numbers there before relying on them | Fast chat, fast code |
| **Ollama (local)** | Models run on your own machine | No per-request or per-day meter — the limit is your RAM / GPU / time | Code, chat, vision (local vision models) — private, no key, no meter |

## How the pool works

1. Each task kind has a **chain** (see `config/model-router.example.json`):
   e.g. chat → OpenRouter `:free` → Groq free → Gemini free → Ollama local.
2. The router tries the chain in order. When one provider answers with a
   rate-limit / quota error, the router **stops calling that provider**,
   records the pause, and moves to the next entry.
3. Pending tasks **queue and wait** — nothing is retried in a tight loop,
   nothing is dropped silently, and the router never switches to a paid
   model on its own. A paid entry is used only if you put it in the config
   yourself.
4. The user can see the current provider, the calls used, and the queue in
   `browser_status` / `/status`.

## A realistic day, with numbers

OpenRouter `:free` alone gives you 50 requests a day — a few dozen
browser-driving steps. Add Groq free and Gemini free and the pooled total
is several times that, but each provider still stops at its own cap, and
each cap resets on its own schedule (per minute / per day, per provider).
Plan tasks in that light: heavy work (long builds, big test runs) belongs
on the local Ollama route, where the only cost is your machine's time.

## What this page does NOT promise

- No "free forever, no limits" claim. Every cloud free tier is metered.
- No auto-upgrade to a paid model or paid key.
- No key sharing: each provider's key (where one is needed) is yours,
  stored in your own environment, sent only to that provider.
- Quotas change: providers change free tiers without warning. The numbers
  above are the published figures at the time of writing (November 2026);
  the router reads the *error* a provider returns, not a hard-coded quota,
  so a changed limit is handled the same way — queue, pause, fall back.

## بالعربي باختصار

النماذج المجانية بتتجمع من كذا مزود (OpenRouter وGemini وGroq مجاني،
وOllama محلي) — فالرصيد المجاني المجمّع كبير، لكن كل مزود ليه حدّ أقصى
صارم ومش بلا حدود. لما مزود يخلّص حدّه، الروتر بيوقف استخدامه وينقل
للمزود اللي بعده أو يوقف في طابور لحد ما الحد يتجدد، ومش بيحوّل لمدفوع
لوحده أبدًا.
