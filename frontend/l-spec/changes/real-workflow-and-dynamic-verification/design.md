## Context

See `proposal.md`. The project currently relies on simulated verification stages, hardcoded Maven test counters, dummy conflict snippets, pre-populated mock security logs, and static Git hooks.

## Goals / Non-Goals

**Goals:**
- Replace simulated stages 1-4 in `VerificationRunner.ts` with real TypeScript/Java syntax and AST checks.
- Refactor backend `VerificationController.java` to parse and run Maven test execution output dynamically instead of returning hardcoded 42 tests.
- Bind `ConflictResolutionView.tsx` to active CRDT buffers/Monaco editor contents.
- Connect `SecurityMonitorView.tsx` directly to live `SecurityPipeline.ts` event emitters.
- Update `useGit.ts` and `MetricsCollector.ts` to perform real operational checks.

**Non-Goals:**
- Full local Java JVM inside WASM browser execution.

## Decisions

- **Dynamic Verification Gate**: Use real in-memory compiler diagnostics and dynamic Maven process execution parsing on the backend server.
- **CRDT Live Synchronization**: Use `CrdtEngine` document instances in `ConflictResolutionView` to retrieve active code and stage accepted merges directly into Yjs.
- **Security Event Bus**: Expose an event emitter on `SecurityPipeline` and subscribe `SecurityMonitorView` to render real rejected frames dynamically.

## Risks / Trade-offs

- *[Risk]* Maven test runner execution might time out on large test suites.
  → *Mitigation*: Set a configurable timeout on process builder execution and return structured failure diagnostics.
