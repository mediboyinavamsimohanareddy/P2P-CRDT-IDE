## Purpose

Delivers real-time zero-trust security audit logs and peer trust updates from SecurityPipeline directly to the UI.

## ADDED Requirements

### Requirement: Live Security Audit Telemetry
The system SHALL stream actual rejected security events and verified frame counters from SecurityPipeline into the Security Monitor.

#### Scenario: Real security event logged
- **WHEN** an unauthorized or malformed frame is received by SecurityPipeline
- **THEN** the Security Monitor displays the real rejection details and updates live status counters.
