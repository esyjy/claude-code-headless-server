# ADR 0011 — `127.0.0.1` default binding, opt-in external exposure

**Status:** Accepted (2026-06-15)

## Context

`Bun.serve({ port })` without an explicit `hostname` defaults to
`0.0.0.0`, exposing the server to every interface on the host — including
the local network. The server's `bypassPermissions` mode (mapped from
OpenTUI's `yolo`, see ADR 0002) auto-approves arbitrary tool execution.
Combined, the upstream default meant any device on the same LAN could
issue prompts that execute code on the maintainer's machine, with no
authentication required when the `tui` flow wasn't used.

Basic Auth (ADR 0009) provides a defense, but is only active when a
password is configured — typically by running `claude-headless-server
tui` first. A plain `claude-headless-server start` skips Basic Auth and,
under the upstream default, opens 4096 to the LAN.

This phase's goal is "safe install on the maintainer's macbook." Plain
`start` must not expose the server outside the host.

## Decision

### Sub-decision A — Default `hostname` to `127.0.0.1`

`src/index.ts` reads `process.env.CLAUDE_SERVER_HOST` and falls back to
`"127.0.0.1"`. This is passed to `Bun.serve({ hostname })`.

A local-only bind is the unambiguous secure default. External use cases
(running on a homelab box, sharing across a known-trust LAN) require
explicit operator action.

### Sub-decision B — `CLAUDE_SERVER_HOST` is the only opt-in path

The maintainer expands exposure by setting `CLAUDE_SERVER_HOST` in the
environment — e.g. `CLAUDE_SERVER_HOST=0.0.0.0` for all interfaces, or
`CLAUDE_SERVER_HOST=10.0.0.5` for a specific NIC. No CLI flag, no
config file, no implicit "if Basic Auth is on, auto-expose."

The principle: one knob, one effect. Adding both an env var and a flag
would fragment the surface (principle 10 — compact control surface).

### Sub-decision C — Wrapper script `start` does not auto-set the env

`scripts/claude-headless-server.sh start` does not read or set
`CLAUDE_SERVER_HOST`. If the operator wants external bind, they set it
in the parent shell or in a launchd / systemd unit. The wrapper stays
intentionally thin.

## Consequences

- **Internal seam**: `process.env.CLAUDE_SERVER_HOST` is now part of the
  public env contract. Future runtime swap (Bun → Node, etc.) must
  preserve the same env var.
- **User-facing surface change**: one new env var (`CLAUDE_SERVER_HOST`).
  README install section gains a one-paragraph "Exposing to LAN" note
  pointing at this ADR.
- **CI / lint rule**: a verification step in CI greps `src/**.ts` for
  un-pinned `Bun.serve(` calls. Any new server entry point must pass
  `hostname`. (Implemented in Step 6.4.)
- **Trade-off accepted**: existing OpenTUI / OpenCode docs that assume
  4096 is reachable from another host on the LAN will need to call out
  the env var. Existing tunnel flow (ADR 0004 SSH `-L`) is unaffected —
  it forwards to `localhost:4096` which is already the new default.

## Alternatives considered

- **Keep `0.0.0.0` default and rely on Basic Auth**: rejected. Basic
  Auth requires the operator to have run `tui` first, and the default
  `start` skips it. A secure default that depends on a non-default
  follow-up step is not a secure default (principle 5 — no ambiguous
  compromise).
- **Bind to `127.0.0.1` and add a CLI flag (`--host`)**: rejected. The
  wrapper script (ADR 0003 — single directory) already proxies a handful
  of subcommands. Adding a flag every subcommand must learn is more
  surface area than one env var. Env vars compose cleanly with launchd
  /systemd / Docker.
- **Refuse to listen on `0.0.0.0` even with the env set**: rejected.
  Some legitimate use cases exist (homelab, single-user LAN). The
  default protects the common case; the env unlocks the rare one.

## References

- ADR 0002 — Permission mode semantic mapping (`bypassPermissions` is
  the dangerous mode this binding protects).
- ADR 0003 — Single-directory deployment + wrapper script (the wrapper
  intentionally does not learn the new env).
- ADR 0009 — OpenCode Basic Auth (defense-in-depth, not a substitute
  for safe default).
- `src/index.ts:95-110` — implementation.
- Playbook PRINCIPLES.md §5 (no ambiguous compromise) and §10 (compact
  control surface).
