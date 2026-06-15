# Claude Code — complete surface catalog

> **Sources** (canonical, public docs and SDK as of 2026-06-15):
> - `code.claude.com/docs/en/cli-reference`
> - `code.claude.com/docs/en/agent-sdk/overview`
> - `code.claude.com/docs/en/agent-sdk/typescript`
> - `code.claude.com/docs/en/permission-modes`
> - `platform.claude.com/docs/en/about-claude/models/overview`
> - `code.claude.com/docs/llms.txt` (full doc index — 181 pages)
> - `@anthropic-ai/claude-agent-sdk` TypeScript types
> - `claudeguide.io`, `blakecrosley.com/guides/claude-code-cheatsheet` (community references, cross-checked)
>
> **Purpose:** This is one of the three catalogs that must exist BEFORE any mapping code. The other two are `opencode-surface.md` (OpenCode↔OpenTUI wire protocol) and `mapping.md` (1:1 correspondence). Catalogs are descriptive — not aspirational. Every entry here must be derivable from a current public source.
>
> **Universality (전역성) requirement:** Anything that Claude Code adds in future versions must surface here without code changes to our adapter. The Agent SDK's `Query.initializationResult()` and `Query.supportedModels/Commands/Agents()` make this possible — see §10.

---

## 1. The two surfaces

Claude Code is one product with two equivalent invocation surfaces:

| Surface | Used by | What it is |
|---|---|---|
| **CLI** (`claude ...`) | Humans, scripts | Interactive REPL + 25 subcommands + 60+ flags. Stream-json output for scripted use. |
| **Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Programmatic integrations | TypeScript/Python library. Bundles native Claude Code binary. Exposes `query()` + `startup()` + session-management functions. |

**Critical observation for our project:** the SDK is not a thin wrapper — it is the canonical programmatic interface and **exposes Claude Code's full current state via runtime query methods** (`supportedModels`, `supportedCommands`, `supportedAgents`, `initializationResult`). This means our adapter does NOT need to mirror the model/command catalog ourselves; we ask Claude Code and pass through.

---

## 2. CLI subcommands

Full list from `code.claude.com/docs/en/cli-reference`. Subcommand here means "first positional after `claude`".

### Interactive entry
- `claude` — start interactive session
- `claude "query"` — interactive with initial prompt
- `claude -p "query"` — non-interactive (Agent SDK mode), exits after
- `cat file | claude -p "query"` — pipe input
- `claude -c` — continue most recent in cwd
- `claude -c -p "query"` — continue, non-interactive
- `claude -r "<session>" "query"` — resume by ID or name

### Lifecycle / installation
- `claude update`
- `claude install [version]` — `stable`, `latest`, or `2.1.118`
- `claude auth login [--email, --sso, --console]`
- `claude auth logout`
- `claude auth status [--text]`
- `claude setup-token` — long-lived OAuth token (sub required)

### Agent management (background sessions)
- `claude agents [--cwd, --json, --json --all, --permission-mode, --model, --effort, --agent, --settings, --add-dir, --plugin-dir, --mcp-config]`
- `claude attach <id>`
- `claude logs <id>`
- `claude respawn <id> [--all]`
- `claude rm <id>`
- `claude stop <id>` (alias `claude kill <id>`)

### Supervisor
- `claude daemon status`
- `claude daemon stop --any [--keep-workers]`

### Auto mode (research preview)
- `claude auto-mode defaults` → JSON of built-in classifier rules
- `claude auto-mode config` → effective config with settings applied

### Other commands
- `claude mcp` — MCP server config
- `claude plugin` (alias `claude plugins`) — plugin install/manage
- `claude project purge [path] [--dry-run, -y/--yes, -i, --all]`
- `claude remote-control [name]` — Remote Control server
- `claude ultrareview [target] [--json, --timeout]`

---

## 3. CLI flags (complete list)

From `code.claude.com/docs/en/cli-reference`. Bare flag name, then notes only when behavior is non-obvious.

| Flag | Notes |
|---|---|
| `--add-dir <dirs...>` | Grant file access; not config discovery |
| `--advisor <model>` | Server-side advisor tool. Accepts alias (`opus`, `sonnet`, `fable`) or full ID. v2.1.98+ |
| `--agent <name>` | Override `agent` setting |
| `--agents <json>` | Define dynamic subagents inline |
| `--allow-dangerously-skip-permissions` | Adds `bypassPermissions` to Shift+Tab cycle |
| `--allowedTools`, `--allowed-tools <patterns...>` | Permission rule syntax |
| `--append-system-prompt <text>` | Append to default system prompt |
| `--append-system-prompt-file <path>` | Same, from file |
| `--bare` | Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, CLAUDE.md auto-discovery. Sets `CLAUDE_CODE_SIMPLE=1`. |
| `--betas <names...>` | API beta headers |
| `--bg "task"` | Background agent |
| `--channels <plugin:name@marketplace ...>` | Research preview |
| `--chrome` / `--no-chrome` | Browser integration |
| `--continue`, `-c` | Latest session in cwd |
| `--dangerously-load-development-channels <entries>` | Local channel development |
| `--dangerously-skip-permissions` | = `--permission-mode bypassPermissions` |
| `--debug [filter]` | Categories like `"api,hooks"` or `"!1p,!file"` |
| `--debug-file <path>` | Implicit `--debug` |
| `--disable-slash-commands` | Disable all skills/commands |
| `--disallowedTools`, `--disallowed-tools <patterns...>` | Bare name removes tool from context |
| `--effort <level>` | `low \| medium \| high \| xhigh \| max` |
| `--exclude-dynamic-system-prompt-sections` | Cache-friendly multi-user |
| `--exec <cmd>` | With `--bg` runs cmd as PTY background job |
| `--fallback-model <comma-list>` | Chain |
| `--fork-session` | With `--resume`/`--continue`: new session ID |
| `--from-pr <number\|url>` | Resume PR-linked session |
| `--ide` | Auto-connect IDE if exactly one |
| `--init` | Setup hooks with `init` matcher (print mode) |
| `--init-only` | Run setup + SessionStart hooks, exit |
| `--include-hook-events` | Stream-json only |
| `--include-partial-messages` | Streaming partials |
| `--input-format <text\|stream-json>` | Print mode input |
| `--json-schema <schema>` | Structured output (print mode) |
| `--maintenance` | Setup hooks with `maintenance` matcher (print mode) |
| `--max-budget-usd <usd>` | Print mode |
| `--max-turns <n>` | Print mode |
| `--mcp-config <json-paths>` | Load MCP server defs |
| `--model <alias\|full>` | `opus`, `sonnet`, `haiku`, `fable`, or full ID like `claude-sonnet-4-6` |
| `--name`, `-n <name>` | Display name |
| `--no-session-persistence` | Print mode |
| `--output-format <text\|json\|stream-json>` | Print mode |
| `--permission-mode <mode>` | Six modes; see §5 |
| `--permission-prompt-tool <mcp-tool>` | Non-interactive permission MCP tool |
| `--plugin-dir <path>` / `--plugin-url <url>` | Repeatable |
| `--print`, `-p [query]` | Non-interactive (Agent SDK semantics) |
| `--prompt-suggestions` | Emits `prompt_suggestion` after each turn |
| `--remote "task"` | Create web session on claude.ai |
| `--remote-control`, `--rc [name]` | Interactive with Remote Control |
| `--remote-control-session-name-prefix <prefix>` | |
| `--replay-user-messages` | Re-emit user messages on stdout |
| `--resume`, `-r [session]` | ID, name, or interactive picker |
| `--safe-mode` | v2.1.169+. All customizations disabled. |
| `--session-id <uuid>` | Must be valid UUID |
| `--setting-sources <list>` | `user,project,local` |
| `--settings <path\|json>` | Inline overrides |
| `--strict-mcp-config` | Only use `--mcp-config` servers |
| `--system-prompt <text>` | Replace default |
| `--system-prompt-file <path>` | Replace from file |
| `--teleport` | Resume web session locally |
| `--teammate-mode <auto\|in-process\|tmux>` | Agent team display |
| `--tmux [=classic]` | With `--worktree` |
| `--tools <list>` | Restrict built-in tools (`""`, `"default"`, or names) |
| `--verbose` | Full turn-by-turn |
| `--version`, `-v` | |
| `--worktree`, `-w [name\|#PR\|PR-url]` | Isolated git worktree |

---

## 4. Models (complete list, current + legacy)

From `platform.claude.com/docs/en/about-claude/models/overview`.

### Current general availability

| Model | API ID | Alias | Context | Max output | Adaptive thinking | Extended thinking | Pricing in / out (MTok) |
|---|---|---|---|---|---|---|---|
| Claude Fable 5 | `claude-fable-5` | `fable` | 1M | 128k | Yes (always) | No | $10 / $50 |
| Claude Opus 4.8 | `claude-opus-4-8` | `opus-4-8` / `opus` (latest) | 1M | 128k | Yes | No | $5 / $25 |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | `sonnet-4-6` / `sonnet` (latest) | 1M | 64k | Yes | Yes | $3 / $15 |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5` / `haiku` | 200k | 64k | No | Yes | $1 / $5 |

### Limited availability

| Model | API ID | Notes |
|---|---|---|
| Claude Mythos 5 | `claude-mythos-5` | Project Glasswing, invitation-only |
| Claude Mythos Preview | `claude-mythos-preview` | Defensive cybersecurity research preview |

### Legacy (still callable)

| Model | API ID | Pricing in / out |
|---|---|---|
| Claude Opus 4.7 | `claude-opus-4-7` | $5 / $25 |
| Claude Opus 4.6 | `claude-opus-4-6` | $5 / $25 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | $3 / $15 |
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | $5 / $25 |
| Claude Opus 4.1 (deprecated, retires 2026-08-05) | `claude-opus-4-1-20250805` | $15 / $75 |
| Claude Sonnet 4 (deprecated, retires 2026-06-15) | `claude-sonnet-4-20250514` | $3 / $15 |
| Claude Opus 4 (deprecated, retires 2026-06-15) | `claude-opus-4-20250514` | $15 / $75 |

### Alias convention

- `opus` → latest Opus (currently 4.8)
- `sonnet` → latest Sonnet (currently 4.6)
- `haiku` → latest Haiku (currently 4.5)
- `fable` → latest Fable (currently 5)
- Pre-4.6 aliases (`claude-sonnet-4-0`, `claude-opus-4-0`, etc.) resolved to dated IDs. **Starting with 4.6, IDs are dateless but still pinned snapshots** — not evergreen.

### Auto mode model requirements

- Anthropic API: Opus 4.6+ or Sonnet 4.6
- Bedrock / Vertex / Foundry: ONLY Opus 4.7 and Opus 4.8 (and `CLAUDE_CODE_ENABLE_AUTO_MODE=1`)
- Unsupported on any provider: Sonnet 4.5, Opus 4.5, Haiku family, claude-3 family

---

## 5. Permission modes (6 total)

From `code.claude.com/docs/en/permission-modes`.

| Mode | What runs without asking |
|---|---|
| `default` | Reads only |
| `acceptEdits` | Reads + file edits + common filesystem Bash (mkdir, touch, rm, rmdir, mv, cp, sed) + PowerShell equivalents |
| `plan` | Reads only — explicitly no edits, full session in planning |
| `auto` | Everything, with background classifier blocking external/escalating/manipulative actions |
| `dontAsk` | Only pre-approved tools — denies everything else (CI/locked-down) |
| `bypassPermissions` | Everything (isolated VMs only — refuses root/sudo) |

**Protected paths** (writes never auto-approved except in `bypassPermissions`):
- Directories: `.git`, `.config/git`, `.vscode`, `.idea`, `.husky`, `.cargo`, `.devcontainer`, `.yarn`, `.mvn`, `.claude` (except `.claude/worktrees`)
- Files: `.gitconfig`, `.gitmodules`, all `.bash*`/`.zsh*` shell rc, `.envrc`, `.npmrc`, `.yarnrc`/`.yarnrc.yml`, `.pnp.cjs`, `.pnp.loader.mjs`, `.pnpmfile.cjs`, `bunfig.toml`, `.bunfig.toml`, `.bazel*`, `.pre-commit-config.yaml`, `lefthook.yml`/`.lefthook.yml`, `gradle-wrapper.properties`, `maven-wrapper.properties`, `.devcontainer.json`, `.ripgreprc`, `pyrightconfig.json`, `.mcp.json`, `.claude.json`

**Shift+Tab cycle** (default → acceptEdits → plan, with optional auto/bypassPermissions slotted in).

### Auto mode classifier

- Runs a separate model on each action.
- Blocked by default: code exec from internet (`curl | bash`), exfiltration, prod deploys/migrations, mass cloud deletes, IAM/repo grants, shared infra mods, irreversible file destruction, force-push, push to main.
- Allowed by default: local FS ops in cwd, declared-dependency installs, `.env` read + matching API send, read-only HTTP, push to current branch.
- Boundaries stated in chat ("don't push") become block signals; not stored persistently — re-read from transcript each check.
- Fallback: 3 consecutive blocks OR 20 total blocks → auto mode pauses, prompts return. In `-p` mode, aborts.
- Classifier sees user messages + tool calls + CLAUDE.md. Tool results are stripped. Server-side probe scans incoming results.
- Subagent: spawn-time check, per-action check, return-time check.

### Settings keys for permissions

```json
{
  "permissions": {
    "defaultMode": "default | acceptEdits | plan | auto | dontAsk | bypassPermissions",
    "allow": ["Bash(git log *)", "Read"],
    "deny": ["Bash(rm -rf *)", "Edit"],
    "ask": ["WebFetch(*)"],
    "additionalDirectories": ["../apps"],
    "disableAutoMode": "disable",
    "disableBypassPermissionsMode": "disable"
  }
}
```

`defaultMode: "auto"` from `.claude/settings.json` or `.claude/settings.local.json` is **ignored** (v2.1.142+). Only `~/.claude/settings.json` honored.

---

## 6. Hook events

From `code.claude.com/docs/en/hooks` (full doc not yet fetched in this pass — names from cross-references):

`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd`, `Notification`, `InstructionsLoaded`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `Elicitation`, `ElicitationResult`, `PermissionRequest`, `PermissionDenied`, `CwdChanged`, `FileChanged`, `TaskCreated`, `TeammateIdle`, `TaskCompleted`

**Setup hook matchers** (CLI: `--init`, `--maintenance`, `--init-only`): `init`, `maintenance`.

**TODO:** fetch `hooks.md` to confirm complete list and payload schemas. (Critical for opencode-side `permission` and `question` routes.)

---

## 7. Slash commands (complete user-facing list)

From community cheat sheet, cross-checked against `code.claude.com/docs/en/commands` index (not yet exhaustively fetched):

`/init`, `/compact`, `/context`, `/usage`, `/cost`, `/model`, `/fast`, `/effort`, `/status`, `/permissions`, `/config`, `/mcp`, `/hooks`, `/memory`, `/copy`, `/resume`, `/rename`, `/branch`, `/clear`, `/plan`, `/powerup`, `/voice`, `/loop`, `/rewind`, `/export`, `/add-dir`, `/agents`, `/goal`, `/skills`, `/bashes`, `/tasks`, `/theme`, `/color`, `/code-review`, `/batch`, `/security-review`, `/claude-api`, `/doctor`, `/bug`, `/release-notes`, `/buddy`, `/login`, `/logout`

**Prefixes** (not slash, also user-facing):
- `#` — persistent memory
- `/` — slash command
- `!` — bash command
- `@` — file reference
- `&` — cloud task

**Skills** — discoverable via `/<skill-name>`; user-defined under `.claude/skills/*/SKILL.md`.

**TODO:** runtime list via `Query.supportedCommands()` is the authoritative source. Stop maintaining this list manually.

---

## 8. Environment variables

Categorized.

### Auth & provider
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_MODEL`, `ANTHROPIC_BEDROCK_SERVICE_TIER`, `ANTHROPIC_WORKSPACE_ID`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`

### Model behavior
`CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_WORKFLOWS`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `CLAUDE_CODE_DISABLE_1M_CONTEXT`, `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE`, `CLAUDE_CODE_ENABLE_AUTO_MODE`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`, `ENABLE_TOOL_SEARCH`

### Behavior toggles
`DISABLE_AUTOUPDATER`, `DISABLE_UPDATES`, `DISABLE_TELEMETRY`, `DISABLE_COST_WARNINGS`, `DISABLE_PROMPT_CACHING`, `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`, `CLAUDE_CODE_HIDE_CWD`, `CLAUDE_CODE_FORCE_SYNC_OUTPUT`, `CLAUDE_CODE_FORK_SUBAGENT`, `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, `CLAUDE_CODE_USE_POWERSHELL_TOOL`, `CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY`, `CLAUDE_CODE_SAFE_MODE`, `CLAUDE_CODE_SIMPLE` (set by `--bare`), `CLAUDE_CODE_SKIP_PROMPT_HISTORY`

### Timeouts
`BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`, `MCP_TIMEOUT`, `MCP_TOOL_TIMEOUT`

### Network
`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `CLAUDE_CODE_CLIENT_CERT`, `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX`

---

## 9. Agent SDK TypeScript surface

From `code.claude.com/docs/en/agent-sdk/typescript`.

### Top-level exports

```typescript
function query({ prompt, options }: { prompt: string | AsyncIterable<SDKUserMessage>; options?: Options }): Query;
function startup(params?: { options?: Options; initializeTimeoutMs?: number }): Promise<WarmQuery>;
function listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]>;
function getSessionMessages(sessionId, options?): Promise<SessionMessage[]>;
function getSessionInfo(sessionId, options?): Promise<SDKSessionInfo | undefined>;
function renameSession(sessionId, title, options?): Promise<void>;
function tagSession(sessionId, tag, options?): Promise<void>;
function resolveSettings(options?): Promise<ResolvedSettings>;
function tool(name, description, inputSchema, handler, extras?): SdkMcpToolDefinition;
function createSdkMcpServer(options): McpSdkServerConfigWithInstance;
```

### `Options` (the input contract — full surface of what you can configure)

```typescript
type Options = {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agent?: string;
  agents?: Record<string, AgentDefinition>;
  agentProgressSummaries?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  allowedTools?: string[];
  betas?: SdkBeta[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  debug?: boolean;
  debugFile?: string;
  disallowedTools?: string[];
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  enableFileCheckpointing?: boolean;
  env?: Record<string, string | undefined>;
  executable?: 'bun' | 'deno' | 'node';
  executableArgs?: string[];
  extraArgs?: Record<string, string | null>;
  fallbackModel?: string;
  forkSession?: boolean;
  forwardSubagentText?: boolean;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  loadTimeoutMs?: number;
  managedSettings?: Settings;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number; // Deprecated
  maxTurns?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  onElicitation?: (request, options) => Promise<ElicitationResult>;
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  permissionPromptToolName?: string;
  persistSession?: boolean;
  planModeInstructions?: string;
  plugins?: SdkPluginConfig[];
  promptSuggestions?: boolean;
  resume?: string;
  resumeSessionAt?: string;
  sandbox?: SandboxSettings;
  sessionId?: string;
  sessionStore?: SessionStore;
  sessionStoreFlush?: 'batched' | 'eager';
  settings?: string | Settings;
  settingSources?: SettingSource[];
  skills?: string[] | 'all';
  spawnClaudeCodeProcess?: (options) => SpawnedProcess;
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string; excludeDynamicSections?: boolean };
  taskBudget?: { total: number };
  thinking?: ThinkingConfig;
  title?: string;
  toolAliases?: Record<string, string>;
  toolConfig?: ToolConfig;
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
};

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto';
type SettingSource = 'user' | 'project' | 'local';
```

### `SDKMessage` union (the output contract — ~30 types)

```typescript
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKPluginInstallMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKTaskUpdatedMessage
  | SDKSessionStateChangedMessage
  | SDKCommandsChangedMessage
  | SDKNotificationMessage
  | SDKFilesPersistedEvent
  | SDKToolUseSummaryMessage
  | SDKMemoryRecallMessage
  | SDKRateLimitEvent
  | SDKElicitationCompleteMessage
  | SDKPermissionDeniedMessage
  | SDKPromptSuggestionMessage
  | SDKAPIRetryMessage
  | SDKMirrorErrorMessage;
```

#### Message field details — three load-bearing types

**`SDKAssistantMessage`** — Claude's textual + tool-use output, one per agent step.
```typescript
{ type: "assistant"; uuid: UUID; session_id: string; message: BetaMessage; parent_tool_use_id: string | null; error?: SDKAssistantMessageError; }
```

**`SDKUserMessage`** — user-side input (prompt) or tool result.
```typescript
{ type: "user"; uuid?: UUID; session_id?: string; message: MessageParam; parent_tool_use_id: string | null; isSynthetic?: boolean; shouldQuery?: boolean; tool_use_result?: unknown; origin?: SDKMessageOrigin; }
```

**`SDKResultMessage`** — final turn marker. Has success and error subtypes.
```typescript
// Success:
{ type: "result"; subtype: "success"; uuid; session_id; duration_ms; duration_api_ms; is_error: false;
  api_error_status?; num_turns; result: string; stop_reason; ttft_ms?; ttft_stream_ms?;
  total_cost_usd; usage; modelUsage; permission_denials; structured_output?;
  deferred_tool_use?; terminal_reason?; fast_mode_state?; origin?; }
// Errors:
{ type: "result"; subtype: "error_max_turns" | "error_during_execution" | "error_max_budget_usd" | "error_max_structured_output_retries";
  uuid; session_id; duration_ms; duration_api_ms; is_error: true; num_turns; stop_reason;
  total_cost_usd; usage; modelUsage; permission_denials; errors: string[];
  terminal_reason?; fast_mode_state?; origin?; }
```

### `Query` runtime interface — **CRITICAL for our universality requirement**

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId, options?): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  applyFlagSettings(settings): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;  // ✨
  supportedCommands(): Promise<SlashCommand[]>;                    // ✨
  supportedModels(): Promise<ModelInfo[]>;                          // ✨
  supportedAgents(): Promise<AgentInfo[]>;                          // ✨
  mcpServerStatus(): Promise<McpServerStatus[]>;                    // ✨
  accountInfo(): Promise<AccountInfo>;
  reconnectMcpServer(name): Promise<void>;
  toggleMcpServer(name, enabled): Promise<void>;
  setMcpServers(servers): Promise<McpSetServersResult>;
  streamInput(stream): Promise<void>;
  stopTask(taskId): Promise<void>;
  close(): void;
}

type SDKControlInitializeResponse = {
  commands: SlashCommand[];
  agents: AgentInfo[];
  output_style: string;
  available_output_styles: string[];
  models: ModelInfo[];
  account: AccountInfo;
  fast_mode_state?: 'off' | 'cooldown' | 'on';
};
```

`initializationResult()` is the single source of truth for "what does this Claude Code installation currently support". Every list our adapter exposes — models, commands, agents, output styles — should come from this method, not from us hand-maintaining tables.

### MCP server configuration

```typescript
type McpServerConfig =
  | McpStdioServerConfig    // { type?: 'stdio'; command; args?; env?; }
  | McpSSEServerConfig      // { type: 'sse'; url; headers?; }
  | McpHttpServerConfig     // { type: 'http'; url; headers?; }
  | McpSdkServerConfigWithInstance  // { type: 'sdk'; name; instance: McpServer; }
  | McpClaudeAIProxyServerConfig;   // { type: 'claudeai-proxy'; url; id; }
```

### Agent definition

```typescript
type AgentDefinition = {
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  prompt: string;
  model?: string;
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  initialPrompt?: string;
  maxTurns?: number;
  background?: boolean;
  memory?: 'user' | 'project' | 'local';
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | number;
  permissionMode?: PermissionMode;
  criticalSystemReminder_EXPERIMENTAL?: string;
};
```

### Built-in tools (the canonical list from the SDK overview)

`Read`, `Write`, `Edit`, `Bash`, `Monitor`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `AskUserQuestion`, `Agent` (for subagent invocation).

---

## 10. The universality principle (전역성 contract)

Anything that varies per Claude Code installation/version is queried at runtime via the Agent SDK. Anything that is part of the protocol contract (paths, envelope shapes) is stable across versions and can live in our code.

### Per-installation, query via SDK (DO NOT hardcode)

| What | SDK method | Updated when |
|---|---|---|
| Model list (current available) | `Query.supportedModels()` or `initializationResult().models` | Each query — reflects new releases automatically |
| Slash commands | `Query.supportedCommands()` or `initializationResult().commands` | When user installs/uninstalls skills, plugins |
| Agents (subagent registry) | `Query.supportedAgents()` or `initializationResult().agents` | When user defines/installs agents |
| Output styles | `initializationResult().available_output_styles` | When user adds styles |
| MCP servers | `Query.mcpServerStatus()` | When user configures MCP |
| Account / fast mode state | `Query.accountInfo()`, `initializationResult().fast_mode_state` | Real-time |

### Stable across versions (OK to encode)

- The six permission mode names (already in `PermissionMode` type)
- The five effort levels (`low | medium | high | xhigh | max`)
- The three output formats (`text | json | stream-json`)
- The setting source enum (`user | project | local`)
- The MCP transport types (`stdio | sse | http | sdk | claudeai-proxy`)
- The hook event names (relatively stable; new events appended)
- The `SDKMessage` union shape (versioned via SDK package version)

### Implementation rule for our adapter

> When OpenTUI asks "what providers do you have?" / "what models?" / "what agents?", we MUST answer by calling the Agent SDK and mapping its current response to opencode shape. We MUST NOT cache by hand or hardcode by name.

This is what makes our adapter survive Claude Code updates without recompilation.

---

## 11. Open TODOs (next research turn)

The catalog above is complete for the surfaces we've fetched. Remaining fetches before mapping work begins:

1. `code.claude.com/docs/en/hooks.md` — exhaustive hook event payload shapes (needed for opencode permission/question route mapping)
2. `code.claude.com/docs/en/skills.md` — skill manifest format (needed for `/skill` route)
3. `code.claude.com/docs/en/sub-agents.md` — agent frontmatter fields
4. `code.claude.com/docs/en/mcp.md` and `mcp-quickstart.md` — MCP config persistence
5. `code.claude.com/docs/en/settings.md` — full settings.json schema (needed because opencode `/config` is a passthrough surface)
6. `code.claude.com/docs/en/sessions.md` — session lifecycle semantics
7. `code.claude.com/docs/en/agent-view.md` — background-agent surface (needed for `claude agents` ↔ `/session` mapping)
8. `code.claude.com/docs/en/headless.md` — `-p` mode specifics
9. `code.claude.com/docs/en/auto-mode-config.md` — auto mode trust environment config
10. `code.claude.com/docs/en/env-vars.md` — env var canonical list with semantics

After these, the parallel `opencode-surface.md` catalog is the next deliverable.
