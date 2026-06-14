# OpenCode Protocol — measured

> **Source:** live probe against `opencode 1.17.7` (Bun-compiled binary at `~/.opencode/bin/opencode`) on 2026-06-15.
> **Scripts:** `/tmp/probe-opencode.sh`, `/tmp/probe-opencode-session.sh` (regenerable; not in repo by design — see "Reproducing" below).
> **Purpose:** Replace ADRs 0006/0007/0008's assumed protocol surface with measured ground truth so Phase 7 Steps 7.2/7.3 can target the real protocol.
> **Secrets in this doc:** none. All examples redact `apiKey`, paths under `/Users/<name>/`, and project IDs.

---

## TL;DR — what the upstream got wrong

| Upstream claim | Reality |
|---|---|
| ADR 0007: routes mount at `/api/X` for opencode compat | OpenTUI / `opencode attach` calls **bare paths** (`/agent`, `/config`, `/session`, `/global/event`, …). `/api/X` is a SEPARATE wrapped-shape API used by opencode's own web UI. |
| ADR 0008: `~/.local/state/opencode/server.json` triggers attach to use our backend | `server.json` is **published by an opencode serve instance to advertise itself**. `opencode` (TUI) does not read it as a "use this backend" pointer. Only `opencode attach <url>` switches backend. |
| ADR 0006: OpenCode protocol = JSON envelope `{ location, data }` | That envelope is only on `/api/*`. The TUI's actual surface (`/agent`, `/session`, …) returns bare arrays/objects with **different field names**. |

These were authored from a snapshot of opencode's `/api/*` web routes and assumed they were what TUI/attach used. They aren't.

---

## Surface map (status per route)

Two coexisting surfaces. **TUI uses the right column.**

| `/api/*` (wrapped, web UI client) | `/<bare>` (TUI / attach client) | Notes |
|---|---|---|
| `/api/health` → `{"healthy":true}` | (same path) | identical |
| `/api/app` → SPA HTML | n/a | web shell fallback |
| `/api/config` → SPA HTML | `/config` → bare config object | **bare = real** |
| `/api/agent` → `{location, data:[…]}` | `/agent` → `[{name, description, mode, native, permission, …}]` | **different shapes** |
| `/api/provider` → `{location, data:[…]}` | `/provider` → `{all:[…], default: …}` | different shapes |
| `/api/model` → `{location, data:[…]}` | `/model` → SPA HTML | TUI doesn't call `/model`; gets models inside provider |
| `/api/session` → `{data:[…]}` | `/session` → `[…]` (array) | different shapes |
| `/api/location` → `{directory, project}` | `/location` → SPA HTML | TUI uses `/path` and `/project/current` instead |
| `/api/skill` → `{location, data:[…]}` | `/skill` → `[…]` (bare array) | shape diff |
| `/api/command` → `{location, data:[…]}` | `/command` → `[…]` (bare array) | shape diff |
| `/api/permission/request` → `{location, data:[]}` | (same path likely) | |
| n/a | `/config/providers` → `{providers:[…]}` | TUI only |
| n/a | `/experimental/console` → `{consoleManagedProviders, switchableOrgCount}` | TUI only |
| n/a | `/project/current` → `{id, worktree, vcs, time, sandboxes}` | TUI only |
| n/a | `/path` → `{home, state, config, worktree, directory}` | TUI only |
| `/api/event` (ours) | `/global/event` (SSE) | **different path**; see "Events" below |

---

## Discovery sequence (what `opencode attach` calls)

Captured by attaching to OUR server (acting as honeypot) at port 4096 with a
probe middleware. Order observed:

```
GET /global/event       (SSE, persistent connection)
GET /config
GET /agent
GET /experimental/console
GET /provider
GET /config/providers
GET /project/current
GET /path
```

If any of these returns 4xx, attach errors out before TUI draws. ours
returned 404 on all 7 of `/global/event` through `/path`. Hence the
observed `Error: 404 Not Found`.

---

## Response shapes (measured)

### `GET /config`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "command": {},
  "plugin": ["file:///Users/<redacted>/.config/opencode/plugin/auto-mode.js"],
  "model": "opencode/kimi-k2.5-free",
  "username": "<redacted>",
  "mode": {},
  "agent": {
    "bypass": {
      "prompt": "<user's auto-mode prompt>",
      ...
    }
  },
  ...
}
```

User's installed config is reflected. Our server must emit a compatible
schema even if our values are empty/default. Plugin paths and custom
agents (e.g. `bypass`) are part of the user's environment and our
server should pass them through transparently — see Phase 7 Step 7.4
notes on `automode`.

### `GET /agent`

```json
[
  {
    "name": "build",
    "description": "The default agent. Executes tools based on configured permissions.",
    "mode": "primary",
    "native": true,
    "permission": [
      {"permission": "*", "pattern": "*", "action": "allow"},
      {"permission": "doom_loop", "pattern": "*", "action": "ask"},
      ...
    ]
  },
  ...
]
```

Bare array. Note `permission` is an array of rules with `permission` /
`pattern` / `action` triplets — finer-grained than our four
`permissionMode` enum values. **This is the surface automode rides
on**: opencode's notion of "auto" is "an agent whose permission rules
mostly allow without asking".

### `GET /provider`

```json
{
  "all": [
    {
      "id": "<provider-id>",
      "name": "<provider-name>",
      "source": "custom",
      "env": ["<ENV_VAR_NAME>"],
      "options": {},
      "models": {
        "<model-id>": {
          "id": "...",
          "providerID": "...",
          "api": {"id": "...", "url": "...", "npm": "..."},
          "name": "...",
          "family": "...",
          "capabilities": { "temperature": true, "reasoning": true,
                            "attachment": true, "toolcall": true,
                            "input": {...}, "output": {...} }
        },
        ...
      }
    },
    ...
  ],
  "default": "..."
}
```

This is the **only** provider surface the TUI uses. Models hang off
providers. The `/api/model` route returns a different (wrapped) shape
that TUI doesn't consume.

### `GET /config/providers`

```json
{
  "providers": [
    {
      "id": "<provider-id>",
      "name": "<provider-name>",
      "source": "api",
      "env": ["<ENV_VAR>"],
      "key": "<REDACTED>",
      "options": {},
      "models": { ... }
    }
  ]
}
```

⚠️ Real response contains the user's API keys. Our server must NEVER
return third-party keys — only the configured provider list relevant
to this backend (i.e. Claude). For our `claude` backend we'll return
a single-provider entry with no keys.

### `GET /experimental/console`

```json
{ "consoleManagedProviders": [], "switchableOrgCount": 0 }
```

Trivial stub.

### `GET /project/current`

```json
{
  "id": "<project-id-hash>",
  "worktree": "/Users/<redacted>/Documents/<project>",
  "vcs": "git",
  "time": { "created": <ms>, "updated": <ms> },
  "sandboxes": []
}
```

Derived from the cwd opencode was launched in.

### `GET /path`

```json
{
  "home": "/Users/<redacted>",
  "state": "/Users/<redacted>/.local/state/opencode",
  "config": "/Users/<redacted>/.config/opencode",
  "worktree": "/Users/<redacted>/Documents/<project>",
  "directory": "/Users/<redacted>/Documents/<project>"
}
```

XDG-style path enumeration. Our backend should report its own
equivalents (e.g. `state: ~/.claude-headless-server/state`).

---

## Session lifecycle

### `POST /session` (create)

Request: `{}` (body optional).

Response:

```json
{
  "id": "ses_<base58>",
  "slug": "<adjective>-<noun>",
  "projectID": "<project-hash>",
  "directory": "/Users/<redacted>/...",
  "path": "",
  "cost": 0,
  "tokens": { "input": 0, "output": 0, "reasoning": 0,
              "cache": { "read": 0, "write": 0 } },
  "title": "New session - <ISO timestamp>",
  "version": "1.17.7",
  "time": { "created": <ms>, "updated": <ms> }
}
```

Notice **`version`** field — opencode marks the version of itself that
created the session. Our server should set this to its own version
(reading `package.json` cleanly — see Phase 6 footgun about
`/api/health` returning stale `0.5.0`).

### `GET /session`

```json
[ { ...session-record... }, { ...session-record... }, ... ]
```

Bare array of session records (same shape as POST response).

### `GET /session/:id`

Single record, same shape.

### Differences vs `/api/session`

`POST /api/session` returns `{"data": { id, projectID, agent: null,
model: null, cost, tokens, time, title, location, subpath }}` — a
WRAPPED, **different-shaped** record. Notice `agent`/`model` fields and
no `version`/`slug`.

---

## Events (`GET /global/event`, SSE)

Server-Sent Events stream. Each event is a `data:` line followed by a
JSON payload.

### Observed event taxonomy

```jsonc
// Connection
data: {"payload":{"id":"evt_<id>","type":"server.connected","properties":{}}}

// Domain event (e.g. session created)
data: {"directory":"<path>","project":"<project-id>","payload":{"id":"evt_<id>","type":"session.created","properties":{"sessionID":"ses_<id>","info":{...session record...}}}}

// Sync event (state-replication wrapper)
data: {"directory":"<path>","project":"<project-id>","payload":{"type":"sync","syncEvent":{"id":"evt_<id>","type":"session.created.1","seq":0,"aggregateID":"ses_<id>","data":{...}},"id":"evt_<id>"}}
```

### Three-layer envelope

1. **Outer** (when project-scoped): `{directory, project, payload}`.
2. **`payload`**: `{id, type, properties}` — the domain event.
3. **`payload.type === "sync"`**: `{syncEvent: {id, type, seq, aggregateID, data}}` — same content
   re-encoded for clients doing event-sourcing-style state sync.

Our server emits *neither* of these envelopes today. Our existing
events look like `{type: "session.next.text.delta", data: {...}}`. Phase
7 Step 7.3 has to remap the entire emitter.

### Event types observed (incomplete — to expand under prompt traffic)

- `server.connected` — emitted once on SSE open
- `session.created` — emitted after `POST /session`
- (sync event variant of each domain event, with `.1` suffix)

**TODO (next-probe scope, captured here as a 7.3 prerequisite):**
- `session.idle` / `session.busy`
- `message.appended` / `message.text.delta` / `message.text.end`
- `tool.use.start` / `tool.use.delta` / `tool.use.end`
- `tool.permission.request` / `tool.permission.result`
- `permission.request` (legacy, may not be emitted)

These need to be captured by running `opencode run --prompt "..."` (or
attach + manual prompt) against the real serve while tailing
`/global/event`. Not done yet.

---

## Auth

`opencode attach -u <user> -p <password>` sends standard HTTP Basic
Auth. The `Authorization: Basic <base64>` header is set on **every**
request including the persistent SSE GET.

Our server (post-Phase 6) handles Basic Auth via ADR 0009 with two
sources (`OPENCODE_SERVER_PASSWORD` env, `~/.local/state/opencode/password`
file). Probe confirmed:

- Without auth: every route returns 401 (including `/api/health`).
- With correct creds: routes return their normal response (or 404 if
  the route is unmapped — i.e. attach gets 404 on `/global/event` etc.
  because we never implemented those, not because auth failed).

Step 7.2 must mount the bare-path routes inside the same Basic Auth
middleware.

---

## Permission / question protocol (not yet probed live)

Routes observed in opencode source surface but not yet exercised:

- `/session/:id/permission` (GET) — list pending permission requests
- `/session/:id/permission/:requestID/reply` (POST) — accept/deny
- `/session/:id/question` (GET) — list pending clarifying questions
- `/session/:id/question/:requestID/reply` (POST) — answer
- `/session/:id/question/:requestID/reject` (POST) — reject

**TODO** (7.3 prerequisite): exercise these by running a prompt that
triggers a tool requiring permission. Capture request and reply
shapes.

---

## Reproducing

The probe scripts are intentionally **not committed** to the repo —
they reach out to the user's local opencode install and leak path
details. Regenerate locally with:

```bash
cat > /tmp/probe-opencode.sh <<'EOF'
#!/bin/bash
set -u
CURL=/usr/bin/curl
HEAD=/usr/bin/head
OPENCODE=$HOME/.opencode/bin/opencode

$OPENCODE serve --port 9999 > /tmp/oc-real.log 2>&1 &
OCPID=$!
sleep 3
for path in /api/health /api/app /api/config /api/agent /api/provider \
            /api/model /api/session /api/location /api/skill \
            /api/permission/request /api/command \
            /config /agent /provider /config/providers \
            /experimental/console /project/current /path \
            /command /skill /model /location; do
  code=$($CURL -s --max-time 3 -o /tmp/probe-body -w "%{http_code}" "http://localhost:9999$path")
  echo "=== [$code] $path ==="
  $HEAD -c 500 /tmp/probe-body; echo
done
kill $OCPID; wait $OCPID 2>/dev/null
EOF
bash /tmp/probe-opencode.sh
```

For session lifecycle + SSE: see `phase-7` plan §Step 7.1; an expanded
probe script lives in this session's transcript.

---

## What this enables (Phase 7 Steps 7.2 and 7.3)

- **Step 7.2 — route migration**: implement all bare-path GETs above,
  matching the documented shapes. Add stubs for the routes we don't
  yet exercise (e.g. `/experimental/console`).
- **Step 7.3 — event parity**: re-emit our `session.next.*` events
  inside opencode's three-layer envelope (or replace our taxonomy
  entirely with opencode's). Decision deferred to 7.3 — needs the
  next-probe data on `session.busy` / `message.text.delta` /
  `tool.use.*` to decide whether to map or replace.
- **Step 7.4 — automode**: opencode's "auto" is realized via the
  `agent.permission[]` rule set (not a single CLI flag). Our
  `permissionMode: "auto"` should map to an agent whose rules read
  "allow on default, ask on doom_loop / external_directory". This
  mirrors the user's existing `bypass` agent in `/config`.

---

## Open questions (move to issues during 7.2 / 7.3)

1. Do we expose user's own config (`~/.config/opencode/config.json`)
   passthrough, or substitute our own minimal config? Implication: if
   we pass through, the user's `plugin` / custom-agent entries
   activate against our backend, which means user's `auto-mode.js`
   runs in our context — could be desirable (automode for free) or
   dangerous (untrusted code path). Default decision: **passthrough
   READ for now, no execution of opencode plugins by us** (they're
   client-side anyway).
2. How does opencode discover `version` of the connected backend? It
   reads from session records' `version` field — so our session-create
   response must include `version: "0.7.0"`.
3. Are `slug` (`mighty-tiger`, `cosmic-falcon`) random-generated server-side?
   Yes; we'll port the generator or use any deterministic
   adjective-noun pool.
