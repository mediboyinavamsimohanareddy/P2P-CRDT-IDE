## Context

See proposal.md. The system already has `RoomPeerStore` for WebRTC/signaling mesh connections, `CrdtEngine` with Yjs for document sharing, `CrdtFsBinding` for file system binding, and `ProjectBar` / `VerificationRunner` for code execution. However, execution state and live file sync events are not hooked up to automatically broadcast across connected peers.

## Goals / Non-Goals

**Goals:**
- Broadcast execution events (`EXECUTE_START`, `EXECUTE_OUTPUT`, `EXECUTE_COMPLETE`) through `RoomPeerStore` / peer network.
- Wire `RoomPeerStore` execution broadcast events directly into `ProjectBar` and UI state so peers see synchronized execution output and status in real-time.
- Ensure `CrdtFsBinding` and `useFileSystem` propagate local disk modifications automatically across the P2P room data channels.

**Non-Goals:**
- Remote code execution on arbitrary untrusted server nodes without local runtime authorization.
- Full distributed multi-master file locking (CRDT handles concurrent editing).

## Decisions

1. **Peer Execution Signaling Message Type**:
   - Add `EXECUTE_START`, `EXECUTE_OUTPUT`, and `EXECUTE_COMPLETE` types to peer message definitions in `types.ts` / `RoomPeerStore.ts`.
   - Rationale: Reuses existing low-latency WebRTC data channel mesh established by `RoomPeerStore`.

2. **ProjectBar Synchronized Execution State**:
   - Subscribe `ProjectBar` component to `RoomPeerStore` execution events.
   - When a peer triggers `executeProgram`, send `EXECUTE_START` and stream log outputs via `EXECUTE_OUTPUT` messages.

3. **Disk & File System Auto-Sync Integration**:
   - Ensure `writeFile` and `createDir` operations update Yjs CRDT maps immediately, which automatically propagates to connected room peers.

## Risks / Trade-offs

- **[Risk]** Excessive output volume during long execution runs flooding WebRTC data channels.
  - *Mitigation*: Batch or throttle stdout/stderr chunks sent over peer data channels.

- **[Risk]** Circular event loop on received execution output.
  - *Mitigation*: Tag execution messages with `originatorId` to prevent echo back.
