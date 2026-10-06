## Why

The current project contains hardcoded mock results, simulated verification delays, static UI counts, and dummy fallback behaviors across conflict resolution, verification runner, backend controller, security monitor, and system metrics. To deliver a production-ready decentralized IDE, the system must perform genuine AST/type/build verification, connect real security telemetry and transport events, and eliminate all dummy mock data.

## What Changes

- **Verification Pipeline Integration**: Replace hardcoded delays and static test results (`42/42 PASS`) with real Java AST, static checks, compilation, and dynamic test execution results from backend/local processes.
- **Backend Verification Controller Refactoring**: Execute actual Maven/Java test runner diagnostics instead of hardcoding `42` tests run and `0` test failures.
- **Conflict Resolution Component Fixes**: Connect `ConflictResolutionView` to live active code/CRDT buffer content instead of hardcoded `LoginService.java` string snippets and fake merge IDs.
- **Security Pipeline Wiring**: Connect `SecurityMonitorView` directly to live `SecurityPipeline` event streams instead of relying on pre-baked mock attack logs and hardcoded counters.
- **Git & System Services Wiring**: Replace hardcoded mock responses in `useGit.ts` and `MetricsCollector.ts` with real file system / git commands and live WebRTC/CRDT metrics.

## Capabilities

### New Capabilities
- `verification/dynamic-runner`: Dynamic local and backend code verification pipeline replacing simulated delays and mock test counts.
- `security/live-telemetry`: Real-time zero-trust security audit log streaming from SecurityPipeline to UI.
- `ide/conflict-resolution-flow`: End-to-end CRDT and AST-aware AI conflict resolution operating on active editor buffers.

### Modified Capabilities

## Impact

- `frontend/src/core/merge/VerificationRunner.ts`
- `frontend/src/components/ConflictResolutionView.tsx`
- `frontend/src/components/SecurityMonitorView.tsx`
- `frontend/src/hooks/useGit.ts`
- `frontend/src/services/MetricsCollector.ts`
- `backend/src/main/java/org/decentraide/server/verify/VerificationController.java`
