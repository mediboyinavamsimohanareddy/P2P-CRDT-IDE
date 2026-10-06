## Purpose

Provides genuine, dynamic code verification and execution feedback using AST analysis, language checks, and real backend compilation and tests.

## ADDED Requirements

### Requirement: Real Verification Pipeline Execution
The system SHALL run real code analysis and test runner processes without simulated delays or mocked pass counts.

#### Scenario: Code verification runs
- **WHEN** user triggers the verification pipeline
- **THEN** system executes real compiler and test runner checks and returns actual pass/fail metrics.
