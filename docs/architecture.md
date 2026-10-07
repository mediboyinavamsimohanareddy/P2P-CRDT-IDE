# ARCHITECTURE — DecentraIDE

> Single source of truth for system design. If code and this file disagree, fix the code or update this file deliberately (log it in `memory.md`).

## 1. Principles
1. **CRDT is the heart.** AI is intelligence on top, never a replacement.
2. **Every machine is a node:** IDE + CRDT replica + AI agent + local storage + crypto identity + P2P server/client.
3. **Server is tiny:** identity, project metadata, peer discovery, WebRTC signaling. NOT live code, NOT CRDT source of truth, NOT file storage.
4. **CRDT is independent of networking** (transport abstraction).
5. **AI is never final authority** — compile + tests gate every merge.
6. **Git = history, CRDT = live collaboration.**

## 2. High-level diagram
```
                 DECENTRAIDE (per peer)
                         │
            ┌────────────┴────────────┐
       Human Developer           AI Copilot
            └────────────┬────────────┘
                         ↓
                      MONACO
                         ↓
                    ┌────────┐
                    │  CRDT  │  ← CORE
                    └───┬────┘
                        ↓
                 Security Layer   (sign / verify / encrypt / decrypt / replay-guard)
                        ↓
                 Transport Layer
              /         |         \
          WebRTC       LAN      Bluetooth*
              \         |         /
                   P2P PEERS
                        ↓
               Other CRDT replicas

   Conflict detected → AST → AI Merge Resolver → Compiler + Tests → Verified Merge
```

## 3. Peer node (desktop app) modules
```
frontend/
├── main/                 Electron main process (fs, git, terminal/pty, native, local-AI bridge)
├── renderer/             React UI (see ui.md)
├── core/
│   ├── crdt/             CRDT engine wrapper (Yjs recommended) + op log + state vector + hash
│   ├── security/         Ed25519 identity, signing, verification, E2E encryption, replay guard, membership
│   ├── transport/        Transport interface + WebRTC / LAN / Bluetooth(stub) implementations
│   ├── sync/             Sync manager: queue, offline buffer, reconcile, convergence verify
│   ├── ast/              Tree-sitter (Java first) parsing, affected-structure detection
│   ├── ai/               Provider interface (Local Ollama mistral:latest default), prompts
│   ├── merge/            Conflict detector, AI merge proposal, verification pipeline
│   ├── fs/               Workspace <-> CRDT binding, file watcher
│   ├── git/              Git wrapper (status, checkpoint, branch)
│   └── metrics/          Latency, ops, reconcile time, rejected ops, AI verify time
└── shared/               Types, schemas, constants
```

## 4. CRDT layer
- Library: **Yjs** (recommended) or Automerge. Wrap behind `CrdtEngine` interface.
- Document model: workspace = map of `path → Y.Text`, plus metadata map (file tree, renames, deletes).
- Must handle: concurrent ops, offline ops, duplicate ops (idempotent), eventual convergence.
- AI edits are applied as **normal CRDT ops authored by an AI-agent identity** (attributed to the human who accepted them).
- **Convergence verification:** SHA-256 over canonical document state per file + workspace root hash; peers exchange hashes; UI shows verified / syncing / pending.
- Persist: local snapshot + incremental op log on disk (`.decentraide/`), so restart/offline works.

## 5. Transport abstraction
```ts
interface Transport {
  id: 'webrtc' | 'lan' | 'bluetooth';
  start(): Promise<void>;
  stop(): Promise<void>;
  connect(peerId: string, hint?: unknown): Promise<void>;
  disconnect(peerId: string): void;
  send(peerId: string, frame: Uint8Array): Promise<void>;
  broadcast(frame: Uint8Array): Promise<void>;
  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void;
  onPeerState(cb: (peerId: string, state: 'connecting'|'connected'|'offline') => void): void;
  stats(): { rttMs: number; bytesIn: number; bytesOut: number };
}
```
- **WebRTC DataChannel** (primary) — signaling through Spring Boot only to establish.
- **LAN** — mDNS/UDP discovery + direct WebSocket/TCP between peers (works with no internet).
- **Bluetooth** — interface + stub/mock; implement only if time allows.
- Transport manager picks best available per peer and may fail over; CRDT never knows which.

## 6. Wire protocol (frame envelope)
```json
{
  "v": 1,
  "type": "crdt.update | crdt.syncStep1 | crdt.syncStep2 | hash.announce | presence | ai.proposal | membership",
  "projectId": "P-72A91",
  "from": "<peerId = pubkey fingerprint>",
  "opId": "<uuid-v7>",
  "lamport": 184,
  "ts": 1760000000000,
  "payload": "<base64 ciphertext>",
  "sig": "<ed25519 signature over canonical header+payload>"
}
```
Pipeline on **send:** CRDT op → serialize → encrypt (project key) → sign → transport.
Pipeline on **receive:** verify signature → check membership/role → replay/duplicate check → schema check → decrypt → apply to CRDT → emit event/metrics. Any failing step → **reject + log SecurityEvent** (never reaches CRDT).

## 7. Security architecture
- **Identity:** each peer generates an Ed25519 key pair on first run (stored in OS keychain/encrypted file). `peerId = fingerprint(pubKey)`.
- **Membership:** project owner signs an invitation / membership list (roles: Owner, Developer, Reviewer, Observer). Peers verify membership signature before accepting ops.
- **E2E encryption:** per-project symmetric key (XChaCha20-Poly1305 / AES-GCM) distributed to members via X25519 key exchange. Signaling server only sees ciphertext + routing metadata.
- **Replay/duplicate defense:** seen-opId set + Lamport/vector-clock checks.
- **Revocation/quarantine:** owner can revoke a peer; peers can quarantine a peer after repeated invalid ops.

## 8. AI layer
- **Provider interface:** `OllamaLocalProvider` (Ollama, `mistral:latest` default, "on device").
- **Copilot:** generate, explain, debug, refactor, write tests. Output is a *proposal* (diff) → user clicks **Apply** → becomes CRDT ops.
- **Context:** current file + open files + AST summary; nothing leaves the device when local.
- **Never** auto-merges without verification.

## 9. Threat model (defined — required by feature list)
| Threat | Defense | Demo |
|--------|---------|------|
| Forged op (no/invalid signature) | Signature verify → reject | "Invalid signature" |
| Modified payload in transit | Signature covers payload → reject | "Payload modified" |
| Duplicate / replayed op | opId + clock check → ignore, count | "Duplicate operation" |
| Unauthorized peer (not a member) | Membership check → reject | "Not a member" |
| Role violation (Observer writes) | Role check → reject | "Unauthorized operation" |
| Malformed op | Schema validation → reject | "Malformed payload" |
| Compromised signaling server | E2E encryption; server cannot read/forge | stop-signaling demo |
| Malicious peer repeated abuse | Quarantine / revoke | Peer trust table |
**Out of scope:** compromised endpoint OS, collusion of majority of owners, side channels.

## 10. Semantic conflict resolution pipeline (KILLER FEATURE)
1. **Detect:** concurrent changes by ≥2 authors (human/AI) touching the same AST node or dependent nodes within a time window, even if CRDT merged text cleanly.
2. **AST:** Tree-sitter parse of each version → affected structures (method, block, expression); build a "conflict region" with versions A/B/C (author, commit/op hash, line).
3. **AI proposal:** prompt with base + each version + AST context → returns merged code, rationale, **confidence %**.
4. **Verify (pipeline):** Parse → Compile (`mvn compile`) → Static checks → Tests (`mvn test`) → Signature check (all contributing ops verified).
5. **Decision:**
   - Verification pass **and** confidence ≥ threshold (default 80%) → "Accept & stage merge" enabled.
   - Confidence < threshold or behavioral ambiguity → **Human review required** banner; accept requires explicit confirm.
   - Verification fail → Retry / Edit manually / Reject.
6. **Accept:** merged text is applied as a *new signed CRDT op*, recorded in Merge History with rationale, model, context hash, reviewer.

## 11. Spring Boot backend (tiny)
```
backend/
├── identity/        POST /api/identity/register, GET /api/identity/{peerId}  (public key + display name only)
├── project/         POST /api/projects, GET /api/projects/{id}, POST /api/projects/{id}/invite, POST /api/projects/{id}/join
│                    (metadata: name, owner pubkey, signed membership list — NO source code)
├── discovery/       GET /api/projects/{id}/peers  (online peers, last seen)
└── signaling/       WebSocket /ws/signaling  (offer / answer / ice-candidate relay, presence)
```
- Stack: Spring Boot 3, Java 21, Spring Web, Spring WebSocket, Spring Security (JWT or signed-challenge auth), H2/SQLite/Postgres for metadata.
- **Auth:** challenge–response signed with peer's private key (no passwords stored).
- **Never** stores or relays plaintext source; signaling relays only SDP/ICE.
- Stateless where possible; must be killable at any time without breaking connected peers (demo: "Kill signaling").

### Connection flow
```
A,B → register identity → join project (invite code signed by owner)
A → signaling: offer(B) → B → answer → ICE exchange
A ⇄ B  WebRTC DataChannel established  (signaling no longer needed)
A,B run CRDT sync (state vector exchange) → hashes compared → "verified"
```

## 12. Offline-first behavior
- Peer keeps editing locally; ops stored in persisted queue ("N operations pending").
- On reconnect: exchange state vectors → send missing ops → hash compare → status flips offline → syncing → verified.
- Signaling down + peers connected = still fully functional; new peers can't join (shown in UI).

## 13. Filesystem, Git, terminal
- Open real folder; chokidar watcher ↔ CRDT binding (avoid echo loops with origin tags).
- Create/rename/delete files tracked as CRDT metadata ops.
- Git via `simple-git`/CLI: status, branch, checkpoint (commit), diff. **CRDT never writes `.git`.**
- Terminal: `node-pty` + xterm.js; sessions: shell, verification (build/test), p2p-daemon.

## 14. Metrics (all real, measured)
sync latency (op created → applied on remote), ops applied/received/duplicate/rejected, reconcile time after reconnect, RTT & throughput per transport, AI merge generation time, verification time (parse/compile/static/tests).

## 15. Failure simulation hooks (Demo controls)
Disconnect/Restore Peer C · Kill/Restore signaling · Send duplicate op · Send invalid-signature op · Send modified payload · Send unauthorized op · Reset demo. Implemented as *real* injection in the pipeline (not fake UI text).

## 16. Tech stack summary
| Area | Choice |
|------|--------|
| Desktop shell | Electron + TypeScript |
| UI | React + Tailwind + Monaco + xterm.js |
| CRDT | Yjs (behind interface) |
| P2P | WebRTC DataChannel (simple-peer/wrtc), LAN WS+mDNS |
| Crypto | libsodium (Ed25519, X25519, XChaCha20-Poly1305), SHA-256 |
| AST | Tree-sitter (Java) |
| Local AI | Ollama + mistral:latest |
| Server | Spring Boot 3 / Java 21 |
| Storage (peer) | files + SQLite/LevelDB in `.decentraide/` |
| Tests | Vitest (TS), JUnit (Spring), Playwright (UI smoke) |
