# PRD — DecentraIDE

> Product Requirements Document. Read this first. Keep it short; details live in the other files.

## 1. One-liner
**DecentraIDE** is a desktop IDE where every developer's machine is simultaneously a client, a server, a CRDT replica, an AI agent and a cryptographic peer — so teams collaborate on code in real time, offline-first, with **no central source of truth**.

> "There is no client-server relationship between developers."

## 2. Problem
- Live-collaboration tools depend on a central server that holds the code and becomes a single point of failure and trust.
- Concurrent edits to the same lines produce **semantic conflicts** that text-merge tools cannot resolve safely.
- Teams working offline or on a local network (no internet) are left out.
- AI assistants write code in isolation and add *more* merge conflicts.

## 3. Solution (core idea)
1. **CRDT is the heart.** All edits (human and AI) become CRDT operations that always converge.
2. **P2P transport.** Operations travel directly between peers (WebRTC DataChannels, LAN, future Bluetooth). Server is only for discovery/signaling.
3. **AI is intelligence on top of CRDT**, never a replacement. When overlapping changes occur, AST identifies the affected structures and the AI proposes a merge.
4. **AI is never the final authority.** Every proposed merge must pass compile + tests (and human review when confidence is low).
5. **Security by design.** E2E encryption, signed operations, forged/duplicate/unauthorized operations rejected.

## 4. Target users
- Student/hackathon teams and small dev teams.
- Developers who work offline or on LAN-only environments.
- Privacy-sensitive teams who do not want source code on a third-party server.

## 5. Core features (20)
| # | Feature | Priority |
|---|---------|----------|
| 1 | Decentralized peer architecture (each machine = peer + server + client) | MUST |
| 2 | CRDT real-time collaboration | MUST (CORE) |
| 3 | Offline-first editing + auto reconcile | MUST |
| 4 | P2P via WebRTC DataChannels | MUST |
| 5 | Transport abstraction (WebRTC / LAN / Bluetooth*) | MUST |
| 6 | Local/Bluetooth connectivity (where implemented) | COULD |
| 7 | AI coding copilot (generate, explain, debug, refactor, tests) — changes go through CRDT | MUST |
| 8 | **AI semantic conflict resolver (AST + AI)** — KILLER FEATURE | MUST |
| 9 | Compiler + test verification of merges | MUST |
| 10 | End-to-end encryption | MUST |
| 11 | Cryptographic peer identity (Ed25519 key pairs) | MUST |
| 12 | Byzantine/malicious operation defense | MUST |
| 13 | Local filesystem IDE (open/create/delete files) | MUST |
| 14 | Monaco editor with collaborator cursors/selections | MUST |
| 15 | Git integration (CRDT = live, Git = history) | SHOULD |
| 16 | Integrated terminal | SHOULD |
| 17 | Collaboration dashboard (peers, sync, offline ops, conflicts, security events) | MUST |
| 18 | Convergence verification (state hash comparison) | MUST |
| 19 | Failure simulation (demo controls) | MUST |
| 20 | Metrics (latency, ops, reconcile time, rejected ops, AI verify time) | SHOULD |

\*Bluetooth is "where implemented"; the abstraction must exist even if the transport is a stub.

## 6. Out of scope
- Server-side storage of source code or CRDT state.
- Cloud-hosted AI as the default (local model is default; external model is opt-in).
- Mobile apps, web version.
- Replacing Git.

## 7. Success criteria (demo-ready)
- 3 peers edit the same file concurrently and **converge to identical hashes**.
- A peer goes offline, keeps editing, reconnects, and reconciles with no data loss.
- A semantic conflict (e.g., password length `> 8` vs regex vs `> 12`) is detected, AI proposes a merge, compile + tests run, user accepts.
- Forged / modified / duplicate / unauthorized operations are **rejected and shown** in the Security Monitor.
- Stopping the signaling server does **not** break already-connected peers.
- Metrics panel shows real measured values (no fake numbers).

## 8. Constraints & assumptions
- Desktop app (Electron + React + TypeScript recommended; see `architecture.md`).
- Backend: tiny Spring Boot service.
- Demo project: Java/Maven (`decentra-auth` / `DecentraBank`).
- Threat model is defined in `architecture.md` §9.

## 9. Related files
`architecture.md` · `ui.md` · `task.md` · `memory.md` · `rules.md`
