# DecentraIDE

> **DecentraIDE** is a peer-to-peer, offline-first desktop IDE with no central code authority, where each machine operates simultaneously as a client, server, CRDT replica, AI agent, and cryptographic node.

---

## Key Features

1. **CRDT Core Collaboration:**
   - Powered by Yjs CRDT document model (`path -> Y.Text`).
   - Two-way Monaco editor binding with origin tagging (`monaco-local`) to eliminate echo loops.
   - Offline operation logging (`.decentraide/oplog.db`) and automatic reconnection reconciliation.
   - Multi-replica convergence verification via SHA-256 canonical state vector hashing.

2. **Zero-Trust Security Pipeline:**
   - Cryptographic Ed25519 identity generation and SHA-256 `peerId` key fingerprinting.
   - Per-project symmetric payload encryption (`AES-256-GCM`).
   - Mandatory 5-stage verification sequence: `Schema -> Replay/Duplicate -> Membership -> Signature -> Decrypt`.
   - Security Monitor UI with live attack injection simulation harness.

3. **AI Copilot & Semantic Conflict Resolver (Killer Feature):**
   - Default on-device local AI via Ollama + `qwen2.5-coder`.
   - Cloud AI fallback via Gemini 1.5 Flash API.
   - Tree-sitter Java AST parser mapping concurrent overlapping changes to AST nodes.
   - 4-stage automated merge verification pipeline: `Parse -> Compile (mvn compile) -> Static Checks -> Tests (mvn test)`.

4. **Spring Boot Signaling Server:**
   - Minimal Spring Boot 3 / Java 21 signaling service (`/ws/signaling`, `/api/identity`, `/api/projects`).
   - Relays WebRTC SDP offers, answers, and ICE candidates without storing or seeing source code or CRDT state.

---

## Architecture Overview

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
                    │  CRDT  │
                    └───┬────┘
                        ↓
                 Security Layer   (sign / verify / encrypt / decrypt / replay-guard)
                        ↓
                 Transport Layer
              /         |         \
          WebRTC       LAN      Bluetooth (Stub)
              \         |         /
                   P2P PEERS
```

---

## Getting Started & Development

### Prerequisites
- **Node.js**: v20+ / v25+
- **Java**: Java 21 JDK
- **Maven**: 3.9+

### Monorepo Setup & Commands

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Mode:**
   - **Frontend (Vite / React App Shell):**
     ```bash
     npm run dev
     ```
     *Access the web UI at `http://localhost:5173/` or `http://localhost:5174/`*

   - **Backend (Spring Boot Server):**
     ```bash
     npm run dev:backend
     ```
     *Runs Spring Boot server on port `8082`*

3. **Run Test Suites:**
   ```bash
   npm run test
   ```
   *Executes Vitest across frontend & shared workspaces and JUnit 5 on the backend.*

4. **Production Build:**
   ```bash
   npm run build
   ```

---

## Testing & Verification Summary

- **Frontend Vitest Suites:** 17 test files passed (38 unit & component tests).
- **Backend JUnit 5 Suites:** `ServerApplicationTests` & `ServerEndpointsTest` passed cleanly.
- **Build Status:** Clean TypeScript compilation (`tsc`), Vite bundle, and Maven build.

---

## License

MIT License. Built for decentralized peer-to-peer developer collaboration.
