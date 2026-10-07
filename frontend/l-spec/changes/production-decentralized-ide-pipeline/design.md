## Context

See `proposal.md`. The production decentralized IDE architecture must execute real P2P CRDT sync over WebRTC DataChannels across LAN IPs, run dynamic SHA-256 workspace state vector convergence hashing, and support offline-first local operation queue persistence and auto-reconnection flushing.

## Goals / Non-Goals

**Goals:**
- Ensure Spring Boot WebSocket signaling supports room discovery across configurable LAN IPs (`window.location.hostname` or environment host).
- Wire `RoomPeerStore` to instantiate `WebRtcTransport` on room creation/join so CRDT updates stream directly peer-to-peer.
- Ensure `CrdtEngine` computes canonical workspace SHA-256 hashes dynamically from Yjs share keys.
- Ensure offline edits queue locally in `OpLogManager` and flush automatically upon WebRTC DataChannel connection opening.

## Decisions

- **Dynamic LAN Signaling Host**: Retrieve signaling host dynamically from `window.location.hostname:8082` rather than hardcoding `localhost:8082` to support multi-laptop LAN testing.
- **Direct WebRTC CRDT Wire Protocol**: Encode Yjs updates as `Uint8Array` binary frames and send over active WebRTC DataChannels.
- **Offline OpLog Queue Persistence**: Store unsent operations in `OpLogManager` and re-broadcast upon `onPeerState('connected')`.

## Risks / Trade-offs

- *[Risk]* LAN firewalls might block direct WebRTC DataChannel ICE connectivity between physical laptops.
  → *Mitigation*: Fall back to public STUN servers (`stun:stun.l.google.com:19302`) and provide clear connection status indicators in the UI.
