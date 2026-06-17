# OpenCode Server HTTP Route Catalog

> **Source:** `sst/opencode` repo, branch `dev`, path `packages/server/src/`.
> **Captured by:** sub-agent research, 2026-06-17.
>
> The server is built on Effect's `HttpApi` (`effect/unstable/httpapi`). Routes are declared as `HttpApiGroup`s of `HttpApiEndpoint`s in `groups/` and bound to handlers in `handlers/`. The composite `Api` is exported from `api.ts`, materialized into HTTP routes by `routes.ts` (`createRoutes(password?)` → `webHandler()`), which exposes a fetch-style web handler.
>
> OpenAPI document is served at `/openapi.json` (configured in `routes.ts` via `HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" })`).

This document covers the v2 `/api/*` surface. The complete v1 `/...` legacy surface (used by the TUI's main store layer) is documented in `opencode-sdk-types.md` §20.

---

## 1. Wiring / Mount Order (`api.ts`)

```ts
export const Api = HttpApi.make("server")
  .add(HealthGroup)
  .add(LocationGroup)
  .add(AgentGroup)
  .add(SessionGroup)
  .add(MessageGroup)
  .add(ModelGroup)
  .add(ProviderGroup)
  .add(IntegrationGroup)
  .add(CredentialGroup)
  .add(PermissionGroup)
  .add(FileSystemGroup)
  .add(CommandGroup)
  .add(SkillGroup)
  .add(EventGroup)
  .add(PtyGroup)
  .add(QuestionGroup)
  .add(ReferenceGroup)
  .add(ProjectCopyGroup)
  .annotateMerge(OpenApi.annotations({ title: "opencode HttpApi", version: "0.0.1", description: "..." }))
  .middleware(Authorization)
  .middleware(SchemaErrorMiddleware)
```

- Every group is mounted with **no per-group path prefix**. Paths defined inside each `HttpApiEndpoint` are absolute, all prefixed with `/api/...` (except `ProjectCopyGroup` which uses `/experimental/project/...`).
- Two global middlewares apply to every endpoint: `Authorization` and `SchemaErrorMiddleware`.
- Several groups attach a `LocationMiddleware` (resolves directory/workspace from query or headers). Session-scoped endpoints with `:sessionID` additionally attach `SessionLocationMiddleware` which resolves location from the session's stored directory/workspace.

---

## 2. Authentication (`auth.ts` + `middleware/authorization.ts`)

- `OPENCODE_SERVER_PASSWORD` and `OPENCODE_SERVER_USERNAME` (default `"opencode"`) read at startup, OR password injected through `createRoutes(password)` (fixed username `"opencode"`).
- **No password configured** → middleware is no-op; every endpoint open.
- Password configured → HTTP Basic credentials required:
  - `Authorization: Basic <base64(username:password)>` header, OR
  - `auth_token` query parameter = `<base64(username:password)>`
- Missing/invalid → `401` with body `{"_tag":"UnauthorizedError","message":"Authentication required"}` and header `www-authenticate: Basic realm="Secure Area"`.
- **Exception:** WebSocket upgrade to `GET /api/pty/:ptyID/connect` with `?ticket=` skips credential check (browser WS can't set custom headers). Handler validates ticket itself.
- Helper: `header(credentials?)` → `Basic <base64>`; `headers(credentials?)` → `{ Authorization: ... }`.

---

## 3. CORS (`cors.ts`)

Custom CORS only in PTY handler for `pty.connectToken` and `pty.connect`, gated by `isAllowedRequestOrigin(origin, host, opts)`. Allowed:
- `http://localhost:*`, `http://127.0.0.1:*`
- `oc://renderer`
- `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`
- `https://*.opencode.ai` (regex)
- Any origin in `CorsConfig.cors` array
- Any origin matching `Host` header
- No `Origin` header (treated as allowed)

Outside PTY routes, no application-level CORS — depends on host process wrapping `webHandler()`.

---

## 4. Error Response Shape (`errors.ts`)

```json
{ "_tag": "<ErrorTag>", "message": "...", ...extra }
```

| Tag | Status | Extra |
|---|---|---|
| `InvalidRequestError` | 400 | `kind?`, `field?` |
| `UnauthorizedError` | 401 | — |
| `ForbiddenError` | 403 | — |
| `ConflictError` | 409 | `resource?` |
| `ServiceUnavailableError` | 503 | `service?` |
| `UnknownError` | 500 | `ref?` |
| `ProviderNotFoundError` | 404 | `providerID` |
| `SessionNotFoundError` | 404 | `sessionID` |
| `InvalidCursorError` | 400 | — |
| `PermissionNotFoundError` | 404 | `requestID` |
| `QuestionNotFoundError` | 404 | `requestID` |
| `PtyNotFoundError` | 404 | `ptyID` |
| `ProjectCopyError` | 400 | wrapped `data: {message, forceRequired?}` |

`SchemaErrorMiddleware` catches validation failures (truncates 1024 chars), converts to `InvalidRequestError`.

---

## 5. Location Query Convention (`groups/location.ts`)

`LocationMiddleware` is attached to most groups. Schema:

```ts
{ location?: { directory?: string, workspace?: string } }
```

OpenAPI renders as `style: "deepObject", explode: true`. Wire forms:
- `?location[directory]=/abs/path`
- `?location[workspace]=<workspaceID>`
- Alternatively via headers: `x-opencode-workspace`, `x-opencode-directory` (URL-encoded)

Default `directory = process.cwd()` if neither.

Standard envelope for location-scoped responses: `{ location: { directory, workspaceID?, project: {...} }, data: <payload> }`. Endpoints without `Location.response(...)` return just `{ data: ... }`.

---

## 6. Groups (v2 `/api/*` surface — 18 groups, 46 endpoints)

### 6.1 HealthGroup
| Method | Path | OpID | Response |
|---|---|---|---|
| GET | `/api/health` | `health.get` | `{ "healthy": true }` |

### 6.2 LocationGroup (LocationMiddleware)
| Method | Path | OpID | Query | Response |
|---|---|---|---|---|
| GET | `/api/location` | `location.get` | `LocationQuery` | `Location.Info = { directory, workspaceID?, project }` |

### 6.3 AgentGroup (LocationMiddleware)
| Method | Path | OpID | Query | Response |
|---|---|---|---|---|
| GET | `/api/agent` | `agent.list` | `LocationQuery` | `{ location, data: AgentV2.Info[] }` |

### 6.4 SessionGroup
Endpoints with `:sessionID` use SessionLocationMiddleware.

**`GET /api/session` — `session.list`** — Query:
```ts
{ workspace?: WorkspaceV2.ID, limit?: number /* default 50 */, order?: "asc"|"desc",
  search?: string, directory?: AbsolutePath, project?: ProjectV2.ID,
  subpath?: RelativePath, cursor?: SessionsCursor /* opaque base64url JSON */ }
```
Response: `{ data: SessionV2.Info[], cursor: { previous?, next? } }`.

**`POST /api/session` — `session.create`**
```ts
{ id?: SessionV2.ID, agent?: AgentV2.ID, model?: ModelV2.Ref, location?: Location.Ref }
```
Response: `{ data: SessionV2.Info }`. Default `location.directory = process.cwd()`.

**`GET /api/session/:sessionID` — `session.get`** → `{ data: SessionV2.Info }`. 404 SessionNotFoundError.

**`POST /api/session/:sessionID/prompt` — `session.prompt`**
```ts
{ id?: SessionMessage.ID, prompt: Prompt, delivery?: SessionInput.Delivery, resume?: boolean }
```
Response: `{ data: SessionInput.Admitted }`. 409 ConflictError, 404 SessionNotFoundError.

**`POST /api/session/:sessionID/compact` — `session.compact`** → 204. 404, 503.
**`POST /api/session/:sessionID/wait` — `session.wait`** → 204. 404, 503.
**`GET /api/session/:sessionID/context` — `session.context`** → `{ data: SessionMessage.Message[] }`. 404, 500.

### 6.5 MessageGroup (SessionLocationMiddleware)
**`GET /api/session/:sessionID/message` — `session.messages`** — Query:
```ts
{ limit?: number /* 1..200, default 50 */, order?: "asc"|"desc", cursor?: string }
```
Cursor cannot be combined with order. Response: `{ data: SessionMessage.Message[], cursor: { previous?, next? } }`.

### 6.6 ModelGroup (LocationMiddleware)
`GET /api/model` → `{ location, data: ModelV2.Info[] }`. 503.

### 6.7 ProviderGroup (LocationMiddleware)
`GET /api/provider` → `{ location, data: ProviderV2.Info[] }`. 503.
`GET /api/provider/:providerID` → `{ location, data: ProviderV2.Info }`. 404, 503.

### 6.8 IntegrationGroup (LocationMiddleware)
- `GET /api/integration` → `{ location, data: Integration.Info[] }`
- `GET /api/integration/:integrationID` → `{ location, data: Integration.Info | undefined }`
- `POST /api/integration/:integrationID/connect/key` body `{ key, label? }` → 204
- `POST /api/integration/:integrationID/connect/oauth` body `{ methodID, inputs: Record<string,string>, label? }` → `{ location, data: Integration.Attempt }`
- `GET /api/integration/attempt/:attemptID` → `{ location, data: Integration.AttemptStatus }`
- `POST /api/integration/attempt/:attemptID/complete` body `{ code? }` → 204
- `DELETE /api/integration/attempt/:attemptID` → 204

### 6.9 CredentialGroup (LocationMiddleware)
- `PATCH /api/credential/:credentialID` body `{ label }` → 204
- `DELETE /api/credential/:credentialID` → 204

### 6.10 PermissionGroup
- `GET /api/permission/request` (LocationMiddleware) → `{ location, data: PermissionV2.Request[] }`
- `GET /api/permission/saved` query `{ projectID? }` → `{ data: PermissionSaved.Info[] }`
- `DELETE /api/permission/saved/:id` → 204
- `GET /api/session/:sessionID/permission` (SessionLocationMiddleware) → `{ data: PermissionV2.Request[] }`
- `POST /api/session/:sessionID/permission/:requestID/reply` body `{ reply: PermissionV2.Reply, message? }` → 204

### 6.11 FileSystemGroup (LocationMiddleware)
- `GET /api/fs/read/*` — wildcard path URL-decoded. Response: raw `Uint8Array` with Content-Type from MIME. Handler slices `pathname.slice(13)`.
- `GET /api/fs/list` query `{ location?, path? }` → `{ location, data: FileSystem.Entry[] }`
- `GET /api/fs/find` query `{ location?, query, type, limit? }` → `{ location, data: FileSystem.Entry[] }`

### 6.12 CommandGroup (LocationMiddleware)
`GET /api/command` → `{ location, data: CommandV2.Info[] }`.

### 6.13 SkillGroup (LocationMiddleware)
`GET /api/skill` → `{ location, data: SkillV2.Info[] }`.

### 6.14 EventGroup (LocationMiddleware) — SSE
`GET /api/event` query `LocationQuery` → `text/event-stream`.

Headers: `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `X-Content-Type-Options: nosniff`.

First frame:
```json
{ "id": "<EventV2.ID>", "type": "server.connected", "location": {...}, "data": {} }
```

Then forwards every `EventV2` filtered to location's `(directory, workspaceID)`.

Event schema:
```ts
{ id: EventV2.ID, type: string, location?: Location.Info,
  metadata?: Record<string, unknown>, version?: number, data: unknown }
```

### 6.15 PtyGroup (LocationMiddleware) — WebSocket + ticket auth
WS ticket query: `ticket`. Mint-token header: `x-opencode-ticket: 1` (forces CORS preflight).

- `GET /api/pty` → `{ location, data: Pty.Info[] }`
- `POST /api/pty` body `Pty.CreateInput` → `{ location, data: Pty.Info }`
- `GET /api/pty/:ptyID` → `{ location, data: Pty.Info }`. 404.
- `PUT /api/pty/:ptyID` body `Pty.UpdateInput` → `{ location, data: Pty.Info }`
- `DELETE /api/pty/:ptyID` → 204
- `POST /api/pty/:ptyID/connect-token` → `{ location, data: PtyTicket.ConnectToken }`. 403/404. Forbidden if `x-opencode-ticket != "1"` or origin/host fails CORS.
- `GET /api/pty/:ptyID/connect` (WebSocket upgrade). Query decoded inside handler: `ticket`, `cursor` (int >= -1), `location[directory]`, `location[workspace]`.

PTY connect behavior:
1. Missing PTY → HTTP 404 (no upgrade)
2. Ticket present but bad origin / invalid / consumed → HTTP 403
3. Otherwise upgrade WS. Sequence: replay buffered output as `PtyProtocol` chunks, send `PtyProtocol.metaFrame(cursor)` once, then stream live output; accept client input via `PtyProtocol.decodeInput`. Close: 1000 on exit; 4404 with `"session not found"` or `"session exited"` on mid-attach.

### 6.16 QuestionGroup
- `GET /api/question/request` (LocationMiddleware) → `{ location, data: QuestionV2.Request[] }`
- `GET /api/session/:sessionID/question` (SessionLocationMiddleware) → `{ data: QuestionV2.Request[] }`
- `POST /api/session/:sessionID/question/:requestID/reply` body `QuestionV2.Reply ({ answers })` → 204
- `POST /api/session/:sessionID/question/:requestID/reject` → 204

### 6.17 ReferenceGroup (LocationMiddleware)
`GET /api/reference` → `{ location, data: Reference.Info[] }`.

### 6.18 ProjectCopyGroup (LocationMiddleware, prefix `/experimental/project/:projectID/copy`)
- `POST /experimental/project/:projectID/copy` body `ProjectCopy.CreateInput` minus `projectID, sourceDirectory` (server derives from `location.project.directory`) → `ProjectCopy.Copy`
- `DELETE /experimental/project/:projectID/copy` body `ProjectCopy.RemoveInput` minus `projectID` → 204
- `POST /experimental/project/:projectID/copy/refresh` → 204

ProjectCopyError envelope (note `data` wrapping):
```json
{ "_tag": "ProjectCopyError", "name": "ProjectCopyError",
  "data": { "message": "...", "forceRequired": true } }
```

---

## 7. Endpoint Index (alphabetical)

| Method | Path |
|---|---|
| GET | `/api/agent` |
| GET | `/api/command` |
| PATCH | `/api/credential/:credentialID` |
| DELETE | `/api/credential/:credentialID` |
| GET | `/api/event` |
| GET | `/api/fs/find` |
| GET | `/api/fs/list` |
| GET | `/api/fs/read/*` |
| GET | `/api/health` |
| GET | `/api/integration` |
| GET | `/api/integration/:integrationID` |
| POST | `/api/integration/:integrationID/connect/key` |
| POST | `/api/integration/:integrationID/connect/oauth` |
| GET | `/api/integration/attempt/:attemptID` |
| POST | `/api/integration/attempt/:attemptID/complete` |
| DELETE | `/api/integration/attempt/:attemptID` |
| GET | `/api/location` |
| GET | `/api/model` |
| GET | `/api/permission/request` |
| GET | `/api/permission/saved` |
| DELETE | `/api/permission/saved/:id` |
| GET | `/api/provider` |
| GET | `/api/provider/:providerID` |
| GET | `/api/pty` |
| POST | `/api/pty` |
| GET | `/api/pty/:ptyID` |
| PUT | `/api/pty/:ptyID` |
| DELETE | `/api/pty/:ptyID` |
| POST | `/api/pty/:ptyID/connect-token` |
| GET | `/api/pty/:ptyID/connect` (WS) |
| GET | `/api/question/request` |
| GET | `/api/reference` |
| GET | `/api/session` |
| POST | `/api/session` |
| GET | `/api/session/:sessionID` |
| GET | `/api/session/:sessionID/context` |
| GET | `/api/session/:sessionID/message` |
| GET | `/api/session/:sessionID/permission` |
| POST | `/api/session/:sessionID/permission/:requestID/reply` |
| POST | `/api/session/:sessionID/prompt` |
| POST | `/api/session/:sessionID/compact` |
| POST | `/api/session/:sessionID/wait` |
| GET | `/api/session/:sessionID/question` |
| POST | `/api/session/:sessionID/question/:requestID/reply` |
| POST | `/api/session/:sessionID/question/:requestID/reject` |
| GET | `/api/skill` |
| POST | `/experimental/project/:projectID/copy` |
| DELETE | `/experimental/project/:projectID/copy` |
| POST | `/experimental/project/:projectID/copy/refresh` |
| GET | `/openapi.json` (auto) |

Total: 46 application endpoints + OpenAPI doc.

---

## 8. Implementation Notes

- `HttpApi` generates OpenAPI automatically. Path params use `:param`, query uses `deepObject` for `location`.
- 204 responses use `HttpApiSchema.NoContent`.
- Binary responses (`fs.read`) use `HttpApiSchema.asUint8Array()`.
- Raw handlers (`handleRaw`): `pty.connect` (WS), `event.subscribe` (SSE), `fs.read` (binary). Declared success schema nominal.
- All session-scoped routes run `SessionLocationMiddleware`: validates `sessionID` (→ InvalidRequestError with `field: "sessionID"` if bad), looks up (directory, workspace_id) from SQLite SessionTable, throws SessionNotFoundError if missing, hydrates Location context overriding query/header.
- Pagination cursors are opaque base64url-encoded JSON. `session.list` cursor wraps original query so filters persist across pages.

---

## Cross-references

- v1 routes (used by main TUI store): see `opencode-sdk-types.md` §20.
- SDK type definitions for `AgentV2.Info`, `SessionV2.Info`, `PermissionV2.Request`, etc.: see `opencode-sdk-types.md` §3–§19.
- Which SDK calls hit which routes (and what store fields they populate): see `opencode-tui-mapping.md` §3.
