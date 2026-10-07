# TASKS — DecentraIDE

> Do tasks **in order, one at a time**. Do not start a task until all its dependencies are done.
> Each task has an ID, a Definition of Done (DoD), and must be ticked in `memory.md` when finished.
> Priority: P0 = must for demo · P1 = should · P2 = nice.

---

## PHASE 0 — Project setup
- [x] **T-001 (P0)** Create monorepo: `frontend/` (Electron+React+TS), `backend/` (Spring Boot), `docs/`.
  - DoD: both apps build and start with hello-world; lint + format configured.
- [x] **T-002 (P0)** Set up Tailwind, design tokens from `ui.md §1`, app shell skeleton (title bar, project bar, sidebar, editor area, right panel, bottom panel, status bar) with resizable splitters.
  - DoD: matches Image 1 layout with static placeholder content.
- [x] **T-003 (P0)** Shared types & schemas (`Frame`, `Op`, `PeerIdentity`, `SecurityEvent`, `Conflict`, `Proposal`) + validation (zod).

## PHASE 1 — Local IDE core
- [x] **T-010 (P0)** Open real folder via native dialog; explorer tree; create/rename/delete files and folders.
- [x] **T-011 (P0)** Monaco editor with tabs, syntax highlighting (Java, TS, JSON, XML, MD), unsaved indicators, save to disk.
- [x] **T-012 (P1)** Integrated terminal (node-pty + xterm.js), multiple sessions, split view.
- [x] **T-013 (P1)** Git integration: status, branch, diff, create checkpoint (commit); Source control panel per `ui.md §4.6`.
- [x] **T-014 (P0)** Local persistence in `.decentraide/` (workspace metadata, CRDT snapshot, op log).

## PHASE 2 — CRDT core  (CORE — highest care)
- [x] **T-020 (P0)** `CrdtEngine` interface + Yjs implementation; workspace doc model (`path → Y.Text`, metadata map).
- [x] **T-021 (P0)** Bind Monaco ↔ CRDT (per file), origin tags to avoid echo loops.
- [x] **T-022 (P0)** Bind filesystem ↔ CRDT (file watcher; create/rename/delete as metadata ops).
- [x] **T-023 (P0)** Op log, state vector, persisted offline queue ("N operations pending").
- [x] **T-024 (P0)** State hash (SHA-256 canonical) per file + workspace root; `verifyConvergence()`.
- [x] **T-025 (P0)** Unit tests: concurrent edits converge, duplicate ops idempotent, offline edits merge, 3-replica convergence (property/fuzz test).

## PHASE 3 — Security layer
- [x] **T-030 (P0)** Ed25519 identity generation + secure key storage; `peerId` fingerprint.
- [x] **T-031 (P0)** Sign/verify frames; canonical serialization.
- [x] **T-032 (P0)** Membership & roles (Owner/Developer/Reviewer/Observer) with owner-signed membership list.
- [x] **T-033 (P0)** E2E encryption: project key, X25519 key exchange, XChaCha20-Poly1305 payloads.
- [x] **T-034 (P0)** Receive pipeline: verify → membership → replay → schema → decrypt → apply; `SecurityEvent` emission.
- [x] **T-035 (P1)** Quarantine/revoke peers.
- [x] **T-036 (P0)** Tests for each threat in `architecture.md §9` (forged, modified, duplicate, unauthorized, malformed).

## PHASE 4 — Transport + Spring Boot
- [x] **T-040 (P0)** `Transport` interface + `TransportManager` (select/failover, stats).
- [x] **T-041 (P0)** Spring Boot server: identity register/lookup, challenge-response auth.
- [x] **T-042 (P0)** Spring Boot: project create/invite/join (signed membership, metadata only), peer discovery endpoint.
- [x] **T-043 (P0)** Spring Boot: WebSocket signaling (offer/answer/ICE relay, presence).
- [x] **T-044 (P0)** WebRTC transport: connect via signaling, DataChannel send/receive, reconnect logic.
- [x] **T-045 (P0)** Sync manager: state-vector exchange, offline buffer flush, reconcile timing metric.
- [x] **T-046 (P1)** LAN transport (mDNS discovery + direct WS) working with signaling stopped.
- [x] **T-047 (P2)** Bluetooth transport stub implementing `Transport` (marked "not implemented" in UI if so).
- [x] **T-048 (P0)** Integration test: 3 peers, kill signaling, peers stay connected & converge.

## PHASE 5 — Collaboration UI
- [x] **T-050 (P0)** Presence: live peers list, remote cursors & selections in Monaco with name flags.
- [x] **T-051 (P0)** Welcome screen + Invite peer + Join with invitation (QR) per `ui.md §4.5`.
- [x] **T-052 (P0)** Network & Sync screen per `ui.md §4.3` (topology, counters, replica hashes, transports, recovery).
- [x] **T-053 (P0)** Title/status bar live chips (P2P, peers, E2E, signaling, transport, RTT, throughput).
- [x] **T-054 (P0)** Offline mode UX: peer disconnect → pending ops → reconnect → verified.

## PHASE 6 — AI copilot
- [x] **T-060 (P0)** AI provider interface; Ollama local provider (`mistral:latest`).
- [x] **T-061 (P0)** Copilot panel: generate, explain, debug, refactor, tests; proposal diff with Confidence, Attribution, **Apply/Discard**.
- [x] **T-062 (P0)** Apply proposal → CRDT ops authored by AI-agent identity attributed to accepting user; AI-assisted gutter markers.
- [x] **T-063 (P1)** Right-panel "AI assistant | Activity" tabs; "Local & private · ON DEVICE" badge.

## PHASE 7 — Semantic conflict resolver (KILLER FEATURE)
- [x] **T-070 (P0)** Tree-sitter Java parsing; map ranges → AST nodes (method/block/expression).
- [x] **T-071 (P0)** Semantic conflict detector (concurrent changes to same/dependent AST nodes by ≥2 authors) → `Conflict` entities with versions A/B/C.
- [x] **T-072 (P0)** AI merge proposal (prompt with base + versions + AST context) → merged code + rationale + confidence.
- [x] **T-073 (P0)** Verification pipeline: Parse → Compile (`mvn compile`) → Static → Tests (`mvn test`) → Signature check, streaming stage results to UI.
- [x] **T-074 (P0)** Conflict resolution screen per `ui.md §4.2` incl. human-review-required variant (§4.8), pager, Next conflict.
- [x] **T-075 (P0)** Accept & stage merge → signed CRDT op; Merge history record (rationale, model, context hash, reviewer).
- [x] **T-076 (P0)** Merge History + AI Merge detail screen (`ui.md §4.7`).
- [x] **T-077 (P0)** Seed demo scenario (`password.length() > 8` / regex digit check / `> 12`) reproducible via Demo controls.

## PHASE 8 — Security monitor, health, metrics, demo tools
- [x] **T-080 (P0)** Security Monitor screen (`ui.md §4.4`) fed by real `SecurityEvent`s.
- [x] **T-081 (P0)** Demo controls: disconnect/restore peer, kill/restore signaling, duplicate op, invalid-signature op, modified payload, unauthorized op, reset.
- [x] **T-082 (P0)** Metrics collection + Metrics panel (real numbers).
- [x] **T-083 (P1)** Project Health screen (`ui.md §4.6`) running real checks.
- [x] **T-084 (P1)** Logs panel with level/source filters.
- [x] **T-085 (P0)** Convergence verification UI (hash table, verified/pending badges).

## PHASE 9 — Polish & release
- [x] **T-090 (P1)** Empty/loading/error states for all screens; keyboard shortcuts; command palette (⌘K).
- [x] **T-091 (P0)** End-to-end demo script test (3 peers: concurrent edit → offline → reconnect → conflict → AI merge → verify → attack attempts rejected).
- [x] **T-092 (P1)** Packaging (Electron builder), README with run instructions, demo seed data.
- [x] **T-093 (P1)** Performance pass (large files, many ops), memory leaks, error boundaries.
- [x] **T-094 (P2)** Final UI pixel pass against reference images.

---

## Dependency summary
`T-001..003 → Phase1 → Phase2 → Phase3 → Phase4 → Phase5 → Phase6 → Phase7 → Phase8 → Phase9`
(Phase 6 can start after Phase 2; Phase 7 requires Phases 2, 3, 6.)
