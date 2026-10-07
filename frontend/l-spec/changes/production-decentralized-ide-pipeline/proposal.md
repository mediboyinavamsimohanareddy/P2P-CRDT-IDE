## Why

To guarantee DecentraIDE functions as a real-world, production-ready decentralized IDE across multiple physical laptops, all residual mock state, hardcoded static counters, and unhandled offline/P2P network transitions must be completely replaced with end-to-end executable mechanisms.

## What Changes

- **End-to-End P2P & Signaling Integration**: Ensure Spring Boot handles WebSocket signaling for room creation/joining across LAN IPs while live document editing streams exclusively over direct WebRTC DataChannels.
- **Dynamic CRDT State Hashing & Convergence Verification**: Calculate canonical workspace SHA-256 hashes dynamically from active Yjs document keys to guarantee convergence across Laptop A, Laptop B, and Laptop C.
- **Live Terminal & Execution Harness**: Ensure integrated terminal execution and top-bar Java/Python run buttons execute real local process commands with live stdout/stderr streams.
- **Offline Mode & Queue Synchronization**: Support seamless offline editing when network connectivity drops, queuing Yjs update operations locally and auto-synchronizing upon reconnection.
- **Groq Llama 3.1 8B Instant AI Integration**: Execute real Groq API calls for semantic conflict merging with graceful offline fallback.

## Capabilities

### New Capabilities
- `p2p/real-crdt-sync`: End-to-end Yjs CRDT synchronization over WebRTC DataChannels across LAN IPs.
- `ide/dynamic-state-hashing`: Canonical SHA-256 workspace state vector hash calculation for CRDT convergence verification.
- `ide/offline-queue-sync`: Local operation persistence and automatic queue synchronization upon peer reconnection.

### Modified Capabilities

## Impact

- `frontend/src/core/crdt/CrdtEngine.ts`
- `frontend/src/core/sync/RoomPeerStore.ts`
- `frontend/src/core/transport/WebRtcTransport.ts`
- `frontend/src/components/ProjectBar.tsx`
- `frontend/src/components/TerminalComponent.tsx`
- `backend/src/main/java/org/decentraide/server/signaling/WebSocketConfig.java`
