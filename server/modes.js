// Modes library for Atlas.
//
// A mode is a named operating profile: which model route it prefers, which
// tools it may use, and its limits. Modes live as JSON files in
// config/modes/ (coding, content, research, testing, chat) so the user can
// edit them without touching code. This module loads them, falls back to
// built-in defaults when the files are missing, and answers the two
// questions the server asks: "is this tool allowed in this mode?" and
// "what is the step budget in this mode?"
//
// A mode NEVER grants anything the guards forbid: the payment guard, the
// HTTPS-only rule, the sensitive-action block, and the domain lists apply
// in every mode. A mode can only narrow what the agent may do, never widen
// it past a guard.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const MODE_NAMES = ["coding", "content", "research", "testing", "chat"];
export const DEFAULT_MODE = "coding";

// Extra modes shipped in config/modes/ (language-focused coding modes and
// long-form writing). loadModes() discovers every *.json in that folder,
// so adding a mode is adding a file — the list below is only the fallback
// set with built-in defaults.
export const EXTRA_MODE_NAMES = [
  "coding-python",
  "coding-web",
  "coding-api",
  "coding-scripts",
  "content-writing",
];

// Built-in defaults (used when config/modes/<name>.json is missing or
// invalid, so the server always has a sane mode to run in).
export const BUILTIN_MODES = {
  coding: {
    name: "coding",
    description: "Build and edit apps in the browser: full tool access, code model route.",
    modelRoute: "code",
    readonly: false,
    maxSteps: 100,
    allowedTools: [
      "browser_start", "browser_navigate", "browser_snapshot", "browser_click",
      "browser_type", "browser_press", "browser_screenshot",
      "browser_full_screenshot", "browser_extract_text", "browser_tabs",
      "browser_set_viewport", "browser_sitemap", "browser_status",
      "browser_google_signin", "browser_stop",
    ],
  },
  content: {
    name: "content",
    description: "Draft and publish content: browse and type, but no destructive actions and no viewport fiddling.",
    modelRoute: "chat",
    readonly: false,
    maxSteps: 60,
    allowedTools: [
      "browser_start", "browser_navigate", "browser_snapshot", "browser_click",
      "browser_type", "browser_press", "browser_screenshot",
      "browser_full_screenshot", "browser_extract_text", "browser_tabs",
      "browser_sitemap", "browser_status", "browser_google_signin",
      "browser_stop",
    ],
  },
  research: {
    name: "research",
    description: "Read and compare pages: navigation and extraction only, no typing into forms.",
    modelRoute: "chat",
    readonly: false,
    maxSteps: 80,
    allowedTools: [
      "browser_start", "browser_navigate", "browser_snapshot", "browser_click",
      "browser_press", "browser_screenshot", "browser_full_screenshot",
      "browser_extract_text", "browser_tabs", "browser_sitemap",
      "browser_status", "browser_stop",
    ],
  },
  testing: {
    name: "testing",
    description: "Drive the site and check it visually: full tools plus viewport presets, vision model route.",
    modelRoute: "vision",
    readonly: false,
    maxSteps: 150,
    allowedTools: [
      "browser_start", "browser_navigate", "browser_snapshot", "browser_click",
      "browser_type", "browser_press", "browser_screenshot",
      "browser_full_screenshot", "browser_extract_text", "browser_tabs",
      "browser_set_viewport", "browser_sitemap", "browser_status",
      "browser_google_signin", "browser_stop",
    ],
  },
  chat: {
    name: "chat",
    description: "Light Q&A browsing: look things up and read pages, no clicking into forms or typing.",
    modelRoute: "chat",
    readonly: false,
    maxSteps: 40,
    allowedTools: [
      "browser_start", "browser_navigate", "browser_snapshot",
      "browser_screenshot", "browser_full_screenshot", "browser_extract_text",
      "browser_tabs", "browser_sitemap", "browser_status", "browser_stop",
    ],
  },
};

// Tools that are always allowed in every mode (read-only, control, or the
// mode switch itself). A mode's allowedTools list only gates the mutating
// browser tools.
export const ALWAYS_ALLOWED_TOOLS = new Set([
  "browser_status",
  "browser_screenshot",
  "browser_snapshot",
  "browser_sitemap",
  "browser_pause",
  "browser_resume",
  "browser_mode",
  "phone_status",
]);

function normaliseMode(raw, fallbackName) {
  const base = BUILTIN_MODES[fallbackName] ?? BUILTIN_MODES[DEFAULT_MODE];
  if (!raw || typeof raw !== "object") return { ...base };
  const mode = {
    name: typeof raw.name === "string" ? raw.name : fallbackName,
    description: typeof raw.description === "string" ? raw.description : base.description,
    modelRoute: typeof raw.modelRoute === "string" ? raw.modelRoute : base.modelRoute,
    readonly: raw.readonly === true,
    maxSteps:
      Number.isInteger(raw.maxSteps) && raw.maxSteps > 0 ? raw.maxSteps : base.maxSteps,
    allowedTools: Array.isArray(raw.allowedTools) && raw.allowedTools.length > 0
      ? raw.allowedTools.filter((t) => typeof t === "string")
      : [...base.allowedTools],
  };
  // Optional: the language(s) this mode is for, e.g. "python" or
  // "javascript, typescript, html-css" (see config/modes/coding-*.json).
  if (typeof raw.language === "string" && raw.language.trim()) {
    mode.language = raw.language.trim();
  }
  return mode;
}

/** Generic fallback for a mode file with no built-in default (e.g. a
 * user-added mode): full coding tools, code route, 100 steps. */
function genericDefault(name) {
  return { ...BUILTIN_MODES[DEFAULT_MODE], name, description: `Mode ${name} (no built-in default; using coding defaults).` };
}

/**
 * Load modes from config/modes/*.json (root = repo root). Every *.json
 * file in that folder becomes a mode, named after its file. Missing /
 * invalid files fall back to the built-in defaults for the five core
 * modes, or to the generic coding default for extra modes. Never throws.
 */
export function loadModes(root) {
  const modes = new Map();
  const dir = path.join(root, "config", "modes");
  let files = [];
  try {
    if (existsSync(dir)) {
      files = readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort();
    }
  } catch {
    files = [];
  }
  const names = [...new Set([...MODE_NAMES, ...EXTRA_MODE_NAMES, ...files])];
  for (const name of names) {
    let raw = null;
    try {
      const file = path.join(dir, `${name}.json`);
      if (existsSync(file)) raw = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      raw = null; // invalid JSON -> default for that mode
    }
    if (raw) {
      modes.set(name, normaliseMode(raw, name));
    } else if (BUILTIN_MODES[name]) {
      modes.set(name, { ...BUILTIN_MODES[name] });
    } else {
      modes.set(name, genericDefault(name));
    }
  }
  return modes;
}

/** List mode files found on disk (for diagnostics). */
export function listModeFiles(root) {
  try {
    const dir = path.join(root, "config", "modes");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/** True when the tool may run in this mode. */
export function isToolAllowedInMode(mode, tool) {
  if (ALWAYS_ALLOWED_TOOLS.has(tool)) return true;
  if (!mode) return true;
  return mode.allowedTools.includes(tool);
}

/** Step budget for a mode (falls back to the env default when absent). */
export function modeMaxSteps(mode, envDefault = 100) {
  if (!mode) return envDefault;
  return Number.isInteger(mode.maxSteps) && mode.maxSteps > 0 ? mode.maxSteps : envDefault;
}
