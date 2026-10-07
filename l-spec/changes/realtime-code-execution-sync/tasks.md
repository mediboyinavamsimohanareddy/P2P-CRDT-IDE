## 1. Network & Signaling Extension

- [ ] 1.1 Add execution broadcast message types (`EXECUTE_START`, `EXECUTE_OUTPUT`, `EXECUTE_COMPLETE`) to `RoomPeerStore` and message types in `shared/src/types.ts` and verify unit tests pass.
- [ ] 1.2 Implement execution broadcast methods on `RoomPeerStore` to relay execution events across all active peer WebRTC connections and verify message handler tests.

## 2. ProjectBar Execution Synchronization

- [ ] 2.1 Update `ProjectBar.tsx` to publish execution start, output, and completion messages to `RoomPeerStore` during execution runs and verify `npm test` passes in `frontend`.
- [ ] 2.2 Subscribe `ProjectBar.tsx` to incoming remote execution events to update local runtime console/status automatically in real time without manual refresh, and verify using tests.

## 3. Real-time File System Synchronization

- [ ] 3.1 Verify and connect `useFileSystem` file writing/creation hooks to automatically trigger `CrdtFsBinding` sync across connected peers.
- [ ] 3.2 Add integration tests verifying end-to-end synchronized state across two connected peer instances.
