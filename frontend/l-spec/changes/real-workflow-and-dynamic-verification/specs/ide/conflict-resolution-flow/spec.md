## Purpose

Enables AST-aware semantic conflict resolution on active editor tab code and stages accepted merges into active CRDT state.

## ADDED Requirements

### Requirement: Active Buffer Conflict Resolution
The system SHALL perform conflict resolution on active document state rather than hardcoded mock strings.

#### Scenario: User resolves conflict on active file
- **WHEN** user accepts an AI merge proposal for an active document
- **THEN** the merged result is staged directly into the active Yjs CRDT buffer.
