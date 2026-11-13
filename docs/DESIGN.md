# DESIGN.md — Atlas Dashboard design (Material 3 Expressive)

The Atlas Dashboard (`dashboard/`, served at `/dashboard`) is styled with
**Google Material 3 Expressive** — the design language of Android 16:
dynamic colour, big round shapes, springy motion, and clear type. The
tokens are implemented **by hand in plain CSS** in
`dashboard/index.html`. There is **no external UI library** and no
framework: no Tailwind, no component kit, no JavaScript UI dependency.
That is deliberate — the dashboard must load from the same small server
with no build step and no CDN.

## Tokens (the source of truth is the `:root` block in `index.html`)

### Colour — seed `#2f6bff`, M3 roles

| Token | Light | Dark (follows OS) | Use |
|---|---|---|---|
| `--md-primary` | `#2f6bff` | `#a8c7fa` | Primary buttons, logo, links |
| `--md-on-primary` | `#ffffff` | `#002f6e` | Text/icons on primary |
| `--md-primary-container` | `#dbe6ff` | `#28427a` | Chips, highlights |
| `--md-on-primary-container` | `#001a4d` | `#dbe6ff` | Text on primary-container |
| `--md-secondary` | `#4d5f7a` | — | Secondary text |
| `--md-secondary-container` | `#dbe6f5` | `#3a475c` | Tonal buttons |
| `--md-tertiary` / container | `#7a4d8f` / `#f2dbf5` | `#4d3358` | Accents |
| `--md-error` / container | `#ba1a1a` / `#ffdad6` | `#5c1512` | LIVE badge, danger |
| `--md-success` / container | `#146c2e` / `#b8f0c2` | `#0d3d1c` | Live dots, Approve |
| `--md-surface` | `#f7f7fc` | `#121318` | Page background |
| `--md-surface-container` | `#eceef4` | `#1e2026` | Cards |
| `--md-surface-container-high` | `#e2e5ec` | `#2a2d34` | Code blocks, tables |
| `--md-on-surface` / variant | `#1a1b20` / `#44474f` | `#e6e7ec` / `#c4c6d0` | Text |
| `--md-outline` | `#c4c6d0` | `#3f434c` | Borders |

**Dynamic colour:** M3 Expressive's dynamic colour derives roles from
the user's wallpaper / system accent. This dashboard implements the
*roles* (primary, container, surface, outline) with fixed values for
both colour schemes, so the look is stable on any machine. A future
version can read the OS accent via `prefers-color-scheme` + CSS
`color-scheme` and re-derive the seed — the roles above stay the same.

### Shape — Expressive: big and round

| Token | Value | Use |
|---|---|---|
| `--md-shape-s` | `12px` | Small elements |
| `--md-shape-m` | `20px` | Logo, code blocks |
| `--md-shape-l` | `28px` | Cards, screenshot frame |
| `--md-shape-full` | `999px` | Chips, buttons (pill) |

Buttons and chips are full pills; cards use the large 28px radius. That
is the Expressive signature: noticeably rounder than classic M3.

### Motion — spring, not linear

| Token | Value | Use |
|---|---|---|
| `--md-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Presses, hovers, card lift — bouncy, physical |
| `--md-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Fades, shadows |
| `--md-duration` | `450ms` | Standard duration |

Buttons scale to `0.94` on press and lift on hover; cards lift `2px`.
`prefers-reduced-motion: reduce` disables all animation.

### Type

System stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans
Arabic", sans-serif`) — no webfont download. Title 22px/28px, body
14px/20px, code/log 12.5px/1.5. The Arabic line in the footer renders in
the same stack.

## PWA

- `dashboard/manifest.json` — name "Atlas — AI Browser Dashboard",
  `display: standalone`, `start_url: /dashboard/`, theme `#2f6bff`,
  icons `icon-192.png` / `icon-512.png` (+ maskable).
- `dashboard/sw.js` — caches **only the app shell** (page, manifest,
  icons). `/status`, `/events`, `/latest.png`, `/api/*`, `/mcp` are
  never cached: live data always comes from the network.
- Install: the browser's "Install" / "Add to Home screen" on
  `/dashboard`.

## Stitch and v0 — what they are, and what we did with them

Two AI design tools shaped this dashboard's *language*, and neither is
installed here:

- **Google Stitch** is a Google Labs web tool for AI-assisted design:
  you describe an interface, it generates Material 3 Expressive
  designs and exports code. It is a **web tool with its own Google
  account** — not a package you install locally. We used its design
  language (Expressive roles, big shapes, spring motion) as the
  reference for the tokens above; we did not install, embed, or claim
  to run Stitch.
- **Vercel v0** is a web interface generator: you prompt it and it
  generates React + Tailwind + shadcn/ui code. It is also a **web tool
  with its own account** — not a local package. We did **not** use v0
  to build this dashboard (it is hand-written HTML/CSS with no
  framework), but its component language (cards, pills, tonal buttons)
  is a familiar reference for the same shapes.

If either tool is ever used to redesign the dashboard, that happens in
the browser on the vendor's site, under the user's own account — the
exported code would then be reviewed and committed like any other
change. Nothing in this repo auto-generates UI from Stitch or v0.
