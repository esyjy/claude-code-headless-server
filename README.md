# Claude Code Headless Server

Programmable HTTP API for Claude Code — semantic integration with OpenTUI. Permission modes, PTY WebSocket proxy, slash commands, tool execution, multi-turn sessions, and clean single-directory deployment.

> **v0.6.0** — Playbook v0.4.0 adoption + macbook hardening. `127.0.0.1`
> default binding (ADR 0011, CI-enforced canary), macOS-portable
> `tunnel.sh`, opt-in artifacts (PROJECT-POLICY, SESSION-CONTEXT, ADR
> 0010), macOS CI lane, branch protection, label taxonomy.
>
> Inherits ADRs 0001~0009 from upstream `chyun-code/...@v0.5.0`.
>
> See [Releases](https://github.com/esyjy/claude-code-headless-server/releases) | [ADR Index](docs/adr/) | [Issues](https://github.com/esyjy/claude-code-headless-server/issues) | [Playbook](https://github.com/esyjy/playbook)

## Architecture

```
┌─────────┐  prompt    ┌──────────────┐  --resume  ┌────────────┐
│ OpenTUI │ ─────────→ │  Headless    │ ─────────→ │ Claude Code│
│         │ ←───────── │  Server      │ ←───────── │            │
│         │  SSE event │  (Bun+Hono)  │  NDJSON    │ (stream)   │
│  mode   │ ─────────→ │  permission  │ ─────────→ │ --resume   │
│  switch │ ←───────── │  mode relay  │ ←───────── │  sessions  │
└─────────┘            └──────────────┘            └────────────┘
```

Each prompt is a fresh `claude -p` invocation. Session continuity via `--resume`. Permission modes map semantically between OpenTUI and Claude Code.

## Quick Install

```bash
# One line — everything in ~/.claude-headless-server
curl -fsSL https://raw.githubusercontent.com/esyjy/claude-code-headless-server/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/esyjy/claude-code-headless-server.git ~/.claude-headless-server
cd ~/.claude-headless-server
bun install
./scripts/claude-headless-server.sh start
```

> **Requirements:** Bun, Claude Code CLI (authenticated). Non-root user recommended for `bypassPermissions` mode.

### Network exposure

The server binds to **`127.0.0.1`** by default (ADR 0011) — accessible
only from the same host. To expose to the LAN, set
`CLAUDE_SERVER_HOST` explicitly:

```bash
CLAUDE_SERVER_HOST=0.0.0.0 claude-headless-server start         # all interfaces
CLAUDE_SERVER_HOST=10.0.0.5 claude-headless-server start         # specific NIC
```

Combine with `claude-headless-server tui` (which sets up OpenCode Basic
Auth, ADR 0009) before exposing externally. Plain `start` with
`CLAUDE_SERVER_HOST=0.0.0.0` and no Basic Auth means **anyone on the
network can trigger `bypassPermissions` execution** on the host —
intentional only if you know what that means.

## Usage

```bash
claude-headless-server start      # Start server (background)
claude-headless-server status     # Check if running
claude-headless-server stop       # Stop server
claude-headless-server restart    # Stop + start
claude-headless-server logs       # Tail server logs
claude-headless-server tui        # Launch OpenTUI backed by this server
```

### `claude-headless-server tui`

One command to use **Claude Code as the backend** and **OpenTUI as the frontend**:

```bash
claude-headless-server tui
```

What it does:
1. Generates a password and writes it to `~/.local/state/opencode/password`
2. Starts the headless server on port 4096
3. Writes an OpenCode daemon registration to `~/.local/state/opencode/server.json`
4. Executes `opencode`, which opens OpenTUI connected to our server

Requirements: `opencode` must be installed and on your PATH.

To stop:

```bash
claude-headless-server stop   # Also removes OpenCode daemon registration
```

## Integration Test

```bash
./scripts/test-opencode-integration.sh
```

Verifies Basic Auth, OpenCode daemon registration format, and endpoint compatibility without requiring the `opencode` binary.

## Uninstall

```bash
claude-headless-server uninstall
```

**Removes ONLY `~/.claude-headless-server`.** No other files touched. No scattered config. No /etc pollution. No shell rc modifications. No irreversible system changes. Just one `rm -rf` of a single directory.

## API (v0.6.0)

| Endpoint | Status | Description |
|---|---|---|
| `GET /api/health` | ✅ | Health check |
| `POST /api/session` | ✅ | Create session (accepts `permissionMode`) |
| `GET /api/session` | ✅ | List sessions |
| `GET /api/session/:id` | ✅ | Session info |
| `PATCH /api/session/:id` | ✅ | Update mode/config |
| `POST /api/session/:id/prompt` | ✅ | Send prompt → spawns Claude |
| `POST /api/session/:id/respond` | ✅ | Accepts permission response (full interactive relay in Phase 2) |
| `GET /api/event` (SSE) | ✅ | Real-time event stream |
| `GET /api/pty/:id/connect` (WS) | ✅ | Real PTY (node-pty) with Bun.spawn fallback |

## Slash Commands

The server handles these commands inline before forwarding to Claude Code:

| Command | Action |
|---|---|
| `/model <name>` | Switch model mid-session |
| `/permission-mode <mode>` | Change permission mode (default / acceptEdits / bypassPermissions / plan) |
| `/compact` | Compact session history |
| `/resume <session-id>` | Resume an existing Claude Code session |
| `/help` | List available commands |

Unknown commands fall through to Claude Code'''s built-in handler.

## SSE Event Types

| Event | When |
|---|---|
| `server.connected` | SSE connection established |
| `session.next.prompt.admitted` | Prompt accepted |
| `session.next.agent.switched` | Claude Code ready |
| `session.next.step.started` | Claude begins processing |
| `session.next.reasoning.*` | Claude thinking (started/delta/ended) |
| `session.next.tool.called` | Tool invocation |
| `session.next.tool.success` | Tool result |
| `session.next.text.*` | Text response (started/delta/ended) |
| `session.next.step.ended` | Turn complete (cost, tokens) |
| `session.next.tool.permission_denied` | Tool blocked by permission mode |
| `session.updated` | Mode/config changed |

## Permission Mode Mapping

| OpenTUI Mode | Claude Code Mode | Behavior |
|---|---|---|
| `default` | `default` | Bash auto-approved, Read/Write prompt user |
| `auto-edit` | `acceptEdits` | File edits auto-approved |
| `yolo` | `bypassPermissions` | All tools auto-approved |
| `plan` | `plan` | No tool execution |

Mode switches via `PATCH /api/session/:id {permissionMode:acceptEdits}` or per-prompt: `POST /api/session/:id/prompt {permissionMode:..., ...}`.

## ADRs

| # | Title |
|---|---|
| [0001](docs/adr/0001-use-hono-and-claude-code-headless.md) | Use Hono + Claude Code Headless |
| [0002](docs/adr/0002-permission-mode-semantic-mapping.md) | Semantic Permission Mode Mapping |
| [0003](docs/adr/0003-single-directory-deployment.md) | Single-Directory Deployment & Clean Uninstall |
| [0005](docs/adr/0005-opentui-compatibility.md) | OpenTUI Compatibility Interface |
| [0006](docs/adr/0006-opencode-protocol-integration.md) | OpenCode Backend Protocol Integration |
| [0007](docs/adr/0007-opencode-compatibility-layer.md) | OpenCode API Compatibility Layer |
| [0008](docs/adr/0008-opencode-daemon-registration.md) | OpenCode Daemon Registration |
| [0009](docs/adr/0009-basic-auth-compatibility.md) | Basic Auth Compatibility |
| [0010](docs/adr/0010-playbook-v0.4.0-adoption.md) | Playbook v0.4.0 Adoption + Fork Relationship |
| [0011](docs/adr/0011-localhost-default-binding.md) | `127.0.0.1` Default Binding, Opt-in External |

## License

MIT
