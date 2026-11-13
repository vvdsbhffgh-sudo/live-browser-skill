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

## Alpha 2 (2026-11-13): the 50-model pool, with current numbers

The pool now has **50 unique free models**. The numbers below were
checked against the providers' public pages on 2026-11-13. Free tiers
change — the provider's console is always the authority, not this page.

| Provider | Free offer (Nov 2026) | Hard limit (as published) |
|---|---|---|
| **OpenRouter `:free`** | ~16 `:free` model IDs + `openrouter/free` router | **20 req/min, 50/day, 1,000/day after $10 lifetime purchases** |
| **Groq free** | gpt-oss-120b/20b, qwen3.8-27b (preview), Whisper, Orpheus TTS, guard models | Main chat models: **30 req/min, 1,000/day, 8,000 tok/min, 200,000 tok/day**. Whisper: 20 req/min, 2,000/day. Orpheus: 10 req/min, 100/day. Limits apply per organization, not per key. (Llama 3.1/3.3 were removed from Groq free in Aug 2026.) |
| **Gemini free tier** | gemini-2.5-flash, gemini-2.0-flash, gemma-3, gemma-4 (via OpenRouter too) | Per-model quotas in Google AI Studio — check current numbers there |
| **SambaNova free** | Llama-3.3-70B, DeepSeek-R1-Distill-Llama-70B, Qwen3-32B, Llama-3.1-8B | Free tier, no card — verify the current roster and caps in the SambaNova console |
| **Ollama (local)** | qwen2.5-coder, llama3.1, mistral, deepseek-r1, llava, gemma3, phi4, … | No meter — the limit is your RAM / GPU / time |

Why 50+ helps even though every cap is real: a limit is **per model
and per provider**. When OpenRouter's 50/day is spent, Groq's 1,000/day
is untouched; when one model hits 429, the router moves to the next
entry in rank order. The pool does not remove any cap — it spreads the
work across many of them, so the work keeps going instead of stopping.
Calling the pool "without limits" is a figure of speech: the pool is
large, the caps are real. Local Ollama is the only option with no per-request meter.
