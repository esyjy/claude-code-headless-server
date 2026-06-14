// OpenCode bare-path routes — Step 7.2 of phase-7
//
// OpenTUI / `opencode attach` calls bare paths (/agent, /config, ...).
// These differ in path AND response shape from the wrapped /api/* surface
// the upstream's opencode-compat.ts exposes. See docs/opencode-protocol.md
// for measured shapes.
//
// This module mounts the discovery surface the TUI's first ~10 requests
// hit on attach. Reach far enough that attach gets past discovery and
// renders the TUI shell. Real event content + interactive flow are
// Step 7.3+ scope.

import { Hono } from "hono";
import * as path from "node:path";
import * as os from "node:os";

const PKG_VERSION = "0.7.0-dev";

function projectIDFromCwd(cwd: string): string {
  // opencode uses a sha-style hash of the worktree path. We emit a
  // deterministic-ish 40-hex string so the TUI can index by it.
  // Real implementation can switch to git rev-parse or sha1.
  let h = 0n;
  for (const ch of cwd) h = ((h << 5n) - h + BigInt(ch.charCodeAt(0))) & 0xffffffffffffffffn;
  return h.toString(16).padStart(40, "0").slice(0, 40);
}

function nowMs(): number {
  return Date.now();
}

// --- GET /config ---
// Minimal config shape opencode accepts. We expose our own backend identity;
// user's local opencode.json is read by opencode client-side and merged
// independently, so passing it through here is neither needed nor safe.
const configRoute = new Hono().get("/config", (c) => {
  return c.json({
    $schema: "https://opencode.ai/config.json",
    command: {},
    model: "claude-code/sonnet",
    username: os.userInfo().username,
    mode: {},
    agent: {},
    // Empty plugin list — we don't execute opencode plugins server-side.
    plugin: [],
  });
});

// --- GET /agent ---
// Single agent backed by Claude Code. permission[] is the surface
// automode lives on (Step 7.4 will add a "auto" variant).
const agentRoute = new Hono().get("/agent", (c) => {
  return c.json([
    {
      name: "claude-code",
      description: "Claude Code backend via claude --resume.",
      mode: "primary",
      native: true,
      permission: [
        { permission: "*", pattern: "*", action: "allow" },
        { permission: "doom_loop", pattern: "*", action: "ask" },
        { permission: "external_directory", pattern: "*", action: "ask" },
      ],
    },
  ]);
});

// --- GET /provider ---
// TUI uses this surface for model picker. Models hang off providers.
// `default` is a MAP { providerID: defaultModelID }, NOT a string —
// TUI iterates `all` and looks up `default[provider.id]` per provider.
// Mis-shape causes `TypeError: undefined is not an object (evaluating
// 'provider_default[q.id]')` in the TUI's provider component.
const providerRoute = new Hono().get("/provider", (c) => {
  return c.json({
    all: [
      {
        id: "anthropic",
        name: "Anthropic",
        source: "claude-code",
        env: [],
        options: {},
        models: {
          "claude-sonnet-4-5": {
            id: "claude-sonnet-4-5",
            providerID: "anthropic",
            api: { id: "claude-sonnet-4-5", url: "", npm: "" },
            name: "Claude Sonnet 4.5",
            family: "claude-sonnet",
            capabilities: {
              temperature: true,
              reasoning: true,
              attachment: true,
              toolcall: true,
              input: { text: true, audio: false, image: true, video: false, pdf: true },
              output: { text: true, audio: false, image: false, video: false, pdf: false },
            },
          },
          "claude-opus-4-1": {
            id: "claude-opus-4-1",
            providerID: "anthropic",
            api: { id: "claude-opus-4-1", url: "", npm: "" },
            name: "Claude Opus 4.1",
            family: "claude-opus",
            capabilities: {
              temperature: true,
              reasoning: true,
              attachment: true,
              toolcall: true,
              input: { text: true, audio: false, image: true, video: false, pdf: true },
              output: { text: true, audio: false, image: false, video: false, pdf: false },
            },
          },
        },
      },
    ],
    default: { anthropic: "claude-sonnet-4-5" },
    connected: ["anthropic"],
  });
});

// --- GET /config/providers ---
// Same data as /provider but a different envelope. TUI's sync store sets:
//   provider          = providers      (array)
//   provider_default  = default        (map { providerID: defaultModelID })
// from THIS response (sst/opencode packages/tui/src/context/sync.tsx:476).
// Missing `default` here is what crashes the TUI's provider component
// with `provider_default[q.id]` undefined. Keys intentionally omitted —
// claude CLI authenticates separately, no key needed.
const configProvidersRoute = new Hono().get("/config/providers", (c) => {
  return c.json({
    providers: [
      {
        id: "anthropic",
        name: "Anthropic",
        source: "claude-code",
        env: [],
        options: {},
        models: {
          "claude-sonnet-4-5": {
            id: "claude-sonnet-4-5",
            providerID: "anthropic",
            api: { id: "claude-sonnet-4-5", url: "", npm: "" },
            name: "Claude Sonnet 4.5",
            family: "claude-sonnet",
            capabilities: {
              temperature: true,
              reasoning: true,
              attachment: true,
              toolcall: true,
              input: { text: true, image: true, pdf: true },
              output: { text: true },
            },
          },
        },
      },
    ],
    default: { anthropic: "claude-sonnet-4-5" },
  });
});

// --- GET /experimental/console ---
const experimentalConsoleRoute = new Hono().get("/experimental/console", (c) => {
  return c.json({ consoleManagedProviders: [], switchableOrgCount: 0 });
});

// --- GET /project/current ---
const projectCurrentRoute = new Hono().get("/project/current", (c) => {
  const cwd = process.cwd();
  return c.json({
    id: projectIDFromCwd(cwd),
    worktree: cwd,
    vcs: "git",
    time: { created: nowMs(), updated: nowMs() },
    sandboxes: [],
  });
});

// --- GET /path ---
const pathRoute = new Hono().get("/path", (c) => {
  const home = os.homedir();
  const cwd = process.cwd();
  return c.json({
    home,
    state: path.join(home, ".local", "state", "claude-headless-server"),
    config: path.join(home, ".config", "claude-headless-server"),
    worktree: cwd,
    directory: cwd,
  });
});

// --- GET /command ---
const commandRoute = new Hono().get("/command", (c) => c.json([]));

// --- GET /skill ---
const skillRoute = new Hono().get("/skill", (c) => c.json([]));

// --- GET /global/event (SSE) ---
// Three-layer envelope per docs/opencode-protocol.md §Events. For Step 7.2
// we emit only `server.connected` so attach completes its discovery handshake.
// Step 7.3 wires the real event taxonomy (session.created, message.*,
// tool.use.*, etc.) inside this same envelope.
const encoder = new TextEncoder();
function evtID(): string {
  return "evt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const globalEventRoute = new Hono().get("/global/event", (c) => {
  const stream = new ReadableStream({
    start(ctrl) {
      const connected = JSON.stringify({
        payload: { id: evtID(), type: "server.connected", properties: {} },
      });
      ctrl.enqueue(encoder.encode("data: " + connected + "\n\n"));

      const keepAlive = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

// --- Exports ---
export const opencodeBareRoutes = new Hono()
  .route("/", configRoute)
  .route("/", agentRoute)
  .route("/", providerRoute)
  .route("/", configProvidersRoute)
  .route("/", experimentalConsoleRoute)
  .route("/", projectCurrentRoute)
  .route("/", pathRoute)
  .route("/", commandRoute)
  .route("/", skillRoute)
  .route("/", globalEventRoute);
