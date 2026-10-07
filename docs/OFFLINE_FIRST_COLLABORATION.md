# Offline-First Nearby Collaboration Architecture in DecentraIDE

## Overview & Core Primary Requirement

DecentraIDE supports offline-first, peer-to-peer collaboration that remains fully operational even when the public Internet connection or central signaling server becomes unavailable.

When internet connectivity drops or P2P signaling fails, DecentraIDE automatically fails over to nearby local network transports (LAN/Wi-Fi subnet broadcast) or Web Bluetooth without interrupting the developer's editing session or losing CRDT state. If no nearby peer is reachable, local editing continues seamlessly, with CRDT updates persisted locally in `.decentraide/crdt-snapshot.bin`. When connectivity is restored, peers exchange Yjs state vectors, reconcile missing operations, and converge to identical workspace states.

---

## Transport Failover Architecture

```
                               ┌─────────────────────────┐
                               │     Monaco Editor       │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │      Yjs Y.Doc          │
                               │  (Single Source Truth)  │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │   Core Sync Engine      │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │    TransportManager     │
                               │   (Failover & Router)   │
                               └──────┬─────┬─────┬──────┘
                                      │     │     │
               ┌──────────────────────┘     │     └──────────────────────┐
               │                            │                            │
   ┌───────────▼───────────┐    ┌───────────▼───────────┐    ┌───────────▼───────────┐
   │    WebRtcTransport    │    │      LanTransport     │    │ WebBluetoothTransport │
   │  (Priority 1: Internet)│    │ (Priority 2: LAN/Wi-Fi)│    │(Priority 3: Web BLE)  │
   └───────────┬───────────┘    └───────────┬───────────┘    └───────────┬───────────┘
               │                            │                            │
               └──────────────────────┬─────┴─────┬──────────────────────┘
                                      │           │
                          ┌───────────▼───┐   ┌───▼───────────┐
                          │ Internet Peer │   │  LAN Peer B   │
                          └───────────────┘   └───────────────┘
```

---

## Supported Runtime & Platform Specification

- **Primary Runtime Environment**: Web browser (Vite + React) running in Chromium-based browsers (Chrome, Edge, Brave) or packaged as an Electron desktop app.
- **Web Bluetooth Capabilities**: Uses standard `navigator.bluetooth` API (`requestDevice` and GATT characteristic notifications).
- **Web Bluetooth Constraints**:
  - Web Bluetooth API allows Chromium browsers to connect to GATT BLE devices.
  - Standard Web Bluetooth API requires user interaction and secure context (HTTPS or `localhost`). It does not provide arbitrary browser-to-browser RFCOMM sockets without custom native bridges.
  - When Web Bluetooth is supported by the runtime, real GATT connections are opened; when unsupported (e.g. in Firefox or plain HTTP), `WebBluetoothTransport` reports unsupported status cleanly without throwing runtime exceptions or generating fake device status.

---

## Component Details

### 1. Transport Failover Policy (`TransportManager.ts`)
The `TransportManager` evaluates connected peers across all registered transport drivers and automatically sets the active transport according to explicit priority:
1. **Priority 1**: `webrtc` (Internet / Signaling WebSocket)
2. **Priority 2**: `lan` (Local Area Network / Wi-Fi Broadcast)
3. **Priority 3**: `bluetooth` (Web Bluetooth API)
4. **Priority 4**: `local` (Local-first persistence mode)

### 2. Real LAN/Wi-Fi Transport (`LanTransport.ts`)
- Uses `BroadcastChannel` for zero-configuration local subnet P2P discovery and message framing (`decentraide-lan-{workspaceId}`).
- Encapsulates Yjs update vectors in JSON-header frames containing sender peer ID, target peer ID, and workspace ID.
- Automatically announces presence (`LAN_DISCOVERY_ANNOUNCE`) and filters out messages from different workspaces.

### 3. Local-First Persistence (`LocalPersistenceManager.ts`)
- Saves binary CRDT snapshots (`saveCrdtSnapshot`) into `.decentraide/crdt-snapshot.bin` (or `localStorage` fallback in web contexts).
- Restores persisted Yjs state upon application restart in offline mode so that offline changes are never lost.

### 4. Reconnect & Reconciliation Flow
When a connection is re-established:
1. Peers execute a lightweight handshake (`HANDSHAKE_HELLO` / `HANDSHAKE_ACK`) verifying protocol version and workspace ID.
2. Peers exchange Yjs state vectors (`Y.encodeStateVector(doc)`).
3. Peers compute diff updates (`Y.encodeStateAsUpdate(doc, remoteStateVector)`) and transmit only missing CRDT operations.
4. `Y.applyUpdate` merges the updates deterministically.

---

## Validation & Test Results

The test suite in `frontend/src/core/transport/OfflineFirstCollaboration.test.ts` executes 9 automated integration tests:
- **TEST 1**: Online Internet/WebRTC transport framing.
- **TEST 2**: Internet signaling failure triggers failover to LAN or local mode while preserving Y.Doc state.
- **TEST 3**: Two peers on LAN discover each other, exchange updates, and converge Yjs documents.
- **TEST 4**: Web Bluetooth transport detects platform support and handles connection attempts cleanly.
- **TEST 5**: Local-first mode allows editing and persists CRDT snapshot to disk.
- **TEST 6**: Reconnecting after offline edits exchanges state vectors and merges missing updates.
- **TEST 7**: Independent edits made by two peers while disconnected converge when reconnected.
- **TEST 8**: Duplicate and out-of-order network frames do not corrupt state or trigger loops.
- **TEST 9**: Restarting application in offline mode restores persisted Yjs state from `.decentraide`.
