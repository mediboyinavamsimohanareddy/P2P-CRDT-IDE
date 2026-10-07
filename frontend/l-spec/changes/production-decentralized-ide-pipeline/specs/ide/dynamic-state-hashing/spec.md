## Purpose

Calculates canonical workspace SHA-256 state vector hashes dynamically from Yjs share keys to verify convergence across peer instances.

## ADDED Requirements

### Requirement: Workspace Convergence Hash Calculation
The system SHALL compute canonical SHA-256 hashes derived from active document contents across all peers.

#### Scenario: Workspace hashes match
- **WHEN** all peers receive and apply all Yjs updates
- **THEN** `computeWorkspaceHash()` yields identical SHA-256 state hashes across all instances.
