# OpenCode Surface — synthesis & index

> Catalog index for the three primary OpenCode research artifacts.
> Captured 2026-06-17. Source: `sst/opencode` @ `dev` branch.

This is the synthesis sibling of `claude-code-surface.md`. It indexes three deep-dive documents and extracts the architectural conclusions needed for the mapping work in `mapping.md`.

| Document | Lines | What it covers |
|---|---|---|
| [`opencode-routes.md`](opencode-routes.md) | ~370 | v2 `/api/*` route catalog: 46 endpoints, auth, CORS, error envelope, group-by-group reference. |
| [`opencode-sdk-types.md`](opencode-sdk-types.md) | ~2000 | Complete `@opencode-ai/sdk/v2` type catalog: 1,211 exported types, 84 Event variants, 32 SyncEvent variants, both v1 (~85 routes) and v2 (~40 routes) `*Data/*Errors/*Response` triplets. |
| [`opencode-tui-mapping.md`](opencode-tui-mapping.md) | ~890 | TUI ↔ Server contract: startup sequence, store shape, per-route → store-field map, SSE event handlers, prompt round-trip flow, crash sites, MVP backend checklist. |

---

## 1. The single most important fact

**OpenCode's TUI uses TWO API surfaces simultaneously:**

| Surface | Prefix | Used by | Envelope |
|---|---|---|---|
| **v1 legacy** | bare paths (`/config`, `/agent`, `/session`, `/path`, `/global/event`, ...) | `sync.tsx` main store — every blocking call in bootstrap | bare object (no `{location, data}` wrap) |
| **v2** | `/api/*` (`/api/agent`, `/api/session`, `/api/permission/saved`, ...) | `data.tsx` parallel store layer — supplementary | `{location, data}` envelope |

**The blocking bootstrap is v1.** If our adapter only implements `/api/*`, the TUI shell never finishes loading. This is what caused our Phase 7.2 "stub everything at `/api/X`" to crash even with correct shapes — the TUI's main store was calling `/config/providers` (bare), not `/api/config/providers`.

The startup sequence is in `opencode-tui-mapping.md` §1; the list of v1 routes (with their full `*Data/*Response` triplets) is in `opencode-sdk-types.md` §20.

---

## 2. The blocking bootstrap surface (must-have for TUI render)

8 v1 endpoints that block the TUI shell from rendering:

| v1 route | Response shape | Store field set |
|---|---|---|
| `GET /config/providers` | `{ providers: Provider[], default: Record<string,string> }` | `provider`, `provider_default` |
| `GET /provider` | `{ all: Provider[], default: Record<string,string>, connected: string[] }` | `provider_next` |
| `GET /experimental/console` | `{ consoleManagedProviders: string[], switchableOrgCount: number }` | `console_state` (with `.catch()` fallback) |
| `GET /agent` | `Agent[]` (bare array) | `agent` |
| `GET /config` | `Config` (~80 keys, see SDK §17) | `config` |
| `GET /path` | `{ home, state, config, worktree, directory }` | `instance.path` |
| `GET /project/current` | `Project` | `project.id`, `project.worktree` |
| `GET /project/{projectID}/directories` | `Array<{ directory, strategy? }>` | `project.mainDir` |

Failure modes documented in `opencode-tui-mapping.md` §5.1–§5.10. Most famous: omitting `default` from `/config/providers` causes `provider_default[q.id]` TypeError.

---

## 3. The non-blocking bootstrap surface (must-have for full features)

These fire after the blocking gate; `status` flips to `complete` when all return.

`GET /session?start=...`, `/command`, `/lsp`, `/mcp`, `/experimental/resource`, `/formatter`, `/session/status`, `/provider/auth`, `/vcs`, `/experimental/workspace`, `/experimental/workspace/status`.

If we don't implement these, the TUI works but features (LSP errors, MCP servers, multi-workspace) silently no-op. Acceptable for MVP.

---

## 4. Session lifecycle (the round-trip we need to drive prompts)

**Create:**
```
POST /session
body: { directory?, workspace?, agent, model: { providerID, id, variant? } }
→ { id, slug, version, time, ... }
```

**Send prompt (normal):**
```
POST /session/{sessionID}/message
body: { sessionID, model, agent, variant, parts: [TextPartInput, FilePartInput, AgentPartInput, ...] }
→ 200 OK (response body unused; conversation drives over SSE)
```

**Receive response via SSE on `GET /global/event`:**
Wrapper: `{ payload: Event, directory, workspace }` (workspace optional).

Streamed events in order:
1. `session.updated` (server stamps `time.updated`)
2. `message.updated` (legacy) OR `session.next.prompted` (v2-flavoured)
3. `session.status` (`{ status: { type: "working", ... } }`)
4. `session.next.step.started` (creates assistant message with `content: []`)
5. **Interleaved while streaming:**
   - `session.next.text.started` → `text.delta` (many) → `text.ended`
   - `session.next.reasoning.{started,delta,ended}` (optional)
   - `session.next.tool.input.{started,delta,ended}` → `tool.called` → `tool.progress*` → `tool.success|failed`
6. `session.next.step.ended` (final `{ finish, cost, tokens, snapshot }`)
7. `session.status` (`{ status: { type: "idle", ... } }`)

**Both v1 (`message.part.delta` / `message.part.updated`) and v2 (`session.next.text.delta`, `session.next.tool.*`) event families** are subscribed simultaneously. An MVP backend can implement either family alone and the TUI will render. Full reference: `opencode-sdk-types.md` §19, `opencode-tui-mapping.md` §4.

---

## 5. Permission / question round-trip

When a tool needs permission, server emits `permission.asked` with `PermissionRequest` as `properties`. TUI inserts into `store.permission[sessionID]`. User answers:
- Legacy: `POST /session/{sessionID}/permissions/{permissionID}` body `{ response: "once" | "always" | "reject" }`
- v2: `POST /api/session/{sessionID}/permission/{requestID}/reply` body `{ reply: PermissionV2Reply, message? }`

Server emits `permission.replied { sessionID, requestID }`. TUI splices out.

Same pattern for `question.asked` / `question.replied` / `question.rejected`.

---

## 6. Authentication

HTTP Basic. `Authorization: Basic <base64(user:pass)>` header. Username defaults `opencode`. Reads `OPENCODE_SERVER_PASSWORD` and `OPENCODE_SERVER_USERNAME` env, OR password injected via `createRoutes(password)`.

PTY WebSocket connects use `?ticket=` query (browsers can't set headers on WS upgrade). Server validates ticket itself.

Location info also comes via headers: `x-opencode-directory` (URL-encoded), `x-opencode-workspace`. v2 client rewrites these to `?location[directory]=...&location[workspace]=...` for GET/HEAD requests.

---

## 7. Critical invariants

From `opencode-tui-mapping.md` §5 — fields whose mis-shape will silently corrupt the TUI:

| # | Invariant | Failure mode |
|---|---|---|
| 1 | `/config/providers` must include `default: Record<string,string>` | `provider_default[q.id]` undefined → TypeError, TUI crashes at provider component |
| 2 | `/provider` must include all three of `all, default, connected` | `provider_next` missing field, downstream `.map/.find` crash |
| 3 | Session/message/permission/question IDs must be lex-sortable ULID-style | TUI uses binary-search; non-sortable IDs → silent insert at wrong index → duplicate rows |
| 4 | Every `Session` must have a `time` object (subfields can be null) | `session.time.updated`, `session.time.compacting` accessed unconditionally |
| 5 | Messages must have `role: "user"|"assistant"|...` and `time` | `status()` reads `last.role` and `last.time.completed` |
| 6 | Part `field` named in delta must be string-valued | `(part[field] as string) = (existing ?? "") + delta` silently corrupts if field is non-string |
| 7 | `GET /session/{id}/message` returns `Array<{ info: Message, parts: Part[] }>` (NOT flat) | TUI does `messages.data.flatMap(m => m.info)` and `m.parts.flatMap(...)` |
| 8 | `provider_auth` keys must be string-indexable; send `{}` not `null` for empty | Auth dialog crash |
| 9 | `path.worktree`, `path.directory` must be strings (empty `""` OK) | `path.relative()` throws on non-string |
| 10 | SSE `payload.type` must be a string | `event.ts` strict-equals `"sync"`; undefined silently drops |

---

## 8. Strategic conclusion for the adapter

Combining this with `claude-code-surface.md` §10 (universality via Agent SDK `Query.supportedX()` methods):

```
                  Claude Code (closed-source binary, owns model/agent/skill/command registry)
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │  @anthropic-ai/claude-agent-sdk              │
           │  Query.supportedModels() / Commands() /      │
           │    Agents() / initializationResult()         │
           │  query({ prompt, options }) → SDKMessage*    │
           └──────────────────────────────────────────────┘
                                  │
                                  ▼
                       OUR ADAPTER (this project)
                       ┌──────────────────────────┐
                       │ v1 surface (sync.tsx)    │  ← BLOCKING; must work
                       │  /config, /agent,        │
                       │  /provider, /session,    │
                       │  /global/event SSE, ...  │
                       ├──────────────────────────┤
                       │ v2 surface (data.tsx)    │  ← supplementary
                       │  /api/* envelope         │
                       └──────────────────────────┘
                                  │
                                  ▼
              OpenCode TUI (think it's talking to opencode itself)
```

**Adapter responsibilities:**
1. Translate TUI's HTTP/SSE expectations (v1 + v2) into Agent SDK calls
2. Pull `supportedModels/Commands/Agents` from SDK at startup, expose via `/config/providers`, `/provider`, `/agent`, `/command`, `/skill`, etc.
3. Pump `SDKMessage` stream from `query()` into SSE `message.part.updated/delta` and/or `session.next.text.*` events
4. Map opencode's `permission.asked` / `question.asked` to Claude's `canUseTool` callback and elicitation handlers
5. Persist sessions to `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` (via SDK's built-in storage)

**No hardcoding** for anything the SDK can answer. Every list (models, commands, agents, skills) is queried at request time.

---

## 9. Mapping spec — what `mapping.md` will contain

(Next deliverable.)

For each TUI-side endpoint and event:
- Path / method / shape (from `opencode-routes.md` or `opencode-sdk-types.md`)
- Source of truth in Claude Code (CLI flag, SDK option, SDK message, settings key — from `claude-code-surface.md`)
- Translation rule (transform function, default value, fallback)
- Universality check: does it auto-update if Claude Code adds a new model/command/agent?

---

## 10. Open questions for discussion (raised during catalog work)

These are the ones a future implementer will likely revisit:

1. **`/api/* (v2) surface coverage strategy:** since v1 is enough for the TUI shell to render and send a prompt, do we ship v1 only in MVP and leave v2 as a v0.7.x followup, OR ship both to maximize the chance other opencode clients (CLI, integrations) also work?

2. **Authentication:** opencode's `OPENCODE_SERVER_PASSWORD` env vs our `~/.local/state/opencode/password` file (Phase 6 ADR 0009). Probably keep both; document precedence.

3. **Model alias resolution:** TUI sends `model: { providerID: "anthropic", id: "claude-fable-5", variant? }`. We pass `id` to SDK `--model`. SDK accepts both alias (`fable`) and full (`claude-fable-5`). Do we accept both forms or coerce?

4. **Tool/skill/command pass-through:** TUI's `parts: [TextPartInput, FilePartInput, AgentPartInput, SubtaskPartInput]` vs Claude SDK's `MessageParam`. Direct map for text; file → upload + reference; subtask → SDK subagent; agent → SDK agent option.

5. **Permission protocol bridge:** Claude SDK has `canUseTool` callback (sync) + permission hook stream. OpenCode TUI expects `permission.asked` event + `POST .../permission/{id}/reply`. Bridge via in-process promise wait.

6. **Event family choice:** emit legacy (`message.part.updated/delta`) or v2-flavoured (`session.next.text.*`, `session.next.tool.*`)? Latter is richer but more event types. Recommend v2 for richer rendering, fallback to legacy for compat.

7. **Session storage location:** Claude SDK writes to `~/.claude/projects/<encoded-cwd>/<id>.jsonl`. OpenCode stores in its own SQLite (`SessionTable`). We point to Claude's location; expose minimal shape to TUI.

8. **PTY surface:** out of scope for MVP. PTY is opencode-native terminal feature, not driven by Claude Code. Stub returning empty list.

These ride into `mapping.md`.
