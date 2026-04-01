# Copilot Instructions for OpenCode

## Build, Test, and Lint

All commands run from `packages/opencode`, never from the repo root.

```bash
cd packages/opencode

# Type checking
bun typecheck            # Never use tsc directly

# Build (produces multi-platform binaries in dist/)
bun run build

# Run all tests
bun test

# Run a single test file
bun test test/util/glob.test.ts

# Run tests matching a pattern
bun test --filter "glob"

# Regenerate the JavaScript SDK
./packages/sdk/js/script/build.ts
```

## Architecture

OpenCode is a terminal-based AI coding assistant. The core is a monorepo with `packages/opencode` as the main package.

### Effect.js Service Layer

All backend services use [Effect.js](https://effect.website) for typed dependency injection and error handling. This is the most important pattern to understand:

```ts
// Define a service with ServiceMap
export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Thing") {}

// Build the layer (constructor)
export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service     // inject dependency
    const cfg = yield* Config.Service  // inject dependency
    return Service.of({ list, get })
  }),
)

// Consume from outside Effect context
const runtime = makeRuntime(Service, layer)
runtime.runPromise((svc) => svc.list())
```

`yield*` chains effectful operations. Services compose via `Layer.provide()`. Runtime bridging (`makeRuntime`) is used at boundaries (TUI, CLI commands).

### Plugin System

Plugins are npm packages or local `file://` paths registered in `~/.config/opencode/opencode.json`. They export a function receiving `PluginInput` and returning `Hooks`:

- `experimental.chat.system.transform` — modify system prompt
- `experimental.chat.input.transform` — modify user input
- `experimental.chat.output.transform` — modify assistant output
- Lifecycle hooks for session, message, tool events (14+ hooks total)

Plugin loading: plan → resolve (npm install if needed) → load (dynamic import) → apply hooks.

### Tool Definition

Tools use Zod schemas for parameter validation and are self-describing:

```ts
export const MyTool = Tool.define("my_tool", () => ({
  description: "Does something",
  parameters: z.object({ path: z.string() }),
  async execute(args, ctx) {
    return { title: "Result", metadata: {}, output: "done" }
  },
}))
```

Tools are registered in `src/tool/registry.ts`. Custom tools discovered from `{tool,tools}/*.{js,ts}` directories.

### TUI

The terminal UI uses **OpenTUI + Solid.js** (not Ink). Components use Solid's `createSignal`, `createEffect`, `Show`, `For`, etc. with OpenTUI's terminal renderer. Key context providers chain in `app.tsx`.

### LLM Providers

Provider abstraction in `src/provider/` supports 24+ backends (OpenAI, Anthropic, Azure, Bedrock, Vertex, etc.). Each provider can have a custom loader for auth, model discovery, and SDK configuration. Model metadata is fetched from `models.dev` at build time.

### Storage

SQLite via Drizzle ORM. Single database at `~/.local/share/opencode/opencode.db`. Migrations are embedded at build time. Use `PRAGMA journal_mode = WAL` for concurrent reads.

## Style Guide

### Naming (Mandatory)

Single-word names by default. Multi-word only when a single word would be ambiguous.

```ts
// Good
const cfg = load()
const pid = process.id

// Bad
const configData = load()
const processId = process.id
```

Inline values used only once:

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const p = path.join(dir, "journal.json")
const journal = await Bun.file(p).json()
```

### Control Flow

- `const` over `let` — use ternaries or early returns
- No `else` — use early returns
- No `try`/`catch` where avoidable
- No `any` type
- Dot notation over destructuring (`obj.a` not `const { a } = obj`)
- Functional array methods (`flatMap`, `filter`, `map`) over `for` loops

### Drizzle Schemas

snake_case field names so column names don't need string overrides:

```ts
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})
```

## Testing

- Run from `packages/opencode`, never repo root (`do-not-run-tests-from-root` guard)
- Avoid mocks — test real implementations
- Use `bun:test` with `describe`/`test`/`expect`
- Use `tmpdir()` fixture for filesystem tests (auto-cleanup via `await using`)
- For Effect services, use `Effect.runPromise()` with test layers

## Key Conventions

- Default branch is `dev` (not `main`)
- Use `dev` or `origin/dev` for diffs — local `main` may not exist
- Use Bun APIs (`Bun.file()`, `Bun.build()`, etc.) over Node equivalents
- Rely on type inference — avoid explicit annotations unless needed for exports
- Prefer automation over confirmation prompts
