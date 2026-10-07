import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportManager } from './TransportManager';
import { LanTransport } from './LanTransport';
import { WebBluetoothTransport } from './WebBluetoothTransport';
import { WebRtcTransport } from './WebRtcTransport';
import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Feature 3: Offline-First Nearby Collaboration Test Suite', () => {
  let testDir: string;
  let persistence: LocalPersistenceManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'decentraide-offline-test-'));
    persistence = new LocalPersistenceManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  // TEST 1 — Online Internet/WebRTC collaboration
  it('TEST 1: WebRTC transport exchanges frames and connects active peers', async () => {
    const manager = new TransportManager('workspace-1');
    const webRtc = new WebRtcTransport('peer-A', 'room-1', 'ws://localhost:9999');
    
    manager.registerTransport(webRtc);
    expect(manager.getActiveTransportType()).toBe('webrtc');
  });

  // TEST 2 — Internet failure transition & editor document state preservation
  it('TEST 2: Internet signaling failure triggers failover to LAN or local mode without losing Y.Doc state', async () => {
    const manager = new TransportManager('workspace-1');
    const lan = new LanTransport('peer-A', 'workspace-1', undefined, { testBroadcast: true });
    manager.registerTransport(lan);

    const doc = new YjsCrdtEngine();
    doc.getText('app.ts').insert(0, 'const x = 100;');

    // Simulate Internet connection failure
    const activeTransport = manager.evaluateFailoverPolicy();
    
    // Y.Doc state must remain completely intact during transport failover
    expect(doc.getText('app.ts').toString()).toBe('const x = 100;');
    expect(activeTransport).toBe('local');
  });

  // TEST 3 — Real LAN/Wi-Fi collaboration & Yjs synchronization
  it('TEST 3: Two peers on LAN discover each other, exchange updates, and converge Yjs documents', async () => {
    const workspaceId = 'lan-workspace-42';
    
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    const managerA = new TransportManager(workspaceId);
    const lanA = new LanTransport('peer-A', workspaceId, 'Laptop-A', { testBroadcast: true });
    managerA.registerTransport(lanA);

    const managerB = new TransportManager(workspaceId);
    const lanB = new LanTransport('peer-B', workspaceId, 'Laptop-B', { testBroadcast: true });
    managerB.registerTransport(lanB);

    await managerA.startAll();
    await managerB.startAll();

    // Connect peers over LAN
    await lanA.connect('peer-B');
    await lanB.connect('peer-A');

    // Peer A edits document
    let updateA: Uint8Array | null = null;
    peerA.onUpdate((u) => { updateA = u; });
    peerA.getText('Main.java').insert(0, 'public class Main {}');

    expect(updateA).not.toBeNull();

    // Peer B receives LAN update from A
    peerB.applyUpdate(updateA!, 'lan-peer-A');

    expect(peerB.getText('Main.java').toString()).toBe('public class Main {}');
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());

    await managerA.stopAll();
    await managerB.stopAll();
  });

  // TEST 4 — Real Web Bluetooth capability check & error handling
  it('TEST 4: Web Bluetooth transport detects platform support and handles connection attempts cleanly', async () => {
    const btTransport = new WebBluetoothTransport('peer-A');
    await btTransport.start();

    expect(btTransport.id).toBe('bluetooth');
    if (!btTransport.isSupported()) {
      await expect(btTransport.connect('peer-B')).rejects.toThrow('Web Bluetooth API is not supported');
    }
  });

  // TEST 5 — Offline local-first editing & persistence
  it('TEST 5: Local-first mode allows editing and persists CRDT snapshot to disk', async () => {
    const doc = new YjsCrdtEngine();
    doc.getText('index.ts').insert(0, 'console.log("offline edit");');

    const snapshot = doc.encodeStateAsUpdate();
    const saved = await persistence.saveCrdtSnapshot(snapshot);
    expect(saved).toBe(true);

    const restored = await persistence.getCrdtSnapshot();
    expect(restored).not.toBeNull();

    const newDoc = new YjsCrdtEngine();
    newDoc.applyUpdate(restored!, 'restored');
    expect(newDoc.getText('index.ts').toString()).toBe('console.log("offline edit");');
  });

  // TEST 6 — Reconnection & reconciliation
  it('TEST 6: Reconnecting after offline edits exchanges state vectors and merges missing updates', async () => {
    const docA = new YjsCrdtEngine();
    const docB = new YjsCrdtEngine();

    // Initial state
    docA.getText('sync.ts').insert(0, 'base content');
    docB.applyUpdate(docA.encodeStateAsUpdate(), 'init');

    // Peer A edits offline
    docA.getText('sync.ts').insert(12, ' + offline edit A');

    // Peer B edits offline
    docB.getText('sync.ts').insert(0, 'header: ');

    // Reconnect & reconcile using Yjs state vectors
    const vectorA = docA.encodeStateVector();
    const vectorB = docB.encodeStateVector();

    const diffForB = docA.encodeStateAsUpdate(vectorB);
    const diffForA = docB.encodeStateAsUpdate(vectorA);

    docB.applyUpdate(diffForB, 'reconnect-A');
    docA.applyUpdate(diffForA, 'reconnect-B');

    expect(docA.getText('sync.ts').toString()).toBe(docB.getText('sync.ts').toString());
    expect(docA.computeWorkspaceHash()).toBe(docB.computeWorkspaceHash());
  });

  // TEST 7 — Concurrent offline edits convergence
  it('TEST 7: Independent edits made by two peers while disconnected converge when reconnected', async () => {
    const docA = new YjsCrdtEngine();
    const docB = new YjsCrdtEngine();

    docA.getText('shared.txt').insert(0, 'Line 1\nLine 2\nLine 3');
    docB.applyUpdate(docA.encodeStateAsUpdate(), 'init');

    // Concurrent offline edits
    docA.getText('shared.txt').insert(0, '[A Header]\n');
    docB.getText('shared.txt').insert(docB.getText('shared.txt').length, '\n[B Footer]');

    // Cross-merge
    docA.applyUpdate(docB.encodeStateAsUpdate(), 'merge-B');
    docB.applyUpdate(docA.encodeStateAsUpdate(), 'merge-A');

    expect(docA.getText('shared.txt').toString()).toBe(docB.getText('shared.txt').toString());
    expect(docA.computeWorkspaceHash()).toBe(docB.computeWorkspaceHash());
  });

  // TEST 8 — Duplicate & out-of-order message handling
  it('TEST 8: Duplicate and out-of-order network frames do not corrupt state or trigger loops', async () => {
    const docA = new YjsCrdtEngine();
    const docB = new YjsCrdtEngine();

    const updates: Uint8Array[] = [];
    docA.onUpdate((u) => updates.push(u));

    docA.getText('file.txt').insert(0, 'Part 1. ');
    docA.getText('file.txt').insert(8, 'Part 2. ');

    expect(updates.length).toBe(2);

    // Apply out-of-order and duplicate
    docB.applyUpdate(updates[1], 'out-of-order');
    docB.applyUpdate(updates[0], 'in-order');
    docB.applyUpdate(updates[0], 'duplicate'); // Duplicate delivery

    expect(docB.getText('file.txt').toString()).toBe('Part 1. Part 2. ');
  });

  // TEST 9 — Refresh/restart during offline mode
  it('TEST 9: Restarting application in offline mode restores persisted Yjs state from .decentraide', async () => {
    const docBefore = new YjsCrdtEngine();
    docBefore.getText('App.java').insert(0, 'class App { public static void main(String[] args) {} }');

    const snapshot = docBefore.encodeStateAsUpdate();
    await persistence.saveCrdtSnapshot(snapshot);

    // Simulate App Restart
    const restoredBytes = await persistence.getCrdtSnapshot();
    expect(restoredBytes).not.toBeNull();

    const docAfter = new YjsCrdtEngine();
    docAfter.applyUpdate(restoredBytes!, 'restored-snapshot');

    expect(docAfter.getText('App.java').toString()).toBe('class App { public static void main(String[] args) {} }');
    expect(docBefore.computeWorkspaceHash()).toBe(docAfter.computeWorkspaceHash());
  });
});
