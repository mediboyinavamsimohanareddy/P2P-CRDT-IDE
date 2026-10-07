## Why

Currently, when two systems connect to a shared project room, code edits made in the Monaco editor are synchronized via CRDT/Yjs, but files modified outside the active editor memory tab (or saved on disk) or executed via the ProjectBar execution triggers do not automatically sync real-time disk edits and live execution actions across connected peers without manual actions.

This change ensures that code changes, file system mutations, and execution actions across connected peers synchronize automatically in real time across systems connected to the same project room, providing zero-latency peer execution state synchronization and live automatic disk/CRDT synchronization.

## What Changes

- Automatic real-time propagation of file changes across connected peer systems when code is written, modified, or auto-saved.
- Live broadcast of code execution requests (e.g. running Java or Python code) from one connected peer system to all other connected peers in the project room.
- Synchronized execution output and status in real-time on connected peer systems so both systems reflect live execution actions without requiring manual file transfer or manual refresh.

## Capabilities

### New Capabilities
- `realtime-execution-sync`: Real-time peer-to-peer synchronization of code modifications, disk updates, and triggerable program executions across multi-system room sessions.

### Modified Capabilities

## Impact

- Frontend sync engine (`RoomPeerStore`, `CrdtFsBinding`, `CrdtMonacoBinding`, `ProjectBar`).
- Peer messaging schema (`types.ts` in shared package / frontend types) to support execution events and state sync.
