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

## 11. Hooks (complete reference — Round 2)

From `code.claude.com/docs/en/hooks` (full fetch).

### 11.1 Event list with matcher / block / transform capability

| Event | Matcher target | Can block | Can transform input | Can transform output |
|---|---|---|---|---|
| `SessionStart` | start mode (`startup`, `resume`, `clear`, `compact`) | No | — | adds `additionalContext` |
| `Setup` | trigger (`init`, `maintenance`) | No (exit 2 shows stderr) | — | adds `additionalContext` |
| `SessionEnd` | end reason (`clear`, `resume`, `logout`, `prompt_input_exit`) | No | — | — |
| `UserPromptSubmit` | none | Yes (`decision: "block"`) | — | — |
| `UserPromptExpansion` | command name | Yes | — | — |
| `PreToolUse` | tool name | Yes (`permissionDecision: "deny"`) | Yes (`updatedInput`) | — |
| `PostToolUse` | tool name | Yes | — | Yes (`updatedToolOutput`) |
| `PostToolUseFailure` | tool name | Yes | — | — |
| `PostToolBatch` | none | Yes | — | — |
| `PermissionRequest` | tool name | Yes (`behavior: "deny"`) | Yes (`updatedInput`) | — |
| `PermissionDenied` | tool name | No (already denied) | — | `retry: true` allows model retry |
| `Stop` | none | Yes | — | adds `additionalContext` |
| `StopFailure` | error type | No | — | — |
| `SubagentStart` | agent type | No | — | adds `additionalContext` |
| `SubagentStop` | agent type | Yes | — | adds `additionalContext` |
| `PreCompact` | trigger (`manual`, `auto`) | Yes | — | — |
| `PostCompact` | trigger | No | — | — |
| `InstructionsLoaded` | load reason (`session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`) | No | — | — |
| `ConfigChange` | source (`user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`) | Yes | — | — |
| `Notification` | type (`permission_prompt`, `auth_success`, `elicitation_dialog`) | No | — | — |
| `WorktreeCreate` | none | Yes (failure or missing path) | — | returns `worktreePath` |
| `WorktreeRemove` | none | No | — | — |
| `CwdChanged` | none | No | — | — |
| `FileChanged` | literal filenames (NOT regex), pipe-separated | No | — | — |
| `Elicitation` | MCP server name | Yes (`action: "decline" \| "cancel"`) | — | — |
| `ElicitationResult` | MCP server name | Yes | — | overrides `content` |
| `MessageDisplay` | none | No | — | `displayContent` (screen only, not transcript) |
| `TaskCreated` | none | No | — | — |
| `TaskCompleted` | none | No | — | — |
| `TeammateIdle` | none | No | — | — |

### 11.2 Common input/output fields (all events)

```jsonc
// Input (any event)
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "permission_mode": "default|plan|acceptEdits|auto|dontAsk|bypassPermissions",
  "effort": { "level": "low|medium|high|xhigh|max" },
  "hook_event_name": "string",
  "agent_id": "string (only in subagent context)",
  "agent_type": "string"
}

// Output (any event, top-level)
{
  "continue": true,            // false stops Claude entirely
  "stopReason": "string",      // shown when continue=false
  "suppressOutput": false,     // hides hook stdout from transcript
  "systemMessage": "string",   // warning to user
  "terminalSequence": "string" // OSC 0/1/2/9/99/777 or BEL
}
```

### 11.3 Selected event-specific shapes

(Full list saved verbatim in this turn's transcript; key ones below — they drive opencode `permission`/`question`/`message` route mapping.)

**PreToolUse output (decisions + transforms):**
```jsonc
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow | deny | ask | defer",
    "permissionDecisionReason": "string",
    "updatedInput": { /* replaces tool arguments */ },
    "additionalContext": "string"
  }
}
```

**PermissionRequest output (the ladder users hit in TUI):**
```jsonc
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow | deny",
      "updatedInput": { /* optional */ },
      "permissionRules": ["pattern string"]
    }
  }
}
```

**Elicitation (MCP-driven user input forms):**
```jsonc
// Input
{
  "request": {
    "type": "string (form field type)",
    "name": "string",
    "label": "string",
    "required": "boolean"
  }
}
// Output
{
  "hookSpecificOutput": {
    "action": "accept | decline | cancel",
    "content": { "field_name": "value" }
  }
}
```

### 11.4 Hook handler types (5)

| `type` | Fields | Notes |
|---|---|---|
| `command` | `command`, `args?`, `async?`, `asyncRewake?`, `shell?` | Args present = exec form (no shell tokenizing) |
| `http` | `url`, `headers?`, `allowedEnvVars?` | 2xx empty=success; 2xx+text=context; 2xx+JSON=parsed |
| `mcp_tool` | `server`, `tool`, `input` (supports `${...}` substitution) | — |
| `prompt` | `prompt` (with `$ARGUMENTS`), `model?` | Defaults to fast model |
| `agent` | `prompt`, `model?` | Spawns subagent; experimental |

Common across all: `if?`, `timeout?` (default 600s; 30s for UserPromptSubmit; 10s for MessageDisplay), `statusMessage?`, `once?` (skills only).

### 11.5 Settings.json shape for hooks

```jsonc
{
  "hooks": {
    "EventName": [
      {
        "matcher": "tool_name or pattern",
        "hooks": [
          { "type": "command", "command": "...", "args": [] },
          { "type": "http", "url": "...", "headers": {...}, "allowedEnvVars": [...] },
          { "type": "mcp_tool", "server": "...", "tool": "...", "input": {...} },
          { "type": "prompt", "prompt": "Is X safe? $ARGUMENTS" }
        ]
      }
    ]
  },
  "disableAllHooks": false
}
```

### 11.6 Path placeholders

- `${CLAUDE_PROJECT_DIR}` — project root
- `${CLAUDE_PLUGIN_ROOT}` — plugin install dir (changes on update)
- `${CLAUDE_PLUGIN_DATA}` — plugin persistent data (survives updates)
- All three also exported as env vars on spawned processes
- Bash hooks get `CLAUDE_ENV_FILE` to write `export …` lines that persist into subsequent Bash commands

### 11.7 Matcher syntax

- `"*"`, `""`, omitted → match all
- letters/digits/`_`/`|` only → exact string or `|`-separated list
- any other character → JavaScript regex
- MCP tools: `mcp__<server>__<tool>` (regex example `mcp__memory__.*`)
- `if` field on handlers uses permission-rule syntax; only evaluated on tool events

### 11.8 Exit codes & HTTP semantics

| Mechanism | Code | Behavior |
|---|---|---|
| Command exit | `0` | Stdout parsed as JSON for decisions |
| Command exit | `2` | Blocking error; stderr shown |
| Command exit | other | Non-blocking; stderr in debug log + first line in transcript |
| HTTP | `2xx` empty | Success |
| HTTP | `2xx` text | Success, context-added |
| HTTP | `2xx` JSON | Decision parsed |
| HTTP | other / timeout | Non-blocking |

---

## 12. Sessions & headless mode (Round 3)

From `sessions.md`, `agent-sdk/sessions.md`, `headless.md`, `agent-sdk/streaming-output.md`.

### 12.1 Storage model

- **Path:** `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
- `<encoded-cwd>` = absolute working directory, every non-alphanumeric → `-` (e.g., `/Users/me/proj` → `-Users-me-proj`)
- Override base with `CLAUDE_CONFIG_DIR` env var: `$CLAUDE_CONFIG_DIR/projects/<encoded-cwd>/*.jsonl`
- Each line = one JSON object (message, tool use, metadata)
- Default cleanup: 30 days (configurable via `cleanupPeriodDays`)
- Disable persistence: `CLAUDE_CODE_SKIP_PROMPT_HISTORY` env or `--no-session-persistence` flag

### 12.2 Resume / fork / continue (CLI + SDK parity)

| Concept | CLI | SDK (TypeScript) |
|---|---|---|
| Continue most recent in cwd | `claude --continue` or `-c` | `options.continue: true` |
| Resume by ID | `claude --resume <id>` | `options.resume: "<id>"` |
| Resume by name | `claude --resume <name>` | (CLI only) |
| Fork from resumed | `--fork-session` with `-r` / `-c` | `options.forkSession: true` |
| Resume from PR | `--from-pr <num\|url>` | (CLI only) |
| Suppress disk write | `--no-session-persistence` (print mode) | `options.persistSession: false` |
| Pin session ID | `--session-id <uuid>` | `options.sessionId: "<uuid>"` |

### 12.3 SDKSessionInfo (used by listSessions / getSessionInfo)

```typescript
type SDKSessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;       // ms epoch
  fileSize?: number;
  customTitle?: string;       // settable via renameSession()
  firstPrompt?: string;
  gitBranch?: string;
  cwd?: string;
  tag?: string;               // settable via tagSession()
  createdAt?: number;
};
```

### 12.4 Stream-json event reference (the canonical wire format for `-p --output-format stream-json`)

#### `system/init` (first event of the stream)

```jsonc
{
  "type": "system",
  "subtype": "init",
  "session_id": "uuid",
  "model": "claude-sonnet-4-6",
  "tools": ["Read", "Bash", ...],
  "mcp_servers": [...],
  "plugins": [{ "name": "...", "path": "..." }],
  "plugin_errors": [{ "plugin": "...", "type": "...", "message": "..." }]
}
```

#### `system/api_retry`

```jsonc
{
  "type": "system",
  "subtype": "api_retry",
  "attempt": 1,
  "max_retries": 5,
  "retry_delay_ms": 2000,
  "error_status": 503,
  "error": "rate_limit | authentication_failed | oauth_org_not_allowed | billing_error | overloaded | invalid_request | model_not_found | server_error | max_output_tokens | unknown",
  "uuid": "string",
  "session_id": "string"
}
```

#### `system/plugin_install` (only when `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` set)

```jsonc
{
  "type": "system",
  "subtype": "plugin_install",
  "status": "started | installed | failed | completed",
  "name": "marketplace-name",
  "error": "...",
  "uuid": "string",
  "session_id": "string"
}
```

#### `stream_event` (raw API streaming events, when `--include-partial-messages`)

```jsonc
{
  "type": "stream_event",
  "event": {
    "type": "message_start | content_block_start | content_block_delta | content_block_stop | message_delta | message_stop",
    "delta": {
      "type": "text_delta | input_json_delta",
      "text": "...",         // text_delta
      "partial_json": "..."  // input_json_delta
    },
    "content_block": {
      "type": "text | tool_use",
      "name": "Read",        // tool_use
      "id": "toolu_..."      // tool_use
    }
  },
  "parent_tool_use_id": "string | null",
  "uuid": "UUID",
  "session_id": "string",
  "ttft_ms": 320              // only on message_start
}
```

Message order with partial messages enabled:
```
stream_event(message_start)
stream_event(content_block_start) text
stream_event(content_block_delta) text_delta ×N
stream_event(content_block_stop)
stream_event(content_block_start) tool_use
stream_event(content_block_delta) input_json_delta ×N
stream_event(content_block_stop)
stream_event(message_delta)
stream_event(message_stop)
assistant                          // complete AssistantMessage
... tool executes ...
... next turn ...
result                             // final
```

### 12.5 Headless `-p` mode specifics

- `--bare` is the recommended mode for scripts (skips hooks/LSP/plugin sync/auto-memory/CLAUDE.md auto-discovery; sets `CLAUDE_CODE_SIMPLE=1`)
- In `--bare`, auth must be `ANTHROPIC_API_KEY` or `apiKeyHelper` via `--settings`; OAuth/keychain never read
- Background Bash tasks killed ~5s after final result
- Piped stdin capped at 10MB (v2.1.128+)
- Slash skills work in `-p` mode (e.g., `claude -p "/security-review"`). Interactive dialogs like `/config` and `/login` don't
- `--output-format json` payload includes `total_cost_usd` + per-model cost
- `--output-format stream-json` requires `--verbose` to expose partials with `--include-partial-messages`

---

## 13. Settings.json complete schema (Round 3)

From `code.claude.com/docs/en/settings`. ~75 top-level keys. Listed in scope/precedence groups.

### 13.1 Precedence (highest → lowest)

1. **Managed** (cannot be overridden) — at `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS), `/etc/claude-code/managed-settings.json` (Linux/WSL), `C:\Program Files\ClaudeCode\managed-settings.json` (Windows)
2. **CLI arguments**
3. **Local** — `.claude/settings.local.json` (gitignored)
4. **Project** — `.claude/settings.json` (committed)
5. **User** — `~/.claude/settings.json`

Permission rules MERGE across scopes instead of overriding.

### 13.2 Hot-reload vs restart-required

Hot-reload (no restart): `permissions`, `hooks`, credential helpers (`apiKeyHelper`, `awsCredentialExport`, etc). `ConfigChange` hook fires.

Restart-required: `model`, `outputStyle`.

### 13.3 Top-level keys (alphabetical, exhaustive)

```text
$schema, advisorModel, agent, agentPushNotifEnabled, allowAllClaudeAiMcps,
allowedChannelPlugins, allowedHttpHookUrls, allowedMcpServers,
allowManagedHooksOnly, allowManagedMcpServersOnly, allowManagedPermissionRulesOnly,
alwaysThinkingEnabled, apiKeyHelper, attribution, autoCompactEnabled,
autoMemoryDirectory, autoMemoryEnabled, autoMode, autoScrollEnabled,
autoUpdatesChannel, availableModels, awaySummaryEnabled, awsAuthRefresh,
awsCredentialExport, blockedMarketplaces, channelsEnabled, claudeMd,
claudeMdExcludes, cleanupPeriodDays, companyAnnouncements, defaultShell,
deniedMcpServers, disableAgentView, disableAllHooks, disableAutoMode,
disableBundledSkills, disableDeepLinkRegistration, disabledMcpjsonServers,
disableRemoteControl, disableSkillShellExecution, disableWorkflows, editorMode,
effortLevel, enableAllProjectMcpServers, enabledMcpjsonServers, env,
enforceAvailableModels, fallbackModel, fastModePerSessionOptIn,
feedbackSurveyRate, fileCheckpointingEnabled, fileSuggestion, footerLinksRegexes,
forceLoginMethod, forceLoginOrgUUID, forceRemoteSettingsRefresh,
gcpAuthRefresh, hooks, httpHookAllowedEnvVars, includeCoAuthoredBy,
includeGitInstructions, inputNeededNotifEnabled, language,
maxSkillDescriptionChars, minimumVersion, model, modelOverrides,
otelHeadersHelper, outputStyle, parentSettingsBehavior, permissions,
plansDirectory, pluginSuggestionMarketplaces, pluginTrustMessage, policyHelper,
preferredNotifChannel, prefersReducedMotion, prUrlTemplate, requiredMaximumVersion,
requiredMinimumVersion, respectGitignore, showClearContextOnPlanAccept,
showThinkingSummaries, showTurnDuration, skillListingBudgetFraction,
skillOverrides, spinnerTipsEnabled, strictKnownMarketplaces
```

### 13.4 Enum-bound keys

| Key | Allowed values | Default |
|---|---|---|
| `editorMode` | `normal` \| `vim` | `normal` |
| `defaultShell` | `bash` \| `powershell` | `bash` |
| `autoUpdatesChannel` | `stable` \| `latest` | `latest` |
| `preferredNotifChannel` | `auto` \| `terminal_bell` \| `iterm2` \| `iterm2_with_bell` \| `kitty` \| `ghostty` \| `notifications_disabled` | `auto` |
| `disableAutoMode` | `disable` | unset |
| `disableDeepLinkRegistration` | `disable` | unset |
| `forceLoginMethod` | `claudeai` \| `console` | unset |
| `parentSettingsBehavior` | `first-wins` \| `merge` | `first-wins` |
| `effortLevel` | `low` \| `medium` \| `high` \| `xhigh` | unset |
| `skillOverrides[*]` | `on` \| `name-only` \| `user-invocable-only` \| `off` | — |

### 13.5 Numeric

| Key | Min | Max | Default |
|---|---|---|---|
| `cleanupPeriodDays` | 1 | — | 30 |
| `feedbackSurveyRate` | 0 | 1 | — |
| `skillListingBudgetFraction` | 0 | 1 | 0.01 |
| `maxSkillDescriptionChars` | — | — | 1536 |

### 13.6 Selected sub-objects

```jsonc
// permissions
{
  "permissions": {
    "allow": ["Bash(npm run lint)", "Read(./src/**)"],
    "ask":   ["WebFetch(*)"],
    "deny":  ["Bash(rm -rf *)"]
  }
}

// autoMode (see §14 for full semantics)
{
  "autoMode": {
    "environment": ["$defaults", "prose..."],
    "allow":       ["$defaults", "prose..."],
    "soft_deny":   ["$defaults", "prose..."],
    "hard_deny":   ["$defaults", "prose..."]
  }
}

// fileSuggestion
{
  "fileSuggestion": { "type": "command", "command": "~/.claude/file-suggestion.sh" }
  // OR
  // { "type": "mcp", "serverName": "filesystem", "toolName": "search_files" }
}

// modelOverrides — alias-to-fullId override per provider
{
  "modelOverrides": { "claude-opus-4-6": "arn:aws:bedrock:..." }
}

// footerLinksRegexes — autolinkify ticket references
{
  "footerLinksRegexes": [{
    "type": "regex",
    "pattern": "\\b(?<key>PROJ-\\d+)\\b",
    "url": "https://issues.example.com/browse/{key}",
    "label": "{key}"
  }]
}

// attribution — commit / PR signatures Claude injects
{
  "attribution": { "commit": "🤖 Generated with Claude Code", "pr": "" }
}

// skillOverrides — per-skill on/off
{
  "skillOverrides": { "legacy-context": "name-only", "deploy": "off" }
}

// policyHelper — script that returns managed policy JSON
{
  "policyHelper": { "path": "/path/to/helper", "timeout": 5000 }
}
```

---

## 14. Auto mode classifier config (Round 3 detail)

From `auto-mode-config.md`.

### 14.1 Scope

| Scope | File | Use |
|---|---|---|
| Personal | `~/.claude/settings.json` | Personal trusted infra |
| Project-local | `.claude/settings.local.json` | Per-project trusted services |
| Managed | platform-specific path | Organization-wide |
| Inline | `--settings` JSON or SDK options | Per-invocation |
| **NOT** read from `.claude/settings.json` (shared/checked-in) — by design, repos can't grant themselves auto |

Per-scope `environment / allow / soft_deny / hard_deny` arrays MERGE; developers can extend but not delete managed entries. `allow` overrides matching `soft_deny` (additive), but never `hard_deny`.

### 14.2 Four arrays, four roles

```jsonc
{
  "autoMode": {
    "environment": [...],  // prose; what "internal/trusted" means
    "allow":       [...],  // exceptions to soft_deny (or explicit auto-approves)
    "soft_deny":   [...],  // blocks unless user intent or allow overrides
    "hard_deny":   [...]   // unconditional blocks; nothing overrides
  }
}
```

### 14.3 `$defaults` splice

Include literal string `"$defaults"` in any array to inherit built-in entries at that position. Omitting `$defaults` REPLACES the entire default list for that section — flagged as dangerous in docs.

### 14.4 Inspection CLI

```bash
claude auto-mode defaults   # built-in lists as JSON
claude auto-mode config     # effective config with merges + $defaults expanded
claude auto-mode critique   # AI feedback on custom rules
```

### 14.5 Decision order (matches §5.4 in the permission-modes doc)

```
1. Tool-pattern allow/deny rules in settings (permissions.{allow,deny,ask})
   → except writes to protected paths, which jump to classifier
2. Read-only ops + cwd file edits auto-approved (except protected paths)
3. Everything else → classifier
4. Inside classifier:
   - hard_deny: block, no overrides
   - soft_deny: block unless allow matches or explicit user intent
   - allow: override soft_deny
   - User explicit intent (specific phrasing): override remaining soft blocks
```

### 14.6 Boundaries from conversation

User's chat boundaries ("don't push", "wait until review") become block signals; re-read from transcript on each check; lost on compaction. For hard guarantees, use `permissions.deny`.

### 14.7 Fallback

- 3 consecutive blocks OR 20 total blocks → auto mode pauses, returns to prompting mode
- Approving the prompted action resumes auto mode
- In `-p` mode (non-interactive), repeated blocks abort
- Per-action denial recorded in `/permissions` → `Recently denied` → press `r` to retry with manual approval
- Programmatic reaction via `PermissionDenied` hook (§11.1)

---

## 15. Environment variables — exhaustive table (Round 3)

From `env-vars.md`. Categorized; ~150 variables.

### 15.1 Auth / API

```
ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_WORKSPACE_ID,
ANTHROPIC_CUSTOM_HEADERS, ANTHROPIC_BETAS,
ANTHROPIC_BASE_URL,    // override endpoint
API_TIMEOUT_MS = 600000 (10 min),
API_FORCE_IDLE_TIMEOUT  // 0|1
```

### 15.2 Cloud providers

```
# AWS
ANTHROPIC_AWS_API_KEY, ANTHROPIC_AWS_BASE_URL, ANTHROPIC_AWS_WORKSPACE_ID,
ANTHROPIC_BEDROCK_BASE_URL, ANTHROPIC_BEDROCK_MANTLE_BASE_URL,
ANTHROPIC_BEDROCK_SERVICE_TIER ∈ {default, flex, priority},
AWS_BEARER_TOKEN_BEDROCK, ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION,
CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_USE_ANTHROPIC_AWS

# GCP / Vertex
ANTHROPIC_VERTEX_BASE_URL, ANTHROPIC_VERTEX_PROJECT_ID,
CLAUDE_CODE_USE_VERTEX

# Azure / Foundry
ANTHROPIC_FOUNDRY_API_KEY, ANTHROPIC_FOUNDRY_BASE_URL, ANTHROPIC_FOUNDRY_RESOURCE,
CLAUDE_CODE_USE_FOUNDRY
```

### 15.3 Model selection / display

```
ANTHROPIC_MODEL,                              # primary
ANTHROPIC_DEFAULT_{SONNET,OPUS,HAIKU,FABLE}_MODEL,
ANTHROPIC_DEFAULT_{...}_MODEL_{NAME,DESCRIPTION,SUPPORTED_CAPABILITIES},
ANTHROPIC_CUSTOM_MODEL_OPTION,
ANTHROPIC_CUSTOM_MODEL_OPTION_{NAME,DESCRIPTION,SUPPORTED_CAPABILITIES},
ANTHROPIC_SMALL_FAST_MODEL                    # DEPRECATED
```

### 15.4 Thinking / effort

```
MAX_THINKING_TOKENS,
CLAUDE_CODE_DISABLE_THINKING,           # 0|1
CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING,  # 0|1 (Opus 4.6/Sonnet 4.6)
CLAUDE_CODE_EFFORT_LEVEL ∈ {low,medium,high,xhigh,max,auto},
CLAUDE_CODE_ALWAYS_ENABLE_EFFORT        # 0|1
```

### 15.5 Tool & bash

```
BASH_DEFAULT_TIMEOUT_MS = 120000 (2 min),
BASH_MAX_TIMEOUT_MS     = 600000 (10 min),
BASH_MAX_OUTPUT_LENGTH,
CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR,  # 0|1
ENABLE_TOOL_SEARCH,                         # true|false (off for custom base URLs)
CLAUDE_CODE_DISABLE_ATTACHMENTS             # 0|1
```

### 15.6 TLS & security

```
CLAUDE_CODE_CERT_STORE = "bundled,system",
CLAUDE_CODE_CLIENT_CERT, CLAUDE_CODE_CLIENT_KEY, CLAUDE_CODE_CLIENT_KEY_PASSPHRASE
```

### 15.7 Feature toggles

```
CLAUDE_CODE_DISABLE_{AUTO_MEMORY,CLAUDE_MDS,FILE_CHECKPOINTING,GIT_INSTRUCTIONS,
                     FAST_MODE,WORKFLOWS,BUNDLED_SKILLS,ADVISOR_TOOL,
                     1M_CONTEXT,AGENT_VIEW,BACKGROUND_TASKS,CRON,
                     POLICY_SKILLS,OFFICIAL_MARKETPLACE_AUTOINSTALL,
                     NONESSENTIAL_TRAFFIC,EXPERIMENTAL_BETAS,
                     LEGACY_MODEL_REMAP,NONSTREAMING_FALLBACK,
                     TERMINAL_TITLE,ALTERNATE_SCREEN,MOUSE,VIRTUAL_SCROLL},
CLAUDE_CODE_ENABLE_{GATEWAY_MODEL_DISCOVERY,AUTO_MODE,FINE_GRAINED_TOOL_STREAMING,
                    AWAY_SUMMARY,BACKGROUND_PLUGIN_REFRESH},
CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT,
CLAUDE_CODE_NO_FLICKER,
CLAUDE_CODE_ACCESSIBILITY,
CLAUDE_CODE_ATTRIBUTION_HEADER,
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD,
CLAUDE_AUTO_BACKGROUND_TASKS,
CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS,
CLAUDE_AGENT_SDK_MCP_NO_PREFIX
```

### 15.8 Context / compaction

```
CLAUDE_CODE_AUTO_COMPACT_WINDOW   # tokens
CLAUDE_AUTOCOMPACT_PCT_OVERRIDE   # 1–100
```

### 15.9 Debug / log

```
CLAUDE_CODE_DEBUG_LOGS_DIR = ~/.claude/debug/<session-id>.txt,
CLAUDE_CODE_DEBUG_LOG_LEVEL ∈ {verbose,debug,info,warn,error} = "debug",
DEBUG = 0|1                       # matches --debug
```

### 15.10 Telemetry / surveys

```
DISABLE_TELEMETRY, DISABLE_AUTOUPDATER, DISABLE_FEEDBACK_COMMAND,
DISABLE_ERROR_REPORTING, DO_NOT_TRACK,
CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY,
CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL
```

### 15.11 Subprocess detection

```
CLAUDECODE = 0|1                       # set by Claude Code in subprocesses
CLAUDE_CODE_CHILD_SESSION = 0|1        # v2.1.172+; tool subprocesses
CLAUDE_CODE_FORCE_SESSION_PERSISTENCE  # override nested-session exclusion
CCR_FORCE_BUNDLE                       # 0|1, force bundle local repo
CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS = 600000
CLAUDE_CODE_API_KEY_HELPER_TTL_MS
```

### 15.12 Network

```
HTTP_PROXY, HTTPS_PROXY, NO_PROXY
```

### 15.13 Background sync flags

```
CLAUDE_CODE_SYNC_PLUGIN_INSTALL   # emits system/plugin_install events
```

### 15.14 Operating mode flags

```
CLAUDE_CODE_SIMPLE = 1  # set by --bare
CLAUDE_CODE_SAFE_MODE   # --safe-mode
CLAUDE_CODE_HIDE_CWD    # privacy
CLAUDE_CODE_FORK_SUBAGENT
CLAUDE_CODE_FORCE_SYNC_OUTPUT
CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE
CLAUDE_CODE_PLUGIN_PREFER_HTTPS
CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE
CLAUDE_CODE_STOP_HOOK_BLOCK_CAP
CLAUDE_CODE_USE_POWERSHELL_TOOL
CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY
CLAUDE_CODE_SKIP_PROMPT_HISTORY
CLAUDE_CONFIG_DIR  # override ~/.claude as session store base
CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX
```

### 15.15 Precedence

Env > settings file. CLI flags > env (for `--model`, `--debug`, etc). In-session commands win over both for most features. Exception: `CLAUDE_CODE_EFFORT_LEVEL` overrides `/effort`.

---

## 16. Files saved to disk for future rounds

These doc fetches exceeded inline output and are saved verbatim under
`~/.claude/projects/.../tool-results/` from the current session — to be
folded into §17 (skills), §18 (sub-agents), §19 (agent-view), §20 (mcp):

- `toolu_012r2SXNK3CkwxX6trDWAbyh.txt` — `skills.md` (53.2 KB)
- `toolu_01WfRfn1fo7AWLbgnfX2weeG.txt` — `sub-agents.md` (66.8 KB)
- `toolu_015PixAvAopKdWqNPugaczEJ.txt` — `agent-view.md` (55.4 KB)
- `toolu_013Ga3ECTRqco1ULQ6xpqZ4H.txt` — `mcp.md` (49.7 KB)

Next research turn folds these in. The structural decisions (universality via SDK `supportedX()` methods) are already locked in §10 and §12, so the catalog is usable as-is for opencode-side mapping work.

---

## 17. Status / next

**Claude Code surface — sufficient coverage for mapping work to begin.** Remaining Claude Code docs (skills/sub-agents/agent-view/mcp full bodies + headless edge cases) refine but don't change the architectural conclusion in §10.

**Next deliverable:** `docs/research/opencode-surface.md` — same depth, derived from sst/opencode source (18 server route groups in `packages/server/src/groups`, SDK v2 types in `packages/sdk/js/src/v2/gen`, TUI sync/data context).

Then `docs/research/mapping.md` — the per-route, per-event 1:1 correspondence.
