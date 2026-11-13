# Code tools — a registry, not "every language in the world"

Atlas does **not** literally "contain every language in the world". No
tool does. What Atlas has is an **organised, extensible registry** of
languages in [`config/code-tools/`](../config/code-tools/): one JSON file
per language, each saying how that language runs, how it is tested, how
it is formatted and linted, and which model route writes it best.

List everything with: `npm run list-tools` (runs
`scripts/list-tools.js`).

## How it works

1. **The model writes the code** — in whichever language the task
   needs, using that language's file from the registry as its
   instructions (runtime, run command, test command, formatter, linter).
2. **The runtime runs it** — `node`, `python3`, `go run`, `cargo run`,
   `dotnet run`, `php`, … on your machine, where the runtime is
   actually installed.
3. **The tests verify it** — `node --test`, `pytest`, `go test`,
   `cargo test`, `dotnet test`, … The model does not get to say "it
   works" — the test run says so, and the output is shown to you.
4. **Format + lint** keep the code clean (`prettier`, `black`, `gofmt`,
   `cargo fmt`, …).

If a language is missing, the model says so plainly instead of
pretending — and you add it.

## Languages in the registry

| Language | Runtime | Run | Test | Format / Lint |
|---|---|---|---|---|
| Python | Python 3.12+ | `python3 main.py` | `pytest` | black / ruff |
| JavaScript | Node.js 20+ | `node main.js` | `node --test` | prettier / eslint |
| TypeScript | TS 5.x on Node 20+ | `npx tsx main.ts` | `vitest` | prettier / eslint + tsc |
| Go | Go 1.21+ | `go run .` | `go test ./...` | gofmt / go vet |
| Rust | Rust stable (rustup) | `cargo run` | `cargo test` | rustfmt / clippy |
| Java | JDK 17+ | `mvn exec:java` | `mvn test` | google-java-format / Checkstyle |
| C# | .NET SDK 8+ | `dotnet run` | `dotnet test` | dotnet format |
| PHP | PHP 8.2+ | `php script.php` | `phpunit` | PHP-CS-Fixer / PHPStan |
| SQL | SQLite 3 / PostgreSQL 15+ | `sqlite3` / `psql` | run against a test DB | sqlfluff |
| HTML/CSS | Browser (Atlas/Chromium) | open in Atlas | screenshot + html-validate | prettier / html-validate + stylelint |
| Bash | Bash 5+ | `bash script.sh` | `bash -n` + shellcheck | shfmt / shellcheck |

Each language's full details live in its file, e.g.
`config/code-tools/python.json`.

## Adding a new language — one JSON file

Copy any existing file in `config/code-tools/` to `<language>.json` and
fill in the same fields:

```json
{
  "language": "kotlin",
  "extensions": [".kt"],
  "runtime": { "name": "Kotlin 2.x (JDK 17+)", "install": "…how to install…" },
  "run": { "command": "…" },
  "test": { "command": "…" },
  "formatter": { "name": "…", "command": "…", "install": "…" },
  "linter": { "name": "…", "command": "…", "install": "…" },
  "preferredModel": { "route": "code", "model": "…" },
  "notes": "…anything the model must know…"
}
```

Then run `npm run list-tools` to see it listed, and `npm test` — the
test suite checks that every registry file is valid JSON with all
required fields. No code change is needed: the registry is data, and
the model reads it.

## What the registry does NOT do

- It does not install runtimes for you. Install the runtime the task
  needs (the `install` field tells you how); Atlas will not silently
  download toolchains.
- It does not run untrusted code. Generated code runs on your machine,
  under your account — read a generated script before running it when
  it deletes, overwrites, or installs things (see `SECURITY.md`).
- It does not promise a language works if its runtime is not installed.
  If `python3` is missing, Python tasks fail loudly with "not
  installed" — that is the correct answer, not a silent fallback.
