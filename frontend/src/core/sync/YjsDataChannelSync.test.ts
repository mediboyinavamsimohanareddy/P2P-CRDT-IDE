import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborationManager } from './CollaborationManager';
import { Transport } from '../transport/Transport';
import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { SecurityManager } from '../security/SecurityManager';
import { Frame } from '@decentraide/shared';

class FakeTransport implements Transport {
  public id: 'webrtc' | 'lan' | 'bluetooth' = 'webrtc';
  public type: 'webrtc' | 'lan' | 'bluetooth' | 'local' = 'webrtc';
  public onFrameCb?: (peerId: string, data: Uint8Array) => void;
  public onPeerStateCb?: (peerId: string, state: 'connected' | 'connecting' | 'offline') => void;
  public sentFrames: Array<{ peerId: string; bytes: Uint8Array }> = [];
  public broadcastFrames: Uint8Array[] = [];

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  stats() {
    return { bytesIn: 0, bytesOut: 0, rttMs: 10 };
  }

  onFrame(callback: (peerId: string, data: Uint8Array) => void): void {
    this.onFrameCb = callback;
  }

  onPeerState(callback: (peerId: string, state: 'connected' | 'connecting' | 'offline') => void): void {
    this.onPeerStateCb = callback;
  }

  async send(peerId: string, data: Uint8Array): Promise<void> {
    this.sentFrames.push({ peerId, bytes: data });
  }

  async broadcast(data: Uint8Array): Promise<void> {
    this.broadcastFrames.push(data);
  }

  getStats() {
    return { bytesIn: 0, bytesOut: 0, rttMs: 10 };
  }

  simulateIncomingFrame(peerId: string, data: Uint8Array): void {
    this.onFrameCb?.(peerId, data);
  }

  simulatePeerState(peerId: string, state: 'connected' | 'connecting' | 'offline'): void {
    this.onPeerStateCb?.(peerId, state);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe('Yjs DataChannel Synchronization Pipeline', () => {
  let cm: CollaborationManager;
  let fakeTransport: FakeTransport;
  let roomId: string;

  beforeEach(async () => {
    cm = CollaborationManager.getInstance();
    roomId = 'test-room-' + Math.random().toString(36).substring(2, 7);
    await cm.startSession(roomId, { isHost: true });
    
    fakeTransport = new FakeTransport();
    cm.getTransportManager().registerTransport(fakeTransport);
    fakeTransport.simulatePeerState('peer-dummy', 'connected');
  });

  it('performs initial sync via crdt.syncStep1 and syncStep2 state-vector exchange', async () => {
    const remotePeerId = 'peer-b';
    const remoteIdentity = SecurityManager.generateIdentity();
    cm.getSecurityPipeline().addMember(remotePeerId, remoteIdentity.publicKeyPem, 'Developer');

    // Populate local host doc
    cm.getCrdtEngine().getText('src/main/java/Main.java').insert(0, 'public class Main {}');

    // Simulate connection from peer-b
    fakeTransport.sentFrames = [];
    fakeTransport.simulatePeerState(remotePeerId, 'connected');

    // Simulate PEER_HELLO from remote
    fakeTransport.simulateIncomingFrame(
      remotePeerId,
      new TextEncoder().encode(
        JSON.stringify({
          type: 'PEER_HELLO',
          peerId: remotePeerId,
          publicKeyPem: remoteIdentity.publicKeyPem,
        })
      )
    );

    // Create remote engine to act as joiner
    const remoteEngine = new YjsCrdtEngine();
    const remoteSv = remoteEngine.encodeStateVector();
    const remotePayload = JSON.stringify({ sv: uint8ArrayToBase64(remoteSv) });
    const encrypted = SecurityManager.encrypt(remotePayload, cm.getProjectKey());
    const payloadStr = JSON.stringify(encrypted);
    const sig = SecurityManager.signData(payloadStr, remoteIdentity.privateKeyPem);

    const step1FrameObj: Frame = {
      v: 1,
      type: 'crdt.syncStep1',
      projectId: roomId,
      from: remotePeerId,
      opId: '123e4567-e89b-12d3-a456-426614174001',
      lamport: Date.now(),
      ts: Date.now(),
      payload: payloadStr,
      sig,
    };

    cm.setActiveFilePath('src/main/java/Main.java');
    fakeTransport.sentFrames = [];
    fakeTransport.simulateIncomingFrame(remotePeerId, new TextEncoder().encode(JSON.stringify(step1FrameObj)));

    // Host responds with crdt.syncStep2 containing the missing state
    const step2Frame = fakeTransport.sentFrames.find((f) => {
      try {
        const str = new TextDecoder().decode(f.bytes);
        if (str.startsWith('{')) {
          const parsed = JSON.parse(str);
          return parsed.type === 'crdt.syncStep2';
        }
      } catch {
        // skip
      }
      return false;
    });

    expect(step2Frame).toBeDefined();
  });

  it('broadcasts live edits to connected peers', async () => {
    fakeTransport.broadcastFrames = [];
    const ytext = cm.getCrdtEngine().getText('src/main/java/Main.java');
    
    ytext.insert(0, '// Live edit test\n');

    expect(fakeTransport.broadcastFrames.length).toBeGreaterThan(0);
    const frameObj = JSON.parse(new TextDecoder().decode(fakeTransport.broadcastFrames[0]));
    expect(frameObj.type).toBe('crdt.update');
  });

  it('prevents echo loops on remote updates', async () => {
    const remotePeerId = 'peer-c';
    const remoteIdentity = SecurityManager.generateIdentity();
    cm.getSecurityPipeline().addMember(remotePeerId, remoteIdentity.publicKeyPem, 'Developer');
    cm.setActiveFilePath('src/main/java/Main.java');

    const remoteEngine = new YjsCrdtEngine();
    remoteEngine.getText('src/main/java/Main.java').insert(0, 'System.out.println("Hello");');
    const updateBytes = remoteEngine.encodeStateAsUpdate();

    const payloadObj = { u: uint8ArrayToBase64(updateBytes), filePath: 'src/main/java/Main.java' };
    const encrypted = SecurityManager.encrypt(JSON.stringify(payloadObj), cm.getProjectKey());
    const payloadStr = JSON.stringify(encrypted);
    const sig = SecurityManager.signData(payloadStr, remoteIdentity.privateKeyPem);

    const updateFrame: Frame = {
      v: 1,
      type: 'crdt.update',
      projectId: roomId,
      from: remotePeerId,
      opId: '123e4567-e89b-12d3-a456-426614174002',
      lamport: Date.now(),
      ts: Date.now(),
      payload: payloadStr,
      sig,
    };

    fakeTransport.broadcastFrames = [];
    fakeTransport.simulateIncomingFrame(remotePeerId, new TextEncoder().encode(JSON.stringify(updateFrame)));

    // Filtering out control messages like HASH_ANNOUNCE if any
    const crdtBroadcasts = fakeTransport.broadcastFrames.filter((f) => {
      try {
        const obj = JSON.parse(new TextDecoder().decode(f));
        return obj.type === 'crdt.update';
      } catch {
        return false;
      }
    });

    // Remote apply MUST NOT trigger an outbound CRDT update broadcast frame (echo prevention)
    expect(crdtBroadcasts.length).toBe(0);
    expect(cm.getCrdtEngine().getText('src/main/java/Main.java').toString()).toContain('System.out.println("Hello");');
  });

  it('rejects forged/tampered updates before applying to Y.Doc', async () => {
    const attackerPeerId = 'peer-attacker';
    const attackerIdentity = SecurityManager.generateIdentity();
    // NOT added to membership!

    const payloadObj = { u: 'bWFsaWNpb3Vz', filePath: 'src/main/java/Main.java' };
    const encrypted = SecurityManager.encrypt(JSON.stringify(payloadObj), cm.getProjectKey());
    const payloadStr = JSON.stringify(encrypted);
    const sig = SecurityManager.signData(payloadStr, attackerIdentity.privateKeyPem);

    const attackFrame: Frame = {
      v: 1,
      type: 'crdt.update',
      projectId: roomId,
      from: attackerPeerId,
      opId: '123e4567-e89b-12d3-a456-426614174003',
      lamport: Date.now(),
      ts: Date.now(),
      payload: payloadStr,
      sig,
    };

    const initialText = cm.getCrdtEngine().getText('src/main/java/Main.java').toString();
    fakeTransport.simulateIncomingFrame(attackerPeerId, new TextEncoder().encode(JSON.stringify(attackFrame)));

    // Text remains unmodified
    expect(cm.getCrdtEngine().getText('src/main/java/Main.java').toString()).toBe(initialText);
  });
});
