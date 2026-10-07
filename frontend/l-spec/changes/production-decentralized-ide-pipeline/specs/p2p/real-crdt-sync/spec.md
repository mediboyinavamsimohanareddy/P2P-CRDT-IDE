## Purpose

Ensures Yjs CRDT document synchronization operates directly over WebRTC DataChannels between independent laptop instances without routing code edits through a central server.

## ADDED Requirements

### Requirement: P2P Document Synchronization
The system SHALL transmit Yjs CRDT update frames over WebRTC DataChannels directly to connected room peers.

#### Scenario: Peer edit synchronizes
- **WHEN** a user edits a file in Monaco Editor
- **THEN** Yjs generates an update frame and sends it over the active WebRTC DataChannel to all connected room peers.
