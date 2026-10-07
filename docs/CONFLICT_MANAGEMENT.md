# Conflict Management in DecentraIDE

## Current Implementation Before Changes

Prior to this phase of implementation, DecentraIDE had several foundation modules for CRDT and collaboration:

1. **CRDT Engine (`YjsCrdtEngine` in `frontend/src/core/crdt/CrdtEngine.ts`)**:
   - Wraps a Yjs `Y.Doc`.
   - Manages text buffers mapped by file path (`doc.getText(path)`).
   - Provides methods `applyUpdate`, `encodeStateAsUpdate`, `encodeStateVector`, and SHA-256/FNV-1a hash calculation over file and workspace state.

2. **Monaco Editor Binding (`CrdtMonacoBinding` in `frontend/src/core/crdt/CrdtMonacoBinding.ts`)**:
   - Connects Monaco editor change events to `Y.Text` using `transact(..., 'monaco-local')`.
   - Observes `Y.Text` changes and updates Monaco editor state while ignoring updates with `transaction.origin === 'monaco-local'` to prevent echo loops.

3. **Security & Transport Pipelines**:
   - `SecurityPipeline` performs schema checks, replay/duplicate checks via `seenOpIds`, signature verification, and decryption.
   - `TransportManager` and `WebRtcTransport` manage network frame transmission.
   - `ConvergenceVerifier` computes workspace hashes across replicas to check state equivalence.

### Gaps Identified Before Changes
- Automated unit and integration tests specifically validating CRDT conflict management scenarios (concurrent editing, same-region overlapping edits, duplicate update idempotency, out-of-order delivery, multi-peer convergence, loop prevention, and document isolation) were incomplete or scattered.
- Peer/Document routing validation needed explicit checks to prevent applying updates across different files or projects.
- Document state hashing and convergence reporting needed to be integrated cleanly with test verification utilities.

---

## Architecture Diagram

```
Local User Typing in Monaco Editor
             │
             ▼
    Yjs Transaction (origin: 'monaco-local')
             │
             ▼
     Y.Text (Yjs Doc)
             │
             ▼
     Yjs CRDT Update (Uint8Array)
             │
             ▼
  Security & Transport Layer (Sign / Encrypt / Send Frame)
             │
             ▼
        P2P Network
             │
             ▼
  Security & Transport Layer (Verify / Decrypt / Check Replay)
             │
             ▼
  Remote Yjs Doc (Y.applyUpdate(doc, update, remoteOrigin))
             │
             ▼
  Y.Text Observer (Filters out 'monaco-local' updates)
             │
             ▼
  Monaco Editor updated with remote changes
```

---

## 1. What Conflict Management Means in DecentraIDE

In a decentralized peer-to-peer IDE with no central server or authoritative database, conflict management is the mechanism that ensures all peer replicas achieve **eventual state convergence** when editing files concurrently. 

DecentraIDE distinguishes between two fundamental concepts:
1. **CRDT Concurrency (Document Consistency)**: Merging concurrent character insertions, deletions, and structural updates automatically and deterministically across all replicas without data corruption or lost updates.
2. **Semantic Code Conflicts (Intent Conflicts)**: Situations where two merged code edits produce syntactically or logically invalid code (e.g., two developers renaming or changing the signature of the same method in different ways). Semantic code conflicts are handled separately by verification pipelines and developer tools.

## 2. Why Yjs/CRDT is Used

Yjs uses Conflict-free Replicated Data Types (CRDTs) using Yjs's sequence CRDT algorithm (YATA). Yjs provides:
- **Commutativity, Associativity, and Idempotency**: Updates can be merged in any order, applied multiple times, or combined without changing the final document state.
- **No Central Coordinator**: Replicas exchange state updates directly over P2P transports.
- **Deterministic Convergence**: Given the same set of operations, all replicas converge to identical document states regardless of network delays or message ordering.

## 3. How Local Edits are Represented

Local edits in Monaco trigger transactions on the corresponding `Y.Text` instance in the local `Y.Doc`:
```typescript
this.engine.getDoc().transact(() => {
  this.yText.delete(0, this.yText.length);
  this.yText.insert(0, newContent);
}, 'monaco-local');
```
When `Y.Doc` changes, Yjs generates a compact `Uint8Array` binary update vector containing the structural delta and transaction metadata.

## 4. How Concurrent Edits are Handled

When User A and User B edit the document concurrently without knowledge of each other's changes:
1. User A applies edit $E_A$ to $Doc_A$, producing update $U_A$.
2. User B applies edit $E_B$ to $Doc_B$, producing update $U_B$.
3. $U_A$ is transmitted to B; $U_B$ is transmitted to A.
4. $Doc_A$ executes `Y.applyUpdate(Doc_A, U_B)`.
5. $Doc_B$ executes `Y.applyUpdate(Doc_B, U_A)`.
6. Both Yjs documents resolve item ordering using Lamport clocks and client IDs embedded in the CRDT operations.
7. $Doc_A \equiv Doc_B$.

## 5. How Updates are Exchanged

Updates are wrapped in standard frame envelopes containing transport metadata, project ID, operation ID, origin peer ID, payload, and cryptographic signature. Upon receipt and validation by the receiving peer's security pipeline, the decrypted update `Uint8Array` is applied directly to the target `Y.Doc`.

## 6. How Duplicate Updates are Handled

Yjs binary updates are mathematically idempotent. If the same `Uint8Array` update vector $U_1$ is applied to a `Y.Doc` multiple times:
- The first call `Y.applyUpdate(doc, U_1)` integrates the internal struct items.
- Subsequent calls `Y.applyUpdate(doc, U_1)` detect that all structs in $U_1$ are already present in $Doc$'s clock store and safely ignore them. No extra characters or state changes are produced.
- In addition, the `SecurityPipeline` tracks seen `opId` values in a `seenOpIds` set to drop duplicate network frames early before decryption.

## 7. How Out-of-Order Updates are Handled

Yjs maintains missing structural dependencies in an internal buffer. If update $U_3$ depends on items in $U_1$ or $U_2$ that have not yet arrived:
- Yjs buffers $U_3$'s unintegrated structs.
- When $U_1$ and $U_2$ subsequently arrive, Yjs integrates $U_1$, $U_2$, and then integrates the buffered items from $U_3$.
- Replicas receiving updates in order $U_1 \to U_2 \to U_3$ and $U_3 \to U_1 \to U_2$ converge to the exact same state.

## 8. How Synchronization Loops are Prevented

Echo loops ($A \to B \to A \to B \dots$) are prevented at two layers:
1. **Transaction Origin Tagging**: Local editor changes set origin `'monaco-local'`. When `Y.Text` emits update events, the event handler inspects `event.transaction.origin`. If the origin is `'monaco-local'`, the update is broadcast to remote peers. Remote updates applied via `applyUpdate(doc, update, remoteOrigin)` carry a remote origin, preventing the local editor binding from interpreting remote updates as new local typing.
2. **Yjs Delta Filtering**: Applying a remote update that contains operations already known to the local doc produces no delta/changes, preventing cascading event triggers.

## 9. How Multi-Peer Convergence Works

Across $N$ peers ($Peer_1, Peer_2, \dots, Peer_N$):
- Each peer generates local CRDT updates.
- Updates are gossiped/broadcast across WebRTC data channels or transport layers.
- Once all updates have been delivered to all peers, the mathematical properties of Yjs guarantee:
$$\text{State}(Peer_1) = \text{State}(Peer_2) = \dots = \text{State}(Peer_N)$$
- The system verifies convergence by calculating a SHA-256 canonical hash over all file paths and text contents in the workspace (`ConvergenceVerifier.ts`).

## 10. Difference Between CRDT Conflict and Semantic Code Conflict

| Feature | CRDT Concurrency | Semantic Code Conflict |
|---|---|---|
| **Scope** | Low-level text/character operations | Programming language AST / logic |
| **Goal** | Guaranteed replica document state convergence | Syntactically and logically correct executable code |
| **Resolution** | Automatic via Yjs YATA algorithm | Verification gates (Parse, Compile, Test) + Developer review |
| **Handled By** | `CrdtEngine` / Yjs | `VerificationRunner` / Language Tooling |

## 11. Current Limitations

- **Syntactic Validity**: CRDT guarantees character convergence, but concurrent insertions in the same line may require developer formatting or cleanup.
- **Network Partitions**: During prolonged offline periods, peers collect local operations in an offline log (`OpLogManager`). Upon reconnection, state vectors are exchanged to synchronize missing operations.

## 12. Testing Performed

The conflict management test suite in `frontend/src/core/crdt/ConflictManagement.test.ts` executes automated unit and integration tests covering all 10 mandatory scenario gates:
- TEST 1: Single local edit correctness
- TEST 2: Two-peer synchronization convergence
- TEST 3: Concurrent independent edits
- TEST 4: Concurrent same-region overlapping edits
- TEST 5: Duplicate update idempotency
- TEST 6: Out-of-order update convergence
- TEST 7: Three-peer multi-replica convergence
- TEST 8: Synchronization loop prevention
- TEST 9: Multi-file / document isolation
- TEST 10: Application stability under rapid concurrent updates
