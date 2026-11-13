# Plugins — install GitHub tools on demand, never all at once

The skill stays small on purpose. Extra capabilities arrive as **plugins**:
small, single-purpose tools from GitHub that are installed only when a task
actually needs them, and only after a license check.

Registry template: [`plugins/registry.example.json`](../plugins/registry.example.json)
(copy it to `plugins/registry.json` and edit it — git-ignored).

## How a plugin is added

1. **Name the task first.** "I need PDF text extraction" — not "install
   every trending repo".
2. **Pick one repo** that does that one task, and read its README + LICENSE.
3. **License check (mandatory, before installing):** the plugin must be
   under a permissive open-source license (MIT, Apache 2.0, BSD, ISC).
   No license = no install. Copyleft (GPL/AGPL) = install only if you
   accept the copyleft terms for your whole project. Proprietary /
   "all rights reserved" = never.
4. **Pin it:** record the exact repo URL + commit SHA (or tag) in
   `plugins/registry.json`. Never install "latest" blindly — a repo can
   change tomorrow.
5. **Install on demand, in the sandbox:** clone to `plugins/<name>/`,
   run its own tests if it has any, and wire only the one tool you need
   into the agent's config.
6. **Remove it when the task is done** if you no longer need it. A plugin
   you do not use is attack surface you do not need.

## What plugins will never do

- **Never auto-install everything.** There is no "install all trending
  repos" command and there never will be. Installing dozens of unknown
  codebases at once is how you inherit a supply-chain attack, a license
  violation, and a broken install in one step.
- **Never merge all trending repos into this repo.** This repo stays a
  browser skill. Trending AI repos are separate projects with their own
  licenses, maintainers, and security histories; copying them in would
  make this repo unmaintainable and un-auditable. Link to them, do not
  absorb them.
- **Never install a plugin that asks for your passwords, tokens, or
  payment details** to work. A plugin that needs a key uses your own env
  var, like everything else here.
- **Never install from a URL you have not read.** If the README is empty,
  the license is missing, or the code runs `curl … | sh`, stop.

## Example entries

See `plugins/registry.example.json`: a PDF-text plugin, a screenshot-diff
plugin, and a markdown-table plugin — each pinned, licensed, and marked
`installed: false` until a task needs it. Adding an entry to the registry
does not install anything; installation is a deliberate, separate step.
