# Project Policy

> **This project follows [Playbook] v0.4.0.** Deviations from playbook
> defaults are recorded as ADRs in this repository, not as silent edits
> to this file.

[Playbook]: https://github.com/esyjy/playbook

The policies below are the short-form, project-binding version of the
ten playbook principles. Full rationale lives in [Playbook's
`PRINCIPLES.md`][principles].

[principles]: https://github.com/esyjy/playbook/blob/main/docs/PRINCIPLES.md

---

## 1. Institutional memory beats heroic memory

Every decision and every discovery lands in a durable artifact before
the conversation moves on. The four axes: ADRs, issues, session
context, session archive.

## 2. Verification chains must be falsifiable

A test that always passes provides a false green signal. Cross-dimension
matrices, canaries, and rehearsed recovery paths prove that the absence
of a check would be visible.

## 3. Honest capability matrices

Every adapter and feature exposes a truthful matrix of what it actually
enforces. Permission-mode mapping (ADR 0002) is the canonical example —
no marketing language, only what the adapter literally does.

## 4. Permanent rules vs deferred via named seams

PERMANENT: 127.0.0.1 default bind (ADR 0011), permission mode strict
mapping (ADR 0002), single-directory deployment (ADR 0003).
DEFERRED: unit test suite (Phase 7 seam, see plan), full PTY emulation
parity with terminal (Phase 2 → ongoing).

## 5. No ambiguous compromise

Don't weaken security defaults to make installs easier. Don't bypass
permission modes to make tools "just work". Defer the scope rather than
ship the soft version.

## 6. Validation surface discipline

CI matrix is `macOS-latest × Bun` (single row — see overrides below).
Integration tests live under `docs/integration-test.md` and run locally
pre-merge. CI runs typecheck + Bun unit tests when present.

## 7. Branch-aware READMEs

`main`'s README reflects the latest shipped release. Phase branches
open with a 🚧 banner.

## 8. Discoveries file before the step closes

Any problem, follow-up, or future-work item that surfaces during
development gets filed as an issue before the current step ends.

## 9. Decisions converge on the design goal

The design goal: a programmable HTTP API for Claude Code that OpenTUI
and OpenCode TUI can drive transparently. When in doubt, prefer the
choice the user (OpenTUI operator) would prefer.

## 10. Compact control surface

The user-facing surface is intentionally small:
- One directory: `~/.claude-headless-server`
- One CLI: `claude-headless-server {start|stop|status|restart|tui|logs|uninstall}`
- One port: `4096` (override via `CLAUDE_SERVER_PORT`)
- One host binding: `127.0.0.1` (override via `CLAUDE_SERVER_HOST`, ADR 0011)

---

## Project-specific overrides

These deviations from playbook defaults are intentional. Each links to
the ADR or plan that justifies it.

- **Single-runtime exemption** — Bun only. No Node / Deno matrix.
  - *Reason:* The server depends on Bun-specific APIs (`Bun.serve`,
    `Bun.env`, `Bun.spawn` with PTY semantics). A cross-runtime matrix
    would force abstraction layers that add no user value.
  - *Trigger to revisit:* If a deploy target ships only Node, file an
    issue and convert the runtime split into an ADR.

- **Single-OS CI exemption** — macOS-latest only.
  - *Reason:* The target install platform is the maintainer's macbook
    (see [memory: macbook-as-server]). Linux / Windows are out of scope
    for v0.6.0.
  - *Trigger to revisit:* If a Linux contributor shows up, add
    `ubuntu-latest` to the CI matrix and update this section.

- **No unit test framework yet** — only integration tests.
  - *Reason:* The server is mostly thin route handlers + an external
    process spawn. The valuable verification surface is end-to-end
    (does Claude actually respond, does the SSE relay actually fire).
  - *Trigger to revisit:* When a route handler accumulates non-trivial
    branching logic that integration tests can't cover cleanly. Phase
    7 seam.

[memory: macbook-as-server]: https://github.com/esyjy

---

## Reading these together

The policies are mutually reinforcing. A plan that respects all of them
produces clean releases. A plan that quietly violates one produces drift
that surfaces phases later as a documentation audit.
