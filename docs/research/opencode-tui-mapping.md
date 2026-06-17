# opencode TUI ⇄ Server contract (branch `dev`)

How `packages/tui/src/context/sync.tsx`, `data.tsx`, `event.ts`, `sdk.tsx`,
`project.tsx`, and the runtime/startup files map SDK responses (and SSE events)
into the SolidJS `createStore` state. Quoted verbatim from
[github.com/sst/opencode @ `dev`](https://github.com/sst/opencode/tree/dev) on
2026-06-17.

Every SDK method below comes from `@opencode-ai/sdk/v2` (file
`packages/sdk/js/src/v2/gen/sdk.gen.ts`). That package's `createOpencodeClient`
also automatically injects the `x-opencode-directory` / `x-opencode-workspace`
headers and rewrites query params (see `packages/sdk/js/src/v2/client.ts`), so
the TUI passes `directory`/`workspace` either explicitly or via headers — a
backend MUST accept both.

---

## 1. Startup sequence

Entry: `bootstrap()` in `sync.tsx` (called from `onMount`). Two stages: a
*blocking* `Promise.all` whose responses populate the store in a `batch(...)`
and a *non-blocking* `Promise.all` that fills the rest, flips `status` from
`partial` → `complete`.

### 1a. Pre-bootstrap, before any SDK call

```ts
const workspace = project.workspace.current()           // may be undefined
const projectPromise   = project.sync()                 // = path.get + project.current (+ project.directories if id)
const sessionListPromise = projectPromise.then(() => listSessions())
```

`project.sync()` itself fires (in `packages/tui/src/context/project.tsx`):

| Call | Route | Store path written |
|---|---|---|
| `sdk.client.path.get({ workspace })` | `GET /path` | `setStore("instance", "path", reconcile(instancePath.data \|\| defaultPath))` |
| `sdk.client.project.current({ workspace })` | `GET /project/current` | `setStore("project", "id", project.data?.id)` ; `setStore("project", "worktree", project.data?.worktree)` |
| `sdk.client.project.directories({ projectID, workspace })` (only if `project.data.id`) | `GET /project/{projectID}/directories` | `setStore("project", "mainDir", directories?.data?.findLast((item) => item.strategy === undefined)?.directory)` |

### 1b. The blocking `await Promise.all([...])` in `sync.tsx` bootstrap

Exact call order (verbatim):

```ts
const providersPromise     = sdk.client.config.providers({ workspace }, { throwOnError: true })
const providerListPromise  = sdk.client.provider.list({ workspace }, { throwOnError: true })
const consoleStatePromise  = sdk.client.experimental.console.get({ workspace }, { throwOnError: true })
                               .then(x => x.data).catch(() => emptyConsoleState)
const agentsPromise        = sdk.client.app.agents({ workspace }, { throwOnError: true })
const configPromise        = sdk.client.config.get({ workspace }, { throwOnError: true })

await Promise.all([
  providersPromise,
  providerListPromise,
  agentsPromise,
  configPromise,
  projectPromise,
  ...(args.continue ? [sessionListPromise] : []),
])
```

(`consoleStatePromise` is awaited at the next `.then` stage, not in the first
gate, because it has `.catch(() => emptyConsoleState)`.)

Then inside the success `.then(...).then(...)` the responses are unwrapped and
applied in a single `batch(...)`:

```ts
batch(() => {
  setStore("provider",         reconcile(providers.providers))
  setStore("provider_default", reconcile(providers.default))
  setStore("provider_next",    reconcile(providerList))
  setStore("console_state",    reconcile(consoleState))
  setStore("agent",            reconcile(agents))
  setStore("config",           reconcile(config))
  if (sessions !== undefined) setStore("session", reconcile(sessions))
})
```

Then `setStore("status", "partial")` (if not already complete).

### 1c. Non-blocking second `Promise.all` (status -> "complete")

```ts
void Promise.all([
  ...(args.continue ? [] : [sessionListPromise.then((sessions) => setStore("session", reconcile(sessions)))]),
  consoleStatePromise.then((consoleState) => setStore("console_state", reconcile(consoleState))),
  sdk.client.command.list({ workspace })             .then((x) => setStore("command", reconcile(x.data ?? []))),
  sdk.client.lsp.status({ workspace })               .then((x) => setStore("lsp", reconcile(x.data ?? []))),
  sdk.client.mcp.status({ workspace })               .then((x) => setStore("mcp", reconcile(x.data ?? {}))),
  sdk.client.experimental.resource.list({ workspace }).then((x) => setStore("mcp_resource", reconcile(x.data ?? {}))),
  sdk.client.formatter.status({ workspace })         .then((x) => setStore("formatter", reconcile(x.data ?? []))),
  sdk.client.session.status({ workspace })           .then((x) => { setStore("session_status", reconcile(x.data ?? {})) }),
  sdk.client.provider.auth({ workspace })            .then((x) => setStore("provider_auth", reconcile(x.data ?? {}))),
  sdk.client.vcs.get({ workspace })                  .then((x) => setStore("vcs", reconcile(x.data))),
  project.workspace.sync(),
]).then(() => {
  setStore("status", "complete")
})
```

`project.workspace.sync()` fires:

- `sdk.client.experimental.workspace.list()` → `setStore("workspace", "list", reconcile(listed.data))`
- `sdk.client.experimental.workspace.status()` → fold into `{ [workspaceID]: status }`, then `setStore("workspace", "status", reconcile(next))`

### 1d. `listSessions()` query shape

```ts
function sessionListQuery() {
  if (!kv.get("session_directory_filter_enabled", true)) return { scope: "project" }
  if (!project.data.instance.path.worktree || !project.data.instance.path.directory) return { scope: "project" }
  return {
    path: path.relative(path.resolve(worktree), directory).replaceAll("\\", "/"),
  }
}
sdk.client.session.list({
  start: Date.now() - 30 * 24 * 60 * 60 * 1000,        // last 30 days
  ...sessionListQuery(),
})
```

Sessions are then `.toSorted((a, b) => a.id.localeCompare(b.id))` before being
written. The TUI relies on this lexicographic-by-id sort and uses binary search
later — **the server SHOULD return ULIDs (or any monotonically sortable id) and
the TUI re-sorts anyway**, but every event handler in §4 calls `search(...)`
which is a binary search by `.id`, so the store must stay sorted on `.id` at
all times.

### 1e. `data.tsx` (the new "v2" data layer) ALSO fires on mount

`data.tsx` is a parallel context that uses the `/api/...` v2 routes. Its
`onMount` fires:

```ts
void Promise.allSettled([
  result.location.refresh(),               // GET /api/location
  result.location.agent.refresh(),         // GET /api/agent
  result.location.integration.refresh(),   // GET /api/integration
  result.location.model.refresh(),         // GET /api/model
  result.location.provider.refresh(),      // GET /api/provider
  result.location.reference.refresh(),     // GET /api/reference   (route exposed under v2.reference)
  result.location.command.refresh(),       // GET /api/command
  result.location.skill.refresh(),         // GET /api/skill
])
```

These are written into a separate store keyed by `JSON.stringify([directory, workspaceID])`.

### 1f. SSE event stream starts (sdk.tsx)

After `onMount`, `sdk.tsx` connects `sdk.global.event(...)` (which is
`GET /global/event`, SSE). This is the firehose for everything in §4. The
stream is restarted with exponential backoff (`retryDelay=1000`,
`maxRetryDelay=30000`) on disconnect.

When `Flag.OPENCODE_EXPERIMENTAL_WORKSPACES` is on, after the stream is
listening: `await sdk.sync.start()` (`POST /sync/start`).

---

## 2. Store shape (verbatim, from `sync.tsx`)

```ts
const [store, setStore] = createStore<{
  status: "loading" | "partial" | "complete"
  provider: Provider[]
  provider_default: Record<string, string>
  provider_next: ProviderListResponse
  console_state: ConsoleState
  provider_auth: Record<string, ProviderAuthMethod[]>
  agent: Agent[]
  command: Command[]
  permission: {
    [sessionID: string]: PermissionRequest[]
  }
  question: {
    [sessionID: string]: QuestionRequest[]
  }
  config: Config
  session: Session[]
  session_status: {
    [sessionID: string]: SessionStatus
  }
  session_diff: {
    [sessionID: string]: SnapshotFileDiff[]
  }
  todo: {
    [sessionID: string]: Todo[]
  }
  message: {
    [sessionID: string]: Message[]
  }
  part: {
    [messageID: string]: Part[]
  }
  lsp: LspStatus[]
  mcp: {
    [key: string]: McpStatus
  }
  mcp_resource: {
    [key: string]: McpResource
  }
  formatter: FormatterStatus[]
  vcs: VcsInfo | undefined
}>({
  provider_next: {
    all: [],
    default: {},
    connected: [],
  },
  console_state: emptyConsoleState,
  provider_auth: {},
  config: {},
  status: "loading",
  agent: [],
  permission: {},
  question: {},
  command: [],
  provider: [],
  provider_default: {},
  session: [],
  session_status: {},
  session_diff: {},
  todo: {},
  message: {},
  part: {},
  lsp: [],
  mcp: {},
  mcp_resource: {},
  formatter: [],
  vcs: undefined,
})
```

Where `emptyConsoleState` is

```ts
const emptyConsoleState: ConsoleState = {
  consoleManagedProviders: [],
  switchableOrgCount: 0,
}
```

`Session[]` is kept sorted by `.id` ascending; every event handler that mutates
it does a `search(...)` binary search by `.id`.

### Data context store (data.tsx)

```ts
const [store, setStore] = createStore<Data>({
  session: {
    info:        {},   // Record<sessionID, SessionV2Info>
    message:     {},   // Record<sessionID, SessionMessage[]>
    permission:  {},   // Record<sessionID, PermissionV2Request[]>
    question:    {},   // Record<sessionID, QuestionV2Request[]>
  },
  project: {
    permission: {},    // Record<projectID, PermissionSavedInfo[]>
  },
  location: {},        // Record<locationKey, LocationData>
})

type LocationData = {
  agent?:       AgentV2Info[]
  command?:     CommandV2Info[]
  integration?: IntegrationInfo[]
  model?:       ModelV2Info[]
  provider?:    ProviderV2Info[]
  reference?:   ReferenceInfo[]
  skill?:       SkillV2Info[]
}

function locationKey(location: LocationRef) {
  return JSON.stringify([location.directory, location.workspaceID])
}
```

### Project context store (project.tsx)

```ts
const [store, setStore] = createStore({
  project: {
    id:        undefined as string | undefined,
    worktree:  undefined as string | undefined,
    mainDir:   undefined as string | undefined,
  },
  instance: {
    path: defaultPath,                            // = Path
  },
  workspace: {
    current:  undefined as string | undefined,
    list:     [] as Workspace[],
    status:   {} as Record<string, "connected" | "connecting" | "disconnected" | "error">,
  },
})

const defaultPath = {
  home: "",
  state: "",
  config: "",
  worktree: "",
  directory: sdk.directory ?? "",
} satisfies Path
```

---

## 3. Per-route response → store-field map

The v2 SDK class layout maps as:

- `sdk.client.config.*` → `class Config2` (URLs under `/config`)
- `sdk.client.app.*` → `class App` (`/log`, `/agent`, `/skill`)
- `sdk.client.session.*` → `class Session2` (URLs under `/session`)
- `sdk.client.command.list` → `class Command` (`/command`)
- `sdk.client.provider.*` → `class Provider` (`/provider`)
- `sdk.client.lsp.status` → `class Lsp` (`/lsp`)
- `sdk.client.mcp.status` → `class Mcp` (`/mcp`)
- `sdk.client.formatter.status` → `class Formatter` (`/formatter`)
- `sdk.client.path.get` → `class Path` (`/path`)
- `sdk.client.vcs.get` → `class Vcs` (`/vcs`)
- `sdk.client.project.*` → `class Project` (`/project`, `/project/current`, `/project/{projectID}/directories`)
- `sdk.client.experimental.console.*` → `class Console` (`/experimental/console`)
- `sdk.client.experimental.workspace.*` → `class Workspace` (`/experimental/workspace`, `/experimental/workspace/status`)
- `sdk.client.experimental.resource.list` → `class Resource` (`/experimental/resource`)
- `sdk.client.sync.start` → `class Sync` (`/sync/start`)
- `sdk.client.global.event` → `class Global` (SSE `GET /global/event`)
- `sdk.client.v2.*` → routes prefixed `/api/...` (see below)

### Startup (sync.tsx bootstrap) calls

| SDK call | HTTP route | Store target |
|---|---|---|
| `sdk.client.config.providers({ workspace })` | `GET /config/providers` | `setStore("provider", reconcile(providers.providers))` ; `setStore("provider_default", reconcile(providers.default))` |
| `sdk.client.provider.list({ workspace })` | `GET /provider` | `setStore("provider_next", reconcile(providerList))` |
| `sdk.client.experimental.console.get({ workspace })` | `GET /experimental/console` | `setStore("console_state", reconcile(consoleState))` (default `{consoleManagedProviders:[],switchableOrgCount:0}` on error) |
| `sdk.client.app.agents({ workspace })` | `GET /agent` | `setStore("agent", reconcile(agents))` |
| `sdk.client.config.get({ workspace })` | `GET /config` | `setStore("config", reconcile(config))` |
| `sdk.client.session.list({ start, scope?, path? })` | `GET /session?start=&scope=&path=` (or `roots`, `search`, `limit`) | `setStore("session", reconcile(sessions))` (only if `args.continue`, else done in stage 2) |
| `sdk.client.command.list({ workspace })` | `GET /command` | `setStore("command", reconcile(x.data ?? []))` |
| `sdk.client.lsp.status({ workspace })` | `GET /lsp` | `setStore("lsp", reconcile(x.data ?? []))` |
| `sdk.client.mcp.status({ workspace })` | `GET /mcp` | `setStore("mcp", reconcile(x.data ?? {}))` |
| `sdk.client.experimental.resource.list({ workspace })` | `GET /experimental/resource` | `setStore("mcp_resource", reconcile(x.data ?? {}))` |
| `sdk.client.formatter.status({ workspace })` | `GET /formatter` | `setStore("formatter", reconcile(x.data ?? []))` |
| `sdk.client.session.status({ workspace })` | `GET /session/status` | `setStore("session_status", reconcile(x.data ?? {}))` |
| `sdk.client.provider.auth({ workspace })` | `GET /provider/auth` | `setStore("provider_auth", reconcile(x.data ?? {}))` |
| `sdk.client.vcs.get({ workspace })` | `GET /vcs` | `setStore("vcs", reconcile(x.data))` |
| `sdk.client.experimental.workspace.list()` | `GET /experimental/workspace` | `setStore("workspace", "list", reconcile(listed.data))` (project store) |
| `sdk.client.experimental.workspace.status()` | `GET /experimental/workspace/status` | `setStore("workspace", "status", reconcile(next))` (project store, after Object.fromEntries) |
| `sdk.client.path.get({ workspace })` | `GET /path` | `setStore("instance", "path", reconcile(...))` (project store) |
| `sdk.client.project.current({ workspace })` | `GET /project/current` | `setStore("project", "id", ...)` ; `setStore("project", "worktree", ...)` |
| `sdk.client.project.directories({ projectID, workspace })` | `GET /project/{projectID}/directories` | `setStore("project", "mainDir", ...)` |
| `sdk.client.sync.start()` (only when `OPENCODE_EXPERIMENTAL_WORKSPACES`) | `POST /sync/start` | side-effect only |
| `sdk.global.event(...)` | `SSE GET /global/event` | source of all events in §4 |

### Per-session lazy sync (`sync.session.sync(sessionID)` in sync.tsx)

When the user opens a session, the TUI calls `sync.session.sync(sessionID)`
which fires:

```ts
const [session, messages, todo, diff] = await Promise.all([
  sdk.client.session.get({ sessionID }, { throwOnError: true }),
  sdk.client.session.messages({ sessionID, limit: 100 }),
  sdk.client.session.todo({ sessionID }),
  sdk.client.session.diff({ sessionID }),
])
```

| SDK call | HTTP route | Store target |
|---|---|---|
| `sdk.client.session.get({ sessionID })` | `GET /session/{sessionID}` | upsert into `store.session` (sorted by id) |
| `sdk.client.session.messages({ sessionID, limit: 100 })` | `GET /session/{sessionID}/message?limit=100` | `draft.message[sessionID] = visible` (last 100 messages) ; `draft.part[messageID] = parts` |
| `sdk.client.session.todo({ sessionID })` | `GET /session/{sessionID}/todo` | `draft.todo[sessionID] = todo.data ?? []` |
| `sdk.client.session.diff({ sessionID })` | `GET /session/{sessionID}/diff` | `draft.session_diff[sessionID] = diff.data ?? []` |

Response shape note: `session.messages` returns an array of
`{ info: Message, parts: Part[] }` objects (not flat messages).

### v2 data.tsx layer (separate /api/* routes)

| SDK call | HTTP route | data.tsx store target |
|---|---|---|
| `sdk.client.v2.location.get({ location })` | `GET /api/location` | sets default location signal; creates empty bucket in `store.location[key]` |
| `sdk.client.v2.agent.list({ location })` | `GET /api/agent` | `setStore("location", key, "agent", data)` |
| `sdk.client.v2.command.list({ location })` | `GET /api/command` | `setStore("location", key, "command", data)` |
| `sdk.client.v2.integration.list({ location })` | `GET /api/integration` | `setStore("location", key, "integration", data)` |
| `sdk.client.v2.model.list({ location })` | `GET /api/model` | `setStore("location", key, "model", data)` |
| `sdk.client.v2.provider.list({ location })` | `GET /api/provider` | `setStore("location", key, "provider", data)` |
| `sdk.client.v2.reference.list({ location })` | `GET /api/reference` (under v2 reference class) | `setStore("location", key, "reference", data)` |
| `sdk.client.v2.skill.list({ location })` | `GET /api/skill` | `setStore("location", key, "skill", data)` |
| `sdk.client.v2.session.get({ sessionID })` | `GET /api/session/{sessionID}` | `setStore("session", "info", sessionID, data.data)` |
| `sdk.client.v2.session.messages({ sessionID })` | `GET /api/session/{sessionID}/message` | `setStore("session", "message", sessionID, data.data)` |
| `sdk.client.v2.session.permission.list({ sessionID })` | `GET /api/session/{sessionID}/permission` | `setStore("session", "permission", sessionID, data.data)` |
| `sdk.client.v2.session.question.list({ sessionID })` | `GET /api/session/{sessionID}/question` | `setStore("session", "question", sessionID, data.data)` |
| `sdk.client.v2.permission.saved.list({ projectID })` | `GET /api/permission/saved` (filtered by projectID) | `setStore("project", "permission", projectID, data.data)` |

All v2 SDK responses wrap the payload in `data.data` — the outer `.data` is
the SDK's response container, the inner `.data` is the API envelope.

### Session create/prompt/etc. (from `component/prompt/index.tsx`)

| SDK call | HTTP route | Effect |
|---|---|---|
| `sdk.client.session.create({ directory, workspace, agent, model: {providerID, id, variant} })` | `POST /session` | returns `{ id }`. TUI uses returned `id` as `sessionID` for subsequent prompt |
| `sdk.client.session.prompt({ sessionID, model, agent, variant, parts: [...] })` | `POST /session/{sessionID}/message` | drives the real-time response (events stream in via SSE) |
| `sdk.client.session.shell({ sessionID, agent, model: {providerID, modelID}, command })` | `POST /session/{sessionID}/shell` | when input is shell mode |
| `sdk.client.session.command({ sessionID, command, arguments, agent, model: "providerID/modelID", variant, parts })` | `POST /session/{sessionID}/command` | when input is `/cmd ...` |
| `sdk.client.session.abort({ sessionID })` | `POST /session/{sessionID}/abort` | from `routes/session/index.tsx` (line 612) |
| `sdk.client.session.summarize({ sessionID })` | `POST /session/{sessionID}/summarize` | from session route |
| `sdk.client.session.revert(...)` | `POST /session/{sessionID}/revert` | |
| `sdk.client.session.unrevert(...)` | `POST /session/{sessionID}/unrevert` | |
| `sdk.client.session.fork({ sessionID })` | `POST /session/{sessionID}/fork` | from `app.tsx` lines 497, 517 |
| `sdk.client.global.upgrade({ target })` | `POST /global/upgrade` | upgrade command |

---

## 4. SSE event handling

The SSE source is `sdk.global.event(...)` (`GET /global/event`). Each event has
shape:

```ts
{ payload: Event, directory: string, workspace: string | undefined }
```

`event.ts` filters out `payload.type === "sync"` and forwards everything else
to subscribers as `(event, { directory, workspace })`. `sdk.tsx` batches event
emissions in a `batch(...)` and throttles to 16 ms windows.

### Events handled in `sync.tsx`

| Event `type` | `properties` shape (key fields) | Store mutation |
|---|---|---|
| `server.instance.disposed` | — | re-runs `bootstrap()` |
| `permission.asked` | `{ id, sessionID, ... } = PermissionRequest` | insert into `store.permission[sessionID]` (sorted by id, binary-search insert) |
| `permission.replied` | `{ sessionID, requestID }` | remove matching entry from `store.permission[sessionID]` |
| `question.asked` | `{ id, sessionID, ... } = QuestionRequest` | insert into `store.question[sessionID]` |
| `question.replied` | `{ sessionID, requestID }` | remove from `store.question[sessionID]` |
| `question.rejected` | `{ sessionID, requestID }` | remove from `store.question[sessionID]` |
| `todo.updated` | `{ sessionID, todos: Todo[] }` | `setStore("todo", sessionID, todos)` |
| `session.diff` | `{ sessionID, diff: SnapshotFileDiff[] }` | `setStore("session_diff", sessionID, diff)` |
| `session.deleted` | `{ info: { id } }` | remove from `store.session` |
| `session.updated` | `{ info: Session }` | upsert into `store.session` |
| `session.next.moved` | `{ sessionID, location: { directory, workspaceID }, subdirectory, timestamp }` | mutate `session.directory`/`session.path`/`session.workspaceID`/`session.time.updated` in place |
| `session.status` | `{ sessionID, status: SessionStatus }` | `setStore("session_status", sessionID, status)` |
| `message.updated` | `{ info: Message }` with `info.sessionID`, `info.id` | upsert into `store.message[sessionID]`; if list > 100, shift oldest and `delete part[oldest.id]` |
| `message.removed` | `{ sessionID, messageID }` | splice out of `store.message[sessionID]` |
| `message.part.updated` | `{ part: Part }` with `part.sessionID`, `part.messageID`, `part.id` | upsert into `store.part[messageID]` |
| `message.part.delta` | `{ sessionID, messageID, partID, field, delta }` | append `delta` to `part[field]` (string concat) |
| `message.part.removed` | `{ sessionID, messageID, partID }` | splice out of `store.part[messageID]` |
| `lsp.updated` | — | refetch `sdk.client.lsp.status({ workspace })` and replace `store.lsp` |
| `vcs.branch.updated` | `{ branch }` | if `metadata.workspace === current`: `setStore("vcs", { branch })` |

### Events handled in `data.tsx`

These shape `store.session.message[sessionID]: SessionMessage[]`, which is a
v2-flavoured message list (`SessionMessage` is a discriminated union of
`user | assistant | system | shell | agent-switched | model-switched |
synthetic | compaction`). `data.tsx` builds them **incrementally** from event
streams via `message.prepend(draft, item)` (which guards against duplicate
`item.id`). Note `prepend` actually `unshift`s — newest first.

| Event `type` | `properties` (key fields) | Mutation |
|---|---|---|
| `catalog.updated` | — | re-`refresh` `model` + `provider` for current location |
| `session.next.agent.switched` | `{ sessionID, messageID, agent, timestamp }` | prepend `{ type: "agent-switched", agent, ... }` |
| `session.next.model.switched` | `{ sessionID, messageID, model, timestamp }` | prepend `{ type: "model-switched", model, ... }` |
| `session.next.prompted` | `{ sessionID, messageID, prompt: { text, files, agents }, timestamp }` | prepend `{ type: "user", text, files, agents, ... }` |
| `session.next.prompt.admitted` | — | no-op (signals server accepted prompt) |
| `session.next.prompt.promoted` | `{ sessionID, messageID, prompt: {...}, timeCreated }` | prepend `{ type: "user", ... }` |
| `session.next.context.updated` | `{ sessionID, messageID, text, timestamp }` | prepend `{ type: "system", text, ... }` |
| `session.next.synthetic` | `{ sessionID, messageID, text, timestamp }` | prepend `{ type: "synthetic", text, ... }` |
| `session.next.shell.started` | `{ sessionID, messageID, callID, command, timestamp }` | prepend `{ type: "shell", callID, command, output: "", ... }` |
| `session.next.shell.ended` | `{ sessionID, callID, output, timestamp }` | locate shell by callID, set `output` + `time.completed` |
| `session.next.step.started` | `{ sessionID, assistantMessageID, agent, model, snapshot, timestamp }` | mark previous assistant `time.completed`; prepend new `{ type: "assistant", content: [], snapshot: { start } }` |
| `session.next.step.ended` | `{ sessionID, assistantMessageID, finish, cost, tokens, snapshot, timestamp }` | set `time.completed`, `finish`, `cost`, `tokens`, `snapshot.end` |
| `session.next.step.failed` | `{ sessionID, assistantMessageID, error, timestamp }` | set `time.completed`, `finish = "error"`, `error` |
| `session.next.text.started` | `{ sessionID, assistantMessageID, textID }` | push `{ type: "text", id: textID, text: "" }` to assistant's `content` |
| `session.next.text.delta` | `{ sessionID, assistantMessageID, textID, delta }` | append `delta` to matching text part |
| `session.next.text.ended` | `{ sessionID, assistantMessageID, textID, text }` | replace final `text` |
| `session.next.tool.input.started` | `{ sessionID, assistantMessageID, callID, name, timestamp }` | push `{ type: "tool", id: callID, name, state: { status: "pending", input: "" } }` |
| `session.next.tool.input.delta` | `{ sessionID, assistantMessageID, callID, delta }` | append `delta` to tool `state.input` (while pending) |
| `session.next.tool.input.ended` | `{ sessionID, assistantMessageID, callID, text }` | replace tool `state.input` |
| `session.next.tool.called` | `{ sessionID, assistantMessageID, callID, provider, input, timestamp }` | tool `state = { status: "running", input, structured: {}, content: [] }` ; `time.ran = timestamp` |
| `session.next.tool.progress` | `{ sessionID, assistantMessageID, callID, structured, content }` | update tool `state.structured` and `state.content` (while running) |
| `session.next.tool.success` | `{ sessionID, assistantMessageID, callID, structured, content, result, provider, timestamp }` | tool `state = { status: "completed", input, structured, content, result }` ; `time.completed` ; `provider.executed`/`provider.metadata`/`provider.resultMetadata` |
| `session.next.tool.failed` | `{ sessionID, assistantMessageID, callID, error, result, provider, timestamp }` | tool `state = { status: "error", error, input, structured, content, result }` |
| `session.next.reasoning.started` | `{ sessionID, assistantMessageID, reasoningID, providerMetadata }` | push `{ type: "reasoning", id, text: "", providerMetadata }` |
| `session.next.reasoning.delta` | `{ sessionID, assistantMessageID, reasoningID, delta }` | append `delta` |
| `session.next.reasoning.ended` | `{ sessionID, assistantMessageID, reasoningID, text, providerMetadata? }` | replace final `text` (and optionally `providerMetadata`) |
| `session.next.retried` | — | no-op |
| `session.next.compaction.started` | — | no-op |
| `session.next.compaction.delta` | — | no-op |
| `session.next.compaction.ended` | `{ sessionID, messageID, reason, text, recent, timestamp }` | prepend `{ type: "compaction", reason, summary: text, recent, ... }` |
| `reference.updated` | — | refetch `result.location.reference.refresh()` |
| `integration.updated` | — | refetch integration/model/provider for current location |

### Events handled in `project.tsx`

| Event `type` | `properties` | Mutation |
|---|---|---|
| `workspace.status` | `{ workspaceID, status }` | `setStore("workspace", "status", workspaceID, status)` |

### Event filtered out

`event.ts` swallows any event whose `payload.type === "sync"`. These are
internal sync-engine events the TUI never reacts to:

```ts
function subscribe(handler) {
  return sdk.event.on("event", (event) => {
    if (event.payload.type === "sync") return
    handler(event.payload, { directory: event.directory, workspace: event.workspace })
  })
}
```

---

## 5. Critical field dependencies (crash sites)

These are surfaces where the TUI assumes a particular shape and **WILL crash
or render blank if the server omits/mistypes the field**.

### 5.1 `config.providers` response — **must include `default`**

The known crash. `sync.tsx`:

```ts
setStore("provider",         reconcile(providers.providers))
setStore("provider_default", reconcile(providers.default))
```

If the server returns `{ providers: [...] }` without `default`, the TUI
later derefs `provider_default[q.id]` (in dialog code) → undefined → TypeError
on property access. The response must be `{ providers: Provider[], default: Record<string,string> }`.
Use `{}` (empty object) as a safe fallback for `default`, never omit.

### 5.2 `provider.list` (provider_next) — **must have `all`, `default`, `connected`**

Store default is:

```ts
provider_next: {
  all: [],
  default: {},
  connected: [],
}
```

A missing field gets `reconcile`'d to `undefined`, and downstream selectors
will crash on `.map`/`.find`. Always send all three keys.

### 5.3 `experimental.console.get` — caught, falls back gracefully

```ts
.catch(() => emptyConsoleState)   // { consoleManagedProviders: [], switchableOrgCount: 0 }
```

Safe to 404 or 5xx (resilient). But if you return a successful response with a
malformed body, no fallback fires. Must include both `consoleManagedProviders`
(array) and `switchableOrgCount` (number).

### 5.4 Session list / get / update — **`session.id` must be sortable & unique**

Every event handler uses `search(items, target, key)` (binary search) on
`store.session`, `store.message[sessionID]`, `store.part[messageID]`,
`store.permission[sessionID]`, `store.question[sessionID]`. **All these arrays
must remain sorted ascending by `.id`.** The TUI initial sort is
`a.id.localeCompare(b.id)`. If you return IDs that aren't lex-sortable, or
duplicate IDs across the lifetime of a session, you'll get:

- silent insert at wrong index → render order wrong
- binary search miss on update → duplicate row appears
- splice on missing match → silent skip, stale data lingers

ULIDs (the opencode convention) are safe.

### 5.5 Session shape — `time` object is dereferenced unconditionally

`sync.tsx` line 287: `session.time.updated = event.properties.timestamp`. The
session status getter (line 553-560) reads `session.time.compacting`. Sessions
MUST have a `time` object (even if all subfields are `null`/`undefined`).
Top-level fields touched: `id`, `directory`, `path`, `workspaceID`, `parentID`,
`revert`, `time.updated`, `time.compacting`.

### 5.6 Message shape — `role` and `time.completed`

`status(sessionID)` reads `last.role === "user"` and `last.time.completed`.
Messages must carry `role: "user" | "assistant" | ...` and a `time` object.
If `time` is missing, `last.time.completed` throws.

### 5.7 Part shape — `messageID`, `sessionID`, `id`, plus delta target field

`message.part.delta` does:

```ts
const field = event.properties.field as keyof typeof part
const existing = part[field] as string | undefined
;(part[field] as string) = (existing ?? "") + event.properties.delta
```

The `field` named in the delta MUST be a string-valued key on the part. For
`type: "text"` parts that's `text`; for `type: "reasoning"`, also `text`. If
you stream a delta with `field: "tool_input"` to a text part you'll silently
corrupt it (Solid stores will let you coerce).

### 5.8 Session.messages response shape — `[{info, parts}, ...]`

Line 582: `messages.data.flatMap(message => message.info)` and
`message.parts.flatMap(...)`. The response **must be an array of
`{ info: Message, parts: Part[] }` objects**, NOT a flat array of messages.

### 5.9 `provider_auth` keys must be string-indexable

```ts
provider_auth: Record<string, ProviderAuthMethod[]>
```

A `null` value at a known key crashes the auth dialog. Always send `{}` for
"no providers configured" rather than `null`.

### 5.10 `vcs.get` may legitimately return null/undefined

```ts
sdk.client.vcs.get({ workspace }).then((x) => setStore("vcs", reconcile(x.data)))
```

Store type is `VcsInfo | undefined`. Safe to return 200 with empty body. But
`vcs.branch.updated` event handler does `setStore("vcs", { branch })` which
**overwrites** any other fields — so if you only have `branch` to push, send
that whole object.

### 5.11 `path.get` — `path.worktree` and `path.directory` may be empty strings

`sessionListQuery()` checks `if (!project.data.instance.path.worktree || !project.data.instance.path.directory) return { scope: "project" }`. Empty
strings are tolerated and fall through to project scope. **But** `path.relative`
will throw if either is non-string. Must return at least string-typed
`worktree` and `directory` (empty `""` is OK).

### 5.12 SSE stream — `event.payload.type` must be a literal string

`event.ts` does `if (event.payload.type === "sync") return`. If `payload.type`
is undefined, the strict-equality fails (so it's "safe" but every handler then
runs `switch(event.type)` with `undefined`, and matches no case → silent drop.
Always send a `type` string.

### 5.13 `session.fork` — response must include the new sessionID

`app.tsx` does
`sdk.client.session.fork({ sessionID: match }).then((result) => ...)` and
navigates using the result. The fork response shape is `Session`-like with `id`.

### 5.14 `args.continue` path — `session.list` response array shape

When the user passes `--continue`, the blocking gate waits on `session.list`.
`listSessions()` does `(x.data ?? []).toSorted(...)` — so `data` must be an
array, not a paginated `{ items: [...], next: ... }` envelope.

---

## 6. session-create / prompt-send round-trip flow

User types text and hits Enter in `component/prompt/index.tsx` (function
`submitInner`):

### Step 1: client-side state checks

- read `local.agent.current()` (must exist or no-op)
- read `local.model.current()` (must exist or shows model warning)
- check `workspaceStatus === "connected"` if an existing session

### Step 2: if no existing sessionID, create a session

```ts
const res = await sdk.client.session.create({
  directory,                              // resolved from move.getDirectory(...) or undefined
  workspace: workspaceID,                 // from selectedWorkspace or undefined
  agent: agent.name,                      // string
  model: {
    providerID: selectedModel.providerID,
    id: selectedModel.modelID,
    variant,
  },
})
```

→ `POST /session` with that body. Response must include `{ id: string, ... }`.
The TUI sets `sessionID = res.data.id`.

**No event is required at this point.** The TUI proceeds to step 3 with
`sessionID` in hand. If you ALSO emit a `session.updated` event before the
prompt is sent, the TUI will upsert into `store.session` (harmless, recommended
so the sidebar refreshes immediately).

### Step 3: send the prompt

Three branches based on input:

#### 3a. Shell mode (`store.mode === "shell"`)

```ts
void sdk.client.session.shell({
  sessionID,
  agent: agent.name,
  model: { providerID: selectedModel.providerID, modelID: selectedModel.modelID },
  command: inputText,
})
```

→ `POST /session/{sessionID}/shell`. Fire-and-forget. The server is expected
to emit `session.next.shell.started` (with `messageID`, `callID`, `command`)
and `session.next.shell.ended` (with `callID`, `output`).

#### 3b. Slash command (`inputText.startsWith("/")` AND command exists in `sync.data.command`)

```ts
void sdk.client.session.command({
  sessionID,
  command: command.slice(1),                  // strip leading "/"
  arguments: args,                            // rest of the line + multi-line
  agent: agent.name,
  model: `${selectedModel.providerID}/${selectedModel.modelID}`,   // string form
  variant,
  parts: nonTextParts.filter((x) => x.type === "file"),
})
```

→ `POST /session/{sessionID}/command`. Same fire-and-forget pattern.

#### 3c. Normal prompt (everything else)

```ts
sdk.client.session.prompt(
  {
    sessionID,
    ...selectedModel,                         // spreads providerID, modelID
    agent: agent.name,
    model: selectedModel,                     // also passes nested model
    variant,
    parts: [
      ...editorParts,                         // optional `text` part w/ editor selection
      { type: "text", text: inputText },
      ...nonTextParts,                        // file parts, agent parts, etc.
    ],
  },
  { throwOnError: true },
)
.catch((error) => toast.show({ title: "Failed to send prompt", message: errorMessage(error), variant: "error" }))
```

→ `POST /session/{sessionID}/message`. Body shape (from v2 SDK):

```ts
{
  messageID?: string,
  model?: { providerID, modelID },
  agent?: string,
  noReply?: boolean,
  tools?: Record<string, boolean>,
  format?: OutputFormat,
  system?: string,
  variant?: string,
  parts?: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>,
}
```

The TUI awaits ONLY error throwing (`throwOnError: true`). It does NOT consume
the response body. **The full conversation is driven by SSE.**

### Step 4: SSE event stream replays the round-trip

Expected event order for a normal prompt:

1. `session.updated` — server stamps `time.updated`, propagates title changes
2. `message.updated` (or v2 `session.next.prompted`) — user message materializes
3. `session.status` — `{ status: { type: "working", ... } }` (cf. session_status keyed by sessionID)
4. `session.next.step.started` — `{ assistantMessageID, agent, model, snapshot, timestamp }` ; data.tsx creates assistant message with empty `content: []`
5. Interleaved while model streams:
   - `session.next.text.started` → `text.delta` (many) → `text.ended`
   - `session.next.reasoning.started` → `reasoning.delta` (many) → `reasoning.ended` (optional, if model supports thinking)
   - `session.next.tool.input.started` → `tool.input.delta` (many) → `tool.input.ended` → `tool.called` → `tool.progress`* → `tool.success`/`tool.failed`
6. `session.next.step.ended` — final `{ finish, cost, tokens, snapshot, timestamp }`. `time.completed` is set on the assistant message.
7. `session.status` — `{ status: { type: "idle", ... } }`

Both legacy (`message.updated` / `message.part.updated` / `message.part.delta` /
`message.part.removed`) AND v2-flavoured (`session.next.*`) events can be
emitted; sync.tsx handles the legacy stream, data.tsx handles the v2 stream.
**A v1-only backend must emit `message.updated` + `message.part.updated` +
`message.part.delta` for streaming text; a v2-only backend must emit the
`session.next.*` family.** The current TUI subscribes to both.

### Step 5: client cleanup

```ts
history.append({ ...store.prompt, mode: currentMode })
input.extmarks.clear()
setStore("prompt", { input: "", parts: [] })
setStore("extmarkToPartIndex", new Map())
if (!props.sessionID) {
  setTimeout(() => route.navigate({ type: "session", sessionID }), 50)
}
input.clear()
if (finishMoveProgress) move.finishSubmit()
```

If this was a new session, the TUI navigates to the session route, which fires
`sync.session.sync(sessionID)` (§3, "Per-session lazy sync") — calling
`session.get`, `session.messages`, `session.todo`, `session.diff` in parallel.
**Make sure those endpoints respond immediately, otherwise the new session
page sits in a "loading" state while messages arrive piecemeal via SSE.**

### Permission/question round-trip during a prompt

If the assistant invokes a tool that needs permission, the server emits
`permission.asked` with the full `PermissionRequest` object as `properties`.
TUI inserts it into `store.permission[sessionID]`. User answers — the route
code calls one of:

```ts
sdk.client.postSessionIdPermissionsPermissionId({
  sessionID, permissionID, ...
})
// OR (v2)
sdk.client.v2.session.permission.reply({ sessionID, requestID, response })
```

→ `POST /session/{sessionID}/permissions/{permissionID}` or
`POST /api/session/{sessionID}/permission/{requestID}/reply`. Server responds
to the tool internally, then emits `permission.replied` with `{ sessionID,
requestID }`, which causes the TUI to splice the request out of
`store.permission[sessionID]`.

Same pattern for `question.asked` / `question.replied` / `question.rejected`
(POST routes `/question/{requestID}/reply`, `/question/{requestID}/reject`, or
the v2 variants under `/api/session/.../question`).

---

## Quick-reference: minimum endpoints a server must implement

For an MVP backend that gets the TUI fully rendered + a single prompt working:

**Blocking startup (sync.tsx bootstrap gate):**

- `GET /config/providers` → `{ providers: Provider[], default: Record<string,string> }`
- `GET /provider` → `{ all: [...], default: {...}, connected: [...] }` (ProviderListResponse)
- `GET /experimental/console` → `{ consoleManagedProviders: [], switchableOrgCount: 0 }` (or 4xx/5xx, caught)
- `GET /agent` → `Agent[]`
- `GET /config` → `Config`
- `GET /path` → `Path` (`{ home, state, config, worktree, directory }`)
- `GET /project/current` → `{ id, worktree, ... } | null`
- `GET /project/{projectID}/directories` → `[{ directory, strategy? }, ...]`

**Non-blocking startup (status → complete):**

- `GET /session?start=&scope=project|path=` → `Session[]`
- `GET /command` → `Command[]`
- `GET /lsp` → `LspStatus[]`
- `GET /mcp` → `Record<string, McpStatus>`
- `GET /experimental/resource` → `Record<string, McpResource>`
- `GET /formatter` → `FormatterStatus[]`
- `GET /session/status` → `Record<sessionID, SessionStatus>`
- `GET /provider/auth` → `Record<string, ProviderAuthMethod[]>`
- `GET /vcs` → `VcsInfo | null`
- `GET /experimental/workspace` → `Workspace[]` (only if `OPENCODE_EXPERIMENTAL_WORKSPACES`)
- `GET /experimental/workspace/status` → `[{ workspaceID, status }, ...]`

**SSE firehose:**

- `GET /global/event` (text/event-stream) — emits envelopes `{ payload: Event, directory, workspace }`. Must emit at least: `session.updated`, `session.status`, `message.updated`, `message.part.updated`, `message.part.delta`, `permission.asked`/`replied`, `question.asked`/`replied`/`rejected`, `todo.updated`. v2-style event stream also wants the `session.next.*` family.

**Per-session lazy load (when route opens):**

- `GET /session/{sessionID}` → `Session`
- `GET /session/{sessionID}/message?limit=100` → `Array<{ info: Message, parts: Part[] }>`
- `GET /session/{sessionID}/todo` → `Todo[]`
- `GET /session/{sessionID}/diff` → `SnapshotFileDiff[]`

**Mutations from a prompt submit:**

- `POST /session` (body: `{ directory?, workspace?, agent, model: { providerID, id, variant? } }`) → `Session` with `id`
- `POST /session/{sessionID}/message` (body: `{ model, agent, variant, parts }`) → 200 OK; conversation flows over SSE
- `POST /session/{sessionID}/abort` → 200 OK
- `POST /session/{sessionID}/permissions/{permissionID}` → 200 OK (legacy permission reply)

Following this contract, the TUI will render fully and round-trip messages.
