#!/usr/bin/env node
// atlas — the Atlas command-line entry point.
//
// Installed with the package (`bin` in package.json). After `npm link`
// (run inside the repo) the `atlas` command is on your PATH:
//
//   atlas              start the MCP server on stdio (Claude Code / Cursor)
//   atlas --http       start the HTTP server + Live View (default port 3100)
//   atlas --http --port 4000
//   atlas --version    print the version and exit
//   atlas --help       print this help and exit
//
// This file only parses arguments and hands over to server/index.js, which
// holds all the real behaviour (and the payment guard). It never pays, never
// stores a password, and never bypasses a human check — see SECURITY.md.

import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "server", "index.js");

export function version() {
  return JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
}

export function helpText() {
  return [
    `atlas ${version()} — free, open-source MCP server + Live View for a real browser.`,
    "",
    "Usage:",
    "  atlas [--http] [--port <n>] [--version] [--help]",
    "",
    "  (no flags)   MCP server on stdio — for Claude Code, Cursor, local agents.",
    "  --http       HTTP server + Live View on http://localhost:<port>/ (default 3100).",
    "  --port <n>   HTTP port (only with --http).",
    "  --version    Print the version and exit.",
    "  --help       Print this help and exit.",
    "",
    "Connect it to your AI tool: see docs/INSTALL.md and docs/CONNECTIONS.md.",
    "The browser never pays. Sign in to Google manually, once, in a headed",
    "window, with a dedicated account — never paste a password anywhere.",
  ].join("\n");
}

export function parseArgs(argv) {
  const out = { http: false, port: null, version: false, help: false, extra: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--http") out.http = true;
    else if (a === "--version" || a === "-v") out.version = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--port") out.port = argv[++i] ?? null;
    else if (a.startsWith("--port=")) out.port = a.slice("--port=".length);
    else out.extra.push(a);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }
  if (args.version) {
    console.log(version());
    return;
  }
  if (args.extra.length > 0) {
    console.error(`atlas: unknown argument(s): ${args.extra.join(" ")}`);
    console.error("Run `atlas --help` for usage.");
    process.exitCode = 2;
    return;
  }
  if (args.port !== null && !/^\d+$/.test(String(args.port))) {
    console.error(`atlas: --port must be a number, got "${args.port}"`);
    process.exitCode = 2;
    return;
  }
  const serverArgs = [];
  if (args.http) serverArgs.push("--http");
  const env = { ...process.env };
  if (args.port !== null) env.LIVE_BROWSER_PORT = String(args.port);
  const child = spawn(process.execPath, [SERVER, ...serverArgs], { stdio: "inherit", env });
  child.on("error", (err) => {
    console.error(`atlas: failed to start the server: ${err.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

// Compare real paths: when run via the `atlas` symlink, argv[1] is the
// symlink path while import.meta.url is the resolved file — realpathSync
// makes both sides agree.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
