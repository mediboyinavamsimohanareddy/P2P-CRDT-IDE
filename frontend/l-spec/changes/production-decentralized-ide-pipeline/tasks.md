## 1. Multi-Laptop LAN & Dynamic WebRTC Transport

- [x] 1.1 Update `WebRtcTransport.ts` and `LeftSidebar.tsx` to construct WebSocket URLs using dynamic host addresses (`window.location.hostname`) for multi-laptop LAN testing.

## 2. Dynamic CRDT Convergence Hashing

- [x] 2.1 Refactor `CrdtEngine.ts` to compute canonical workspace state vector hashes dynamically from Yjs document keys and state vectors.

## 3. Offline Operation Queue & Auto-Flushing

- [x] 3.1 Verify `OpLogManager.ts` queues unsent local Yjs operations during network disconnection and flushes them automatically upon WebRTC DataChannel connection opening.
