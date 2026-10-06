# RULES — DecentraIDE (strict, non-negotiable)

> These rules apply to the AI coding agent in **every** session. If a request conflicts with a rule, stop and ask the user instead of breaking it.
> Words: **MUST / MUST NOT** are absolute.

## 0. Session protocol
1. MUST read in this order at session start: `rules.md` → `memory.md` → `task.md` → (`architecture.md`, `ui.md`, `prd.md` as needed).
2. MUST work on **one task at a time**, in `task.md` order. MUST NOT skip ahead or start unrelated work.
3. MUST update `memory.md` (tick, change log, next up) after every completed task.
4. MUST NOT tick a task unless its Definition of Done is verified (build + tests run, behavior demonstrated).
5. If something is unclear or missing, MUST ask — MUST NOT invent requirements.

## 1. Architecture rules (never violate)
1. **CRDT is the heart.** MUST NOT replace, bypass, or sit above the CRDT with another sync mechanism.
2. **AI sits on top of CRDT.** AI output MUST become a *proposal*; applying it MUST go through CRDT ops. AI MUST NOT write files or document state directly.
3. **AI is never the final authority.** Merges MUST pass parse → compile → tests before "Accept" is enabled. Low confidence MUST require human review.
4. **No central source of truth.** Spring Boot server MUST NOT store source code, CRDT state, files, or live ops. It only does: identity, project metadata, peer discovery, WebRTC signaling.
5. Live CRDT updates MUST travel **peer-to-peer**, never through Spring Boot.
6. **Transport abstraction:** CRDT/merge/AI code MUST NOT import WebRTC/LAN/Bluetooth code. Only `core/transport` may.
7. Every peer is client + server + replica. MUST NOT introduce a "host" or "master" peer role for data authority.
8. Git = history, CRDT = live collaboration. CRDT MUST NOT write into `.git`.
9. MUST NOT change the architecture, stack, or folder layout without user approval; log any approved change in `memory.md` → Deviations.

## 2. Security rules
1. Every outgoing frame MUST be **signed** and **encrypted**. Every incoming frame MUST be verified before touching the CRDT.
2. Receive order is fixed: signature → membership/role → replay/duplicate → schema → decrypt → apply. MUST NOT reorder or skip.
3. Rejected operations MUST NOT reach the CRDT and MUST emit a `SecurityEvent`.
4. MUST NOT log, transmit, or persist private keys, project keys, or plaintext source to the server or logs.
5. MUST NOT implement custom cryptography. Use libsodium primitives only.
6. MUST NOT hard-code keys, secrets, tokens, or passwords. Use env/keychain.
7. External (cloud) AI MUST be off by default and require explicit user consent shown in the UI. Default is local model.
8. Input from peers is **untrusted**: validate everything (zod schemas), cap sizes, never `eval`, never build shell commands from peer data.

## 3. Honesty / no-fake rules (important for demo credibility)
1. Metrics, hashes, latency, peer states, test results, and security events MUST be **real, computed values**. MUST NOT hard-code or randomize them to look good.
2. Demo controls MUST trigger **real** behavior in the pipeline (actual disconnect, actual invalid signature), not just change UI text.
3. Features not implemented (e.g., Bluetooth) MUST be shown as "not implemented"/"stub" in UI — MUST NOT pretend they work.
4. Seed/demo data is allowed only if clearly seeded and loaded through the same code paths as real data.
5. MUST NOT mark verification as passed unless the compiler/tests actually ran and passed.

## 4. UI rules
1. UI MUST follow `ui.md` and the reference images: **Image 1 is the main layout reference; Image 2 defines all other pages/tabs.** MUST NOT redesign, restyle, or rename sections.
2. Use only design tokens from `ui.md §1`. No new random colors, fonts, or component libraries without approval.
3. Dark theme only for v1. Dense, compact, VS Code–like.
4. Every screen MUST implement loading/empty/offline/error states.
5. UI MUST read from stores/state; MUST NOT embed hard-coded data inside components.
6. MUST NOT use browser `alert()`/`confirm()`; use in-app dialogs/toasts.

## 5. Code quality rules
1. TypeScript `strict: true`. MUST NOT use `any` (use `unknown` + narrowing). Java: no raw types, no swallowed exceptions.
2. Small modules, single responsibility; follow folder layout in `architecture.md §3` and `§11`.
3. MUST NOT leave `TODO`, commented-out code, `console.log` debugging, or dead code in finished tasks.
4. Public functions/interfaces MUST have types; non-obvious logic MUST have a short comment explaining *why*.
5. Prefer pure functions in `core/`; side effects only at edges (fs, network, process).
6. Handle errors explicitly; never silently catch. Surface user-facing errors in UI and log with context.
7. Naming: `camelCase` vars/functions, `PascalCase` types/components, `kebab-case` files (TS), standard Java conventions.
8. Commits (if asked): Conventional Commits, one task per commit, message references task ID (`feat(crdt): T-020 engine interface`).

## 6. Testing rules
1. Every task that adds logic MUST add tests in the same task. No tests = not done.
2. CRDT, security pipeline, and merge verification MUST have unit tests; convergence MUST have a multi-replica test.
3. MUST run build + tests before ticking a task; report actual results.
4. MUST NOT delete, skip, or weaken failing tests to make them pass. Fix the cause.

## 7. Dependency & environment rules
1. MUST NOT add a dependency without a one-line justification in `memory.md` → Decisions. Prefer well-maintained, widely used libs.
2. MUST pin versions; no `latest`.
3. MUST NOT run destructive commands (`rm -rf` outside build dirs, force pushes, dropping DBs) without user approval.
4. MUST NOT touch files outside the project folder.
5. MUST NOT upload project code or data to any third-party service.

## 8. Scope rules
1. MUST NOT add features not in `prd.md` / `task.md`.
2. MUST NOT start P2 tasks while any P0 task is incomplete.
3. MUST NOT refactor unrelated code during a task; note it in `memory.md` → Tech debt instead.
4. If a task is too big, split it in `task.md` (e.g., T-044a, T-044b) and tell the user.

## 9. Communication rules
1. At task start: state the task ID and plan in ≤5 lines.
2. At task end: summarize what changed, files touched, tests run + results, and what's next.
3. If blocked or uncertain: stop and ask a specific question; offer 2–3 options with a recommendation.
4. Be concise. No marketing language. Report failures honestly.

## 10. Forbidden list (quick scan)
- ❌ Central server holding code/CRDT state
- ❌ AI auto-applying merges without verification
- ❌ Bypassing signature/membership checks "temporarily"
- ❌ Fake metrics, fake peers, fake test results
- ❌ Coupling CRDT to a specific transport
- ❌ Redesigning the UI away from the reference images
- ❌ Cloud AI by default
- ❌ Ticking tasks that aren't actually done
- ❌ Adding features/dependencies without approval
