# Model router — automatic model switching by task

The browser skill itself is model-agnostic: any MCP client (Claude Code,
Cursor, Lovable, Replit Agent, …) can drive it. The **model router** is the
config that decides *which model* that client uses for *which kind of task*,
and what happens when a free limit is hit. It is a config + documentation
feature, not a model: this repo ships no model and no API key.

Config: [`config/model-router.example.json`](../config/model-router.example.json)
(copy it to `config/model-router.json` and edit it — the `.json` is
git-ignored, the `.example.json` is the template).

## Ranking by strength — not by fame

Every model entry in `config/model-router.example.json` carries a
**`rank`**: a strength tier **for that task** — `1` is the strongest
entry in this config for that task, `3` is the weakest fallback. The
rank is judged on **public benchmark results and what the model can
actually do for the task** (code benchmarks for code, multimodal scores
for vision, speed + quality for chat) — **not on how famous the model
or the provider is**. A lesser-known model can outrank a famous one for
a specific task, and the router will pick it.

The router uses the rank together with the chain order: it prefers the
strongest entry that is currently available, and falls back to the next
entry when one fails or hits its limit (see "Queue + pause at the
limit"). Rank never overrides a limit — a rank-1 model that is out of
quota is skipped just like any other, and the router never switches to
a paid model on its own.

If you add a model, rank it honestly for the task it will serve, and
write down which benchmark or capability you based the rank on. A rank
with no basis is just a preference — and preferences do not survive
contact with a real task.

**A note on names:** if you meant a specific tool or model called
"Otter", send its link — no tool by that name is assumed or invented
here. The router works with any provider/model you configure, famous
or not, as long as you give it the real endpoint and the real limits.

## How routing works

| Task kind | Route to (example) | Why |
|---|---|---|
| `code` — write / edit / review code | Local Ollama model, or a strong cloud model | Code needs the strongest model you can afford; local keeps it private |
| `chat` — answer, draft, summarise | OpenRouter `:free` model | Cheap, fast, good enough for text |
| `vision` — describe a screenshot, check a layout | A multimodal model (Gemini free tier, or a local vision model) | Text-only models cannot see the Live View screenshots |
| `phone` — Artemis Android tasks | The model Artemis is configured with (its own key) | Artemis needs a multimodal model; see `docs/ARTEMIS.md` |

The router tries the chain in order and falls back to the next entry when
one fails or hits its limit. It never silently upgrades you to a paid model:
a paid entry is used only if you put it in the config yourself.

**Pooling free providers:** the same chain can pool several free
providers — OpenRouter `:free`, Gemini free tier, Groq free tier, and
local Ollama — so when one hits its cap the next one takes over. The
pooled free credit is large, but it is still capped per provider; see
[`FREE-MODELS.md`](FREE-MODELS.md) for the real numbers and the honest
math. Never write "limitless" about any of them.

## Free limits — the real numbers (read these before planning)

These are the limits as published by the providers. They are **not
unlimited**, and nothing in this project can make them unlimited.

### OpenRouter `:free` models

- **20 requests per minute**
- **50 requests per day**
- **1,000 requests per day after $10 lifetime purchases**

That is the whole free allowance. A `:free` model is for light use: a few
dozen browser-driving steps a day, not 24-hour non-stop work. When the daily
limit is hit, the router must **queue and pause** — not retry in a loop and
not switch to a paid model on its own.

### Gemini free tier

- Free-tier quotas are per-model and per-day and change over time. Check the
  current numbers in Google AI Studio before relying on them; do not assume
  yesterday's quota still applies.

### Groq free tier

- Free-tier rate limits are per-model and published in the Groq docs /
  console. Check the current numbers there before relying on them; do not
  assume yesterday's quota still applies. Groq's free tier is fast, which
  makes it a good second entry in the chain after OpenRouter `:free`.

### Ollama (local)

- No per-request limit and no per-day limit — the limit is your own
  machine (RAM, GPU, and time). A local model is the only genuinely
  "no-meter" option, and it is also the slowest on weak hardware. This is
  the honest answer to "run without stopping": run it locally, accept the
  speed of your hardware.

## Queue + pause at the limit (required behaviour)

1. When a provider returns a rate-limit / quota error, the router **stops
   calling that provider** and records the pause in the Live View.
2. Pending tasks wait in a queue. Nothing is dropped silently and nothing
   is retried in a tight loop.
3. The router falls back to the next entry in the chain (e.g. Ollama local)
   if one is configured; otherwise it waits and tells the user when the
   limit resets.
4. The user can always see the current provider, the calls used, and the
   queue in `browser_status` / `/status` — no hidden spend, no hidden
   switching.

## What the router will never do

- Claim that free use is limitless and runs round the clock. There is no
  such thing on OpenRouter `:free` (50/day) or on any cloud free tier.
- Auto-upgrade to a paid model or paid key.
- Send your API keys anywhere except the provider you configured.
- Pick a model for a task it cannot do (e.g. a text-only model for a
  screenshot check).
